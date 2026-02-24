import { COOKIE_NAME, verifySession } from '$lib/auth.js';

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
	const sessionCookie = event.cookies.get(COOKIE_NAME);
	const secret = event.platform?.env?.DISCORD_CLIENT_SECRET;

	if (sessionCookie && secret) {
		const session = await verifySession(sessionCookie, secret);
		if (session) {
			event.locals.user = session;
		}
	}

	const response = await resolve(event);

	// Prevent caching of HTML pages so browsers always get the latest
	// version (which references content-hashed JS/CSS assets).
	// This fixes stale pages on iOS Chrome, Cloudflare CDN, etc.
	const contentType = response.headers.get('content-type') || '';
	if (contentType.includes('text/html')) {
		response.headers.set('cache-control', 'no-cache, no-store, must-revalidate');
		response.headers.set('pragma', 'no-cache');
		response.headers.set('expires', '0');
	}

	return response;
}
