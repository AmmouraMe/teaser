import { describe, it, expect, vi, afterEach } from 'vitest';
import { actions, load } from './+page.server.js';
import { memoryKV } from '$lib/kv.test-helper.js';
import { SIGNUP_LIMIT } from '$lib/ratelimit.js';

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

describe('waitlist abuse limits', () => {
	/** @param {string} ip */
	const from = (ip) => ({ 'cf-connecting-ip': ip });

	it('a repeat email writes nothing and posts nothing, but still says yes', async () => {
		const f = vi.fn(async () => new Response(null, { status: 204 }));
		vi.stubGlobal('fetch', f);
		const kv = memoryKV();
		const env = { WAITLIST: kv, DISCORD_WEBHOOK_URL: 'https://hook' };

		await submit({ email: 'a@person.dev' }, env, from('198.51.100.1'));
		const before = new Map(kv.store);
		const put = vi.spyOn(kv, 'put');

		const res = await submit({ email: 'A@Person.dev' }, env, from('198.51.100.2'));
		expect(res).toEqual({ success: true, email: 'A@Person.dev' });
		expect(put).not.toHaveBeenCalled();
		expect(kv.store).toEqual(before);
		expect(f).toHaveBeenCalledOnce();
	});

	it('refuses a client past the limit without writing or posting', async () => {
		const f = vi.fn(async () => new Response(null, { status: 204 }));
		vi.stubGlobal('fetch', f);
		const kv = memoryKV();
		const env = { WAITLIST: kv, DISCORD_WEBHOOK_URL: 'https://hook' };

		for (let i = 0; i < SIGNUP_LIMIT; i++) {
			expect(await submit({ email: `p${i}@person.dev` }, env, from('198.51.100.1'))).toMatchObject({ success: true });
		}
		expect(f).toHaveBeenCalledTimes(SIGNUP_LIMIT);

		const put = vi.spyOn(kv, 'put');
		const res = await submit({ email: 'one-more@person.dev' }, env, from('198.51.100.1'));
		expect(res).toEqual({ success: false, error: 'Too many tries. Come back in an hour.' });
		expect(put).not.toHaveBeenCalled();
		expect(f).toHaveBeenCalledTimes(SIGNUP_LIMIT);
		expect(kv.store.get('counter:unique_emails')).toBe(String(SIGNUP_LIMIT));

		// Someone else is unaffected.
		expect(await submit({ email: 'other@person.dev' }, env, from('198.51.100.2'))).toMatchObject({ success: true });
	});

	it('spends exactly one extra write per accepted signup on the limiter', async () => {
		const kv = memoryKV();
		const put = vi.spyOn(kv, 'put');
		await submit({ email: 'a@person.dev' }, { WAITLIST: kv }, from('198.51.100.1'));
		const keys = put.mock.calls.map((c) => /** @type {any} */ (c)[0]);
		expect(keys.filter((k) => k.startsWith('ratelimit:'))).toHaveLength(1);
		expect(keys).toHaveLength(4); // entry, seen_email, counter, ratelimit
	});

	it('repeat emails do not use up the limit', async () => {
		const kv = memoryKV();
		const env = { WAITLIST: kv };
		for (let i = 0; i < SIGNUP_LIMIT * 2; i++) {
			await submit({ email: 'same@person.dev' }, env, from('198.51.100.1'));
		}
		expect(await submit({ email: 'new@person.dev' }, env, from('198.51.100.1'))).toMatchObject({ success: true });
	});

	it('still takes a signup when the limiter read fails', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const kv = memoryKV();
		const get = kv.get.bind(kv);
		kv.get = async (k) => {
			if (k.startsWith('ratelimit:')) throw new Error('kv down');
			return get(k);
		};
		expect(await submit({ email: 'a@person.dev' }, { WAITLIST: kv })).toMatchObject({ success: true });
	});
});

describe('page load', () => {
	it('passes through join status and configured providers', async () => {
		const url = new URL('https://ammoura.me/?join=ok&via=github');
		const data = await load(/** @type {any} */ ({ url, platform: { env: { GITHUB_CLIENT_ID: 'a', GITHUB_CLIENT_SECRET: 'b' } } }));
		expect(data).toEqual({ providers: [{ id: 'github', label: 'GitHub' }], join: 'ok', via: 'github' });
	});
});
