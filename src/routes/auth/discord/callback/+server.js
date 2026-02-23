import { redirect, error } from '@sveltejs/kit';
import { createSession, COOKIE_NAME } from '$lib/auth.js';

const ALLOWED_USER = 'davis9001';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url, platform, cookies }) {
	const code = url.searchParams.get('code');
	if (!code) throw error(400, 'Missing authorization code');

	const clientId = platform?.env?.DISCORD_CLIENT_ID;
	const clientSecret = platform?.env?.DISCORD_CLIENT_SECRET;
	if (!clientId || !clientSecret) {
		throw error(500, 'Discord OAuth not configured');
	}

	const redirectUri = `${url.origin}/auth/discord/callback`;

	// Exchange authorization code for access token
	const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			client_id: clientId,
			client_secret: clientSecret,
			grant_type: 'authorization_code',
			code,
			redirect_uri: redirectUri
		})
	});

	if (!tokenRes.ok) {
		console.error('Discord token exchange failed:', tokenRes.status, await tokenRes.text());
		throw error(401, 'Failed to authenticate with Discord');
	}

	const tokenData = await tokenRes.json();

	// Fetch the authenticated user's profile
	const userRes = await fetch('https://discord.com/api/users/@me', {
		headers: { Authorization: `Bearer ${tokenData.access_token}` }
	});

	if (!userRes.ok) {
		throw error(401, 'Failed to fetch Discord user');
	}

	const user = await userRes.json();

	// Only allow the designated admin
	if (user.username !== ALLOWED_USER) {
		throw error(403, `Access denied. You are not ${ALLOWED_USER}.`);
	}

	// Create signed session cookie
	const session = await createSession(user.username, clientSecret);
	cookies.set(COOKIE_NAME, session, {
		path: '/',
		httpOnly: true,
		secure: url.protocol === 'https:',
		sameSite: 'lax',
		maxAge: 7 * 24 * 60 * 60 // 7 days
	});

	redirect(302, '/admin');
}
