import { configuredProviders } from '$lib/oauth.js';
import { saveEntry, notifyJoin, isFakeEmail, collectServerData } from '$lib/waitlist.js';

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

		// Parse client-side collected data
		let clientData = {};
		try {
			const raw = data.get('_clientData');
			if (raw) clientData = JSON.parse(raw.toString());
		} catch { /* ignore malformed client data */ }

		const entry = {
			email,
			ts,
			source: 'email',
			server: serverData,
			client: clientData
		};

		// Same writer and notifier as the OAuth join routes, so every path
		// keeps the KV shape /admin reads.
		try {
			await saveEntry(platform?.env?.WAITLIST, entry);
		} catch (err) {
			console.error('KV write failed:', err);
			return { success: false, error: 'Something broke. Try again.' };
		}

		// Never throws; the entry is already saved.
		await notifyJoin(platform?.env?.DISCORD_WEBHOOK_URL, entry);

		return { success: true, email };
	}
};
