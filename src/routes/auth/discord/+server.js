import { redirect } from '@sveltejs/kit';
import { ADMIN_STATE_COOKIE } from '$lib/auth.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url, platform, cookies }) {
	const clientId = platform?.env?.DISCORD_CLIENT_ID;
	if (!clientId) {
		return new Response('DISCORD_CLIENT_ID not configured', { status: 500 });
	}

	// CSRF: without a state bound to this browser, a crafted callback link
	// could complete someone else's authorization in it.
	const state = crypto.randomUUID();
	cookies.set(ADMIN_STATE_COOKIE, state, {
		path: '/auth/discord',
		httpOnly: true,
		secure: url.protocol === 'https:',
		sameSite: 'lax',
		maxAge: 600
	});

	const redirectUri = `${url.origin}/auth/discord/callback`;
	const params = new URLSearchParams({
		client_id: clientId,
		redirect_uri: redirectUri,
		response_type: 'code',
		scope: 'identify',
		state
	});

	redirect(302, `https://discord.com/api/oauth2/authorize?${params}`);
}
