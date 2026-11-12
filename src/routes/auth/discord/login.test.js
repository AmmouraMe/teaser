import { describe, it, expect, vi, afterEach } from 'vitest';
import { GET as start } from './+server.js';
import { GET as callback } from './callback/+server.js';
import { ADMIN_STATE_COOKIE, COOKIE_NAME, verifySession } from '$lib/auth.js';

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

const env = { DISCORD_CLIENT_ID: 'cid', DISCORD_CLIENT_SECRET: 'secret' };

function jar() {
	/** @type {Map<string, string>} */
	const values = new Map();
	return {
		values,
		/** @param {string} n */ get: (n) => values.get(n),
		/** @param {string} n @param {string} v */ set: (n, v) => void values.set(n, v),
		/** @param {string} n */ delete: (n) => void values.delete(n)
	};
}

/** @param {string} username */
function stubDiscord(username) {
	vi.stubGlobal(
		'fetch',
		vi.fn(async (/** @type {string} */ url) =>
			String(url).endsWith('/oauth2/token')
				? Response.json({ access_token: 't' })
				: Response.json({ id: '1', username })
		)
	);
}

/** @param {() => any} fn */
async function thrown(fn) {
	try {
		await fn();
	} catch (e) {
		return /** @type {any} */ (e);
	}
	throw new Error('expected a throw');
}

describe('admin login', () => {
	it('sends Discord a state and remembers it', async () => {
		const cookies = jar();
		const r = await thrown(() => start(/** @type {any} */ ({ url: new URL('https://ammoura.me/auth/discord'), platform: { env }, cookies })));
		const state = new URL(r.location).searchParams.get('state');
		expect(state).toBeTruthy();
		expect(cookies.values.get(ADMIN_STATE_COOKIE)).toBe(state);
	});

	it('refuses a callback whose state does not match', async () => {
		const cookies = jar();
		cookies.set(ADMIN_STATE_COOKIE, 'mine');
		stubDiscord('davis9001');
		const url = new URL('https://ammoura.me/auth/discord/callback?code=c&state=theirs');
		const e = await thrown(() => callback(/** @type {any} */ ({ url, platform: { env }, cookies })));
		expect(e.status).toBe(400);
		expect(cookies.values.has(COOKIE_NAME)).toBe(false);
	});

	it('refuses a callback with no state cookie', async () => {
		stubDiscord('davis9001');
		const url = new URL('https://ammoura.me/auth/discord/callback?code=c&state=x');
		const e = await thrown(() => callback(/** @type {any} */ ({ url, platform: { env }, cookies: jar() })));
		expect(e.status).toBe(400);
	});

	it('signs in the allowed user when state matches', async () => {
		const cookies = jar();
		cookies.set(ADMIN_STATE_COOKIE, 's');
		stubDiscord('davis9001');
		const url = new URL('https://ammoura.me/auth/discord/callback?code=c&state=s');
		const r = await thrown(() => callback(/** @type {any} */ ({ url, platform: { env }, cookies })));
		expect(r.location).toBe('/admin');
		expect(cookies.values.has(ADMIN_STATE_COOKIE)).toBe(false);
		expect(await verifySession(cookies.values.get(COOKIE_NAME), env.DISCORD_CLIENT_SECRET)).toEqual({ username: 'davis9001' });
	});

	it('refuses anyone else', async () => {
		const cookies = jar();
		cookies.set(ADMIN_STATE_COOKIE, 's');
		stubDiscord('someone');
		const url = new URL('https://ammoura.me/auth/discord/callback?code=c&state=s');
		const e = await thrown(() => callback(/** @type {any} */ ({ url, platform: { env }, cookies })));
		expect(e.status).toBe(403);
		expect(cookies.values.has(COOKIE_NAME)).toBe(false);
	});
});
