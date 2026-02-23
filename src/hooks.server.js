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

	return resolve(event);
}
