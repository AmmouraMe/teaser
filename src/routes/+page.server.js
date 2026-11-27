import { configuredProviders } from '$lib/oauth.js';
import {
	saveEntry,
	notifyJoin,
	isFakeEmail,
	collectServerData,
	parseClientData,
	hasSeenEmail,
	checkRateLimit,
	recordRateLimit
} from '$lib/waitlist.js';
import { recordCode, cleanCode } from '$lib/codes.js';
import { notifySignup } from '$lib/spacebot.js';

/** @type {import('./$types').PageServerLoad} */
export async function load({ platform, url, request, getClientAddress }) {
	// Count a visit through a ?t= code. A data refetch after a form action reloads
	// this with the same URL, so only the document request itself counts.
	const dest = url.searchParams.has('t') ? request.headers.get('sec-fetch-dest') : 'empty';
	if (url.searchParams.has('t') && (!dest || dest === 'document')) {
		let ip = request.headers.get('cf-connecting-ip');
		if (!ip) {
			try { ip = getClientAddress(); } catch { /* unavailable */ }
		}
		const counted = recordCode(platform?.env?.WAITLIST, {
			code: url.searchParams.get('t'),
			ip,
			userAgent: request.headers.get('user-agent')
		});
		// Do not make the visitor wait on KV.
		if (platform?.context?.waitUntil) platform.context.waitUntil(counted);
		else await counted;
	}

	// Only offer providers that actually have credentials — a button that
	// 503s is worse than no button.
	return {
		providers: configuredProviders(platform?.env),
		join: url.searchParams.get('join'),
		via: url.searchParams.get('via')
	};
}

/** @type {import('./$types').Actions} */
export const actions = {
	default: async (event) => {
		const { request, platform } = event;
		const data = await request.formData();
		const email = /** @type {string} */ (data.get('email') ?? '').toString().trim();

		// Email is the only field now — the form is one input and five buttons.
		if (!email) {
			return { success: false, error: 'Enter an email.' };
		}

		if (isFakeEmail(email)) {
			return { success: false, error: 'It knows.' };
		}

		// ── Collect all available data ──
		const ts = new Date().toISOString();
		const serverData = collectServerData(request, event);

		const clientData = parseClientData(data.get('_clientData'));

		const entry = {
			email,
			ts,
			source: 'email',
			server: serverData,
			client: clientData
		};

		const kv = platform?.env?.WAITLIST;
		const ip = serverData.ip;

		// Same writer and notifier as the OAuth join routes, so every path
		// keeps the KV shape /admin reads.
		try {
			// A repeat signup is a success that writes and posts nothing.
			if (await hasSeenEmail(kv, email)) return { success: true, email };

			// One read per attempt; the write happens only after a signup lands.
			const limit = await checkRateLimit(kv, ip);
			if (limit.limited) {
				return { success: false, error: 'Too many tries. Wait a while.' };
			}

			await saveEntry(kv, entry);
			await recordRateLimit(kv, ip, limit);
		} catch (err) {
			console.error('KV write failed:', err);
			return { success: false, error: 'Something broke. Try again.' };
		}

		// Never throws; the entry is already saved.
		await notifyJoin(platform?.env?.DISCORD_WEBHOOK_URL, entry);

		// Tell SpaceBot, if connected. No name or email. Never slows or breaks signup.
		const hook = (async () => {
			let code = null;
			try {
				code = cleanCode(new URL(String(clientData?.pageUrl ?? '')).searchParams.get('t'));
			} catch { /* no page URL */ }
			let total;
			try {
				const n = parseInt((await kv?.get('counter:unique_emails')) || '', 10);
				if (Number.isFinite(n)) total = n;
			} catch { /* omit */ }
			await notifySignup(kv, {
				code,
				country: serverData.country ?? null,
				...(total === undefined ? {} : { total })
			});
		})().catch(() => {});
		if (platform?.context?.waitUntil) platform.context.waitUntil(hook);
		else await hook;

		return { success: true, email };
	}
};
