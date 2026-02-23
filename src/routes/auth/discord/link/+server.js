import { redirect, error } from '@sveltejs/kit';

/**
 * Initiates Discord OAuth for a waitlist user so they can link their
 * Discord account for early-access notifications.
 *
 * The email is carried through the OAuth round-trip inside a signed
 * `state` parameter to prevent tampering.
 */

/** @type {import('./$types').RequestHandler} */
export async function GET({ url, platform }) {
	const email = url.searchParams.get('email');
	if (!email) throw error(400, 'Missing email');

	const clientId = platform?.env?.DISCORD_CLIENT_ID;
	const clientSecret = platform?.env?.DISCORD_CLIENT_SECRET;
	if (!clientId || !clientSecret) {
		throw error(500, 'Discord OAuth not configured');
	}

	// Sign the email so the callback can trust it
	const state = await signState(email, clientSecret);

	const redirectUri = `${url.origin}/auth/discord/link/callback`;
	const params = new URLSearchParams({
		client_id: clientId,
		redirect_uri: redirectUri,
		response_type: 'code',
		scope: 'identify',
		state
	});

	redirect(302, `https://discord.com/api/oauth2/authorize?${params}`);
}

/**
 * Encode + HMAC-sign the email so the callback can verify it.
 * Format: base64(email).base64(signature)
 * @param {string} email
 * @param {string} secret
 */
async function signState(email, secret) {
	const encoder = new TextEncoder();
	const payload = btoa(email);
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
	const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
	return `${payload}.${sigB64}`;
}
