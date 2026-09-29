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

	const resolved = await resolve(event);
	// Redirects and fetched responses can have immutable headers. Reuse the
	// body stream while making the headers writable before applying policy.
	const response = new Response(resolved.body, resolved);
	const pathname = event.url.pathname;
	const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/');
	const isAuth = pathname === '/auth' || pathname.startsWith('/auth/');

	// Prevent caching of HTML pages so browsers always get the latest
	// version (which references content-hashed JS/CSS assets).
	// This fixes stale pages on iOS Chrome, Cloudflare CDN, etc.
	const contentType = response.headers.get('content-type') || '';
	if (contentType.includes('text/html') || isAdmin || isAuth) {
		response.headers.set('cache-control', 'no-cache, no-store, must-revalidate');
		response.headers.set('pragma', 'no-cache');
		response.headers.set('expires', '0');
	}

	// _headers only reaches static assets; SSR responses get these here.
	response.headers.set('x-content-type-options', 'nosniff');
	// Additional CSP policies are enforced together, preserving any nonce,
	// script-src, or other restrictions already set by SvelteKit.
	if (isAdmin) {
		response.headers.set('x-frame-options', 'DENY');
		response.headers.append('content-security-policy', "frame-ancestors 'none'");
	}

	return response;
}
