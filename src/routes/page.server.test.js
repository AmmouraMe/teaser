import { describe, it, expect, vi, afterEach } from 'vitest';
import { actions, load } from './+page.server.js';
import { memoryKV } from '$lib/kv.test-helper.js';

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

/**
 * @param {Record<string, string>} fields
 * @param {Record<string, any>} [env]
 * @param {Record<string, string>} [headers]
 */
function submit(fields, env = {}, headers = {}) {
	const body = new FormData();
	for (const [k, v] of Object.entries(fields)) body.set(k, v);
	const request = new Request('https://ammoura.me/', { method: 'POST', body, headers });
	return actions.default(/** @type {any} */ ({ request, platform: { env }, getClientAddress: () => '203.0.113.9' }));
}

describe('waitlist email action', () => {
	it('asks for an email when the field is blank', async () => {
		expect(await submit({ email: '  ' })).toEqual({ success: false, error: 'Enter an email.' });
	});

	it('rejects a disposable address without writing', async () => {
		const kv = memoryKV();
		expect(await submit({ email: 'x@mailinator.com' }, { WAITLIST: kv })).toEqual({
			success: false,
			error: 'It knows.'
		});
		expect(kv.store.size).toBe(0);
	});

	it('writes the same KV shape as the OAuth routes', async () => {
		const kv = memoryKV();
		const res = await submit(
			{ email: 'Real@Person.dev', _clientData: '{"screenWidth":1440}' },
			{ WAITLIST: kv },
			{ 'cf-ipcountry': 'NZ' }
		);
		expect(res).toEqual({ success: true, email: 'Real@Person.dev' });

		const key = [...kv.store.keys()].find((k) => k.startsWith('entry:')) ?? '';
		const saved = JSON.parse(kv.store.get(key) ?? '');
		expect(saved).toMatchObject({
			email: 'Real@Person.dev',
			source: 'email',
			client: { screenWidth: 1440 },
			server: { country: 'NZ', ip: '203.0.113.9' }
		});
		expect(kv.store.get('seen_email:real@person.dev')).toBe('1');
		expect(kv.store.get('counter:unique_emails')).toBe('1');
	});

	it('ignores malformed client data', async () => {
		const kv = memoryKV();
		await submit({ email: 'a@person.dev', _clientData: '{nope' }, { WAITLIST: kv });
		const key = [...kv.store.keys()].find((k) => k.startsWith('entry:')) ?? '';
		expect(JSON.parse(kv.store.get(key) ?? '').client).toEqual({});
	});

	it('sends Discord an embed Discord will accept', async () => {
		// The old email-path notifier sent `Name` and `What's Stopping Them`
		// fields whose values no longer existed, and Discord 400s an embed
		// field with no value — so every email signup notification failed.
		const f = vi.fn(async () => new Response(null, { status: 204 }));
		vi.stubGlobal('fetch', f);
		await submit({ email: 'a@person.dev' }, { WAITLIST: memoryKV(), DISCORD_WEBHOOK_URL: 'https://hook' });
		expect(f).toHaveBeenCalledOnce();
		const body = JSON.parse(/** @type {any} */ (f.mock.calls[0])[1].body);
		for (const field of body.embeds[0].fields) expect(typeof field.value).toBe('string');
	});

	it('treats a repeat email as success without writing or posting', async () => {
		const f = vi.fn(async () => new Response(null, { status: 204 }));
		vi.stubGlobal('fetch', f);
		const kv = memoryKV();
		const env = { WAITLIST: kv, DISCORD_WEBHOOK_URL: 'https://hook' };
		await submit({ email: 'a@person.dev' }, env);
		const before = new Map(kv.store);
		expect(await submit({ email: 'A@Person.dev' }, env)).toEqual({ success: true, email: 'A@Person.dev' });
		expect(kv.store).toEqual(before);
		expect(f).toHaveBeenCalledOnce();
	});

	it('limits one address to five signups a window, with no writes once limited', async () => {
		const kv = memoryKV();
		for (let i = 0; i < 5; i++) {
			expect((await submit({ email: `u${i}@person.dev` }, { WAITLIST: kv })).success).toBe(true);
		}
		const before = new Map(kv.store);
		const puts = vi.spyOn(kv, 'put');
		expect(await submit({ email: 'u9@person.dev' }, { WAITLIST: kv })).toEqual({
			success: false,
			error: 'Too many tries. Wait a while.'
		});
		expect(puts).not.toHaveBeenCalled();
		expect(kv.store).toEqual(before);
	});

	it('gives the rate-limit key a TTL and starts a new window after it', async () => {
		const kv = memoryKV();
		const puts = vi.spyOn(kv, 'put');
		await submit({ email: 'a@person.dev' }, { WAITLIST: kv });
		const rl = puts.mock.calls.find((c) => c[0] === 'rl:203.0.113.9');
		expect(rl?.[2]).toMatchObject({ expirationTtl: expect.any(Number) });
		// Age the window past its end: the counter must reset.
		kv.store.set('rl:203.0.113.9', `5:${Date.now() - 3601 * 1000}`);
		expect((await submit({ email: 'b@person.dev' }, { WAITLIST: kv })).success).toBe(true);
	});

	it('reports a KV failure instead of claiming success', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const kv = memoryKV();
		kv.put = async () => {
			throw new Error('quota');
		};
		expect(await submit({ email: 'a@person.dev' }, { WAITLIST: kv })).toEqual({
			success: false,
			error: 'Something broke. Try again.'
		});
	});
});

describe('page load', () => {
	it('passes through join status and configured providers', async () => {
		const url = new URL('https://ammoura.me/?join=ok&via=github');
		const data = await load(/** @type {any} */ ({ url, platform: { env: { GITHUB_CLIENT_ID: 'a', GITHUB_CLIENT_SECRET: 'b' } } }));
		expect(data).toEqual({ providers: [{ id: 'github', label: 'GitHub' }], join: 'ok', via: 'github' });
	});
});

describe('load: campaign code visits', () => {
	const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)';
	/** @param {string} search @param {Record<string, string>} headers */
	const run = async (search, headers) => {
		const kv = memoryKV();
		const puts = [];
		const wk = /** @type {any} */ ({ ...kv, getWithMetadata: async () => ({ metadata: null }), put: async (/** @type {string} */ k) => void puts.push(k) });
		await load(/** @type {any} */ ({
			platform: { env: { WAITLIST: wk } },
			url: new URL(`https://ammoura.me/${search}`),
			request: new Request('https://ammoura.me/', { headers }),
			getClientAddress: () => '9.9.9.9'
		}));
		return puts;
	};

	it('counts a document load that carries a code', async () => {
		expect(await run('?t=20261121-d', { 'user-agent': UA, 'sec-fetch-dest': 'document' })).toHaveLength(1);
	});

	it('does not count a data refetch, a bot, or a visit without a code', async () => {
		expect(await run('?t=20261121-d', { 'user-agent': UA, 'sec-fetch-dest': 'empty' })).toHaveLength(0);
		expect(await run('?t=20261121-d', { 'user-agent': 'curl/8' })).toHaveLength(0);
		expect(await run('', { 'user-agent': UA })).toHaveLength(0);
	});
});

describe('signup with SpaceBot connected', () => {
	const conf = { url: 'https://bot.example.com/api/hooks/abc', secret: 'sbw_s', enabled: true, events: { signup: true, test: true } };

	it('sends code, country and total, but no name or email', async () => {
		const kv = memoryKV();
		await kv.put('config:spacebot', JSON.stringify(conf));
		const f = vi.fn(async () => new Response(null, { status: 202 }));
		vi.stubGlobal('fetch', f);
		const res = await submit(
			{ email: 'a@person.dev', _clientData: '{"pageUrl":"https://ammoura.me/?t=20261121-d"}' },
			{ WAITLIST: kv },
			{ 'cf-ipcountry': 'NZ' }
		);
		expect(res).toMatchObject({ success: true });
		const call = /** @type {any} */ (f.mock.calls.find((c) => String(c[0]).includes('/api/hooks/')));
		const body = JSON.parse(call[1].body);
		expect(body).toMatchObject({ event: 'signup', code: '20261121-d', country: 'NZ', total: 1 });
		expect(call[1].body).not.toContain('person.dev');
	});

	it('still succeeds when SpaceBot is down', async () => {
		const kv = memoryKV();
		await kv.put('config:spacebot', JSON.stringify(conf));
		vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('down'); }));
		expect(await submit({ email: 'b@person.dev' }, { WAITLIST: kv })).toEqual({ success: true, email: 'b@person.dev' });
	});
});
