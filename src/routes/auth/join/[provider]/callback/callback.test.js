import { describe, it, expect, vi, afterEach } from 'vitest';
import { memoryKV } from '$lib/kv.test-helper.js';

vi.mock('$lib/oauth.js', async (orig) => ({
	.../** @type {any} */ (await orig()),
	exchangeCode: vi.fn(async () => ({ access_token: 't' })),
	fetchIdentity: vi.fn(async () => ({ id: '1', username: 'sam', email: 'Sam@Person.dev', verified: true }))
}));

const { GET } = await import('./+server.js');

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

/** @param {Record<string, any>} env */
async function join(env) {
	const cookies = {
		get: () => 'github:abc',
		delete: () => {}
	};
	const event = {
		params: { provider: 'github' },
		url: new URL('https://ammoura.me/auth/join/github/callback?code=c&state=abc'),
		platform: { env },
		cookies,
		request: new Request('https://ammoura.me/'),
		getClientAddress: () => '203.0.113.9'
	};
	try {
		await GET(/** @type {any} */ (event));
	} catch (r) {
		return /** @type {any} */ (r).location;
	}
}

describe('OAuth join callback', () => {
	it('stores the first signup and announces it', async () => {
		const f = vi.fn(async () => new Response(null, { status: 204 }));
		vi.stubGlobal('fetch', f);
		const kv = memoryKV();
		expect(await join({ WAITLIST: kv, DISCORD_WEBHOOK_URL: 'https://hook' })).toBe('/?join=ok&via=github');
		expect(kv.store.get('counter:unique_emails')).toBe('1');
		expect(f).toHaveBeenCalledOnce();
	});

	it('sends the visitor back with "failed" when the provider call throws', async () => {
		const oauth = await import('$lib/oauth.js');
		vi.mocked(oauth.exchangeCode).mockRejectedValueOnce(new Error('network down'));
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const kv = memoryKV();
		expect(await join({ WAITLIST: kv })).toBe('/?join=failed');
		expect(kv.store.size).toBe(0);

		vi.mocked(oauth.fetchIdentity).mockRejectedValueOnce(new SyntaxError('bad json'));
		expect(await join({ WAITLIST: kv })).toBe('/?join=failed');
		expect(kv.store.size).toBe(0);
	});

	it('treats a repeat signup as success without writing or posting', async () => {
		const f = vi.fn(async () => new Response(null, { status: 204 }));
		vi.stubGlobal('fetch', f);
		const kv = memoryKV();
		const env = { WAITLIST: kv, DISCORD_WEBHOOK_URL: 'https://hook' };
		await join(env);
		const before = new Map(kv.store);
		expect(await join(env)).toBe('/?join=ok&via=github');
		expect(kv.store).toEqual(before);
		expect(f).toHaveBeenCalledOnce();
	});
});
