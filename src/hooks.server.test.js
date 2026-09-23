import { describe, it, expect } from 'vitest';
import { handle } from './hooks.server.js';
import { createSession, COOKIE_NAME } from '$lib/auth.js';

const SECRET = 'secret';

/**
 * @param {string} path
 * @param {string | undefined} cookie
 * @param {string} [type]
 */
async function run(path, cookie, type = 'text/html') {
	const event = /** @type {any} */ ({
		url: new URL(`https://ammoura.me${path}`),
		cookies: { get: (/** @type {string} */ n) => (n === COOKIE_NAME ? cookie : undefined) },
		platform: { env: { DISCORD_CLIENT_SECRET: SECRET } },
		locals: {}
	});
	const response = await handle({
		event,
		resolve: async () => new Response('ok', { headers: { 'content-type': type } })
	});
	return { event, response };
}

describe('hooks handle', () => {
	it('populates locals.user from a valid admin cookie only', async () => {
		const good = await createSession('davis9001', SECRET);
		expect((await run('/', good)).event.locals.user).toEqual({ username: 'davis9001' });
		expect((await run('/', 'forged.sig')).event.locals.user).toBeUndefined();
		expect((await run('/', undefined)).event.locals.user).toBeUndefined();
	});

	it('stops HTML being cached and sets nosniff', async () => {
		const { response } = await run('/', undefined);
		expect(response.headers.get('cache-control')).toBe('no-cache, no-store, must-revalidate');
		expect(response.headers.get('x-content-type-options')).toBe('nosniff');
		expect(response.headers.get('x-frame-options')).toBeNull();
	});

	it('leaves non-HTML caching alone', async () => {
		const { response } = await run('/sitemap.xml', undefined, 'application/xml');
		expect(response.headers.get('cache-control')).toBeNull();
	});

	it('refuses to let /admin be framed', async () => {
		for (const path of ['/admin', '/admin/x']) {
			const { response } = await run(path, undefined);
			expect(response.headers.get('x-frame-options')).toBe('DENY');
			expect(response.headers.get('content-security-policy')).toBe("frame-ancestors 'none'");
		}
		expect((await run('/administrator', undefined)).response.headers.get('x-frame-options')).toBeNull();
	});
});
