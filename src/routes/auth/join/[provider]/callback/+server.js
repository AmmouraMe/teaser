import { redirect, error } from '@sveltejs/kit';
import { PROVIDERS, exchangeCode, fetchIdentity, STATE_COOKIE } from '$lib/oauth.js';
import { saveEntry, notifyJoin } from '$lib/waitlist.js';

/**
 * Finish an OAuth waitlist signup.
 *
 * Apple uses response_mode=form_post, so its callback arrives as a POST with
 * the code in the body. Everything else comes back as a GET with query params.
 * Both funnel into the same handler.
 */

/** @type {import('./$types').RequestHandler} */
export async function GET(event) {
	const { url } = event;
	return finish(event, url.searchParams.get('code'), url.searchParams.get('state'), {
		error: url.searchParams.get('error')
	});
}

/** @type {import('./$types').RequestHandler} */
export async function POST(event) {
	const form = await event.request.formData();
	return finish(event, String(form.get('code') ?? ''), String(form.get('state') ?? ''), {
		error: form.get('error') ? String(form.get('error')) : null
	});
}

/**
 * @param {any} event
 * @param {string | null} code
 * @param {string | null} state
 * @param {{ error: string | null }} extra
 */
async function finish({ params, url, platform, cookies, request, getClientAddress }, code, state, extra) {
	const provider = params.provider;
	if (!PROVIDERS.includes(provider)) throw error(404, 'Unknown provider');

	const back = (/** @type {string} */ status) => redirect(303, `/?join=${status}`);

	// The user declined on the provider's consent screen. Not an error.
	if (extra.error) return back('cancelled');
	if (!code) return back('failed');

	// CSRF: the state cookie must match what came back.
	const expected = cookies.get(STATE_COOKIE);
	cookies.delete(STATE_COOKIE, { path: '/' });
	if (!expected || expected !== `${provider}:${state}`) {
		console.warn(`join: state mismatch for ${provider}`);
		return back('failed');
	}

	const env = platform?.env ?? {};
	const redirectUri = `${url.origin}/auth/join/${provider}/callback`;

	const tokens = await exchangeCode(provider, { code, redirectUri, env });
	if (!tokens) return back('failed');

	const identity = await fetchIdentity(provider, tokens);
	// The provider authenticated them but gave us no email — a GitHub account
	// with nothing verified, or Apple's relay declined. Send them to the email
	// field rather than failing silently.
	if (!identity?.email) return back('noemail');

	/** @type {import('$lib/waitlist.js').WaitlistEntry} */
	const entry = {
		email: identity.email,
		ts: new Date().toISOString(),
		source: provider,
		provider: {
			id: identity.id,
			username: identity.username,
			email: identity.email,
			verified: Boolean(identity.verified)
		},
		server: {
			country: request.headers.get('cf-ipcountry') ?? null,
			userAgent: request.headers.get('user-agent') ?? null
		}
	};

	try {
		await saveEntry(env.WAITLIST, entry);
	} catch (err) {
		console.error('join: KV write failed', err);
		return back('failed');
	}

	await notifyJoin(env.DISCORD_WEBHOOK_URL, entry);
	return back('ok');
}
