import { redirect, error } from '@sveltejs/kit';
import { PROVIDERS, providerConfig, buildAuthorizeUrl, STATE_COOKIE } from '$lib/oauth.js';

/**
 * Start a waitlist signup via an OAuth provider.
 *
 * Distinct from /auth/discord, which is the admin login and is gated to a
 * single username. Nothing here grants access to anything.
 *
 * @type {import('./$types').RequestHandler}
 */
export async function GET({ params, url, platform, cookies }) {
	const provider = params.provider;
	if (!PROVIDERS.includes(provider)) throw error(404, 'Unknown provider');

	const config = providerConfig(provider);
	const clientId = platform?.env?.[config.idVar];
	if (!clientId) throw error(503, `${config.label} sign-in is not configured`);

	// CSRF: a random value echoed back by the provider and matched on return.
	const state = crypto.randomUUID();
	cookies.set(STATE_COOKIE, `${provider}:${state}`, {
		path: '/',
		httpOnly: true,
		sameSite: provider === 'apple' ? 'none' : 'lax', // Apple POSTs cross-site
		secure: url.protocol === 'https:',
		maxAge: 600
	});

	const redirectUri = `${url.origin}/auth/join/${provider}/callback`;
	redirect(302, buildAuthorizeUrl(provider, { clientId, redirectUri, state }));
}
