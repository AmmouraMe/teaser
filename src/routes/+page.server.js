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

/** @type {import('./$types').PageServerLoad} */
export async function load({ platform, url }) {
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

		return { success: true, email };
	}
};
