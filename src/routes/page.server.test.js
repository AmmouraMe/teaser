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
