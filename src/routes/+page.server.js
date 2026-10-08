import { configuredProviders } from '$lib/oauth.js';
import { saveEntry, notifyJoin, isFakeEmail, collectServerData, parseClientData } from '$lib/waitlist.js';
import { checkRateLimit, clientBucket } from '$lib/ratelimit.js';

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

		const kv = platform?.env?.WAITLIST;

		// Per-client limit. One KV read here; the write happens only if this
		// signup is actually stored, so rejected and repeat submissions cost no
		// writes at all.
		const limit = await checkRateLimit(kv, clientBucket(request, event)).catch((err) => {
			console.error('rate limit read failed:', err);
			return null;
		});
		if (limit && !limit.allowed) {
			return { success: false, error: 'Too many tries. Come back in an hour.' };
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

		// Same writer and notifier as the OAuth join routes, so every path
		// keeps the KV shape /admin reads.
		let saved;
		try {
			saved = await saveEntry(kv, entry);
		} catch (err) {
			console.error('KV write failed:', err);
			return { success: false, error: 'Something broke. Try again.' };
		}

		// A repeat of an email already on the list wrote nothing. Answer the
		// same as a first signup, so the form does not reveal who is on the list.
		if (saved.duplicate) return { success: true, email };

		if (saved.stored && limit) {
			try {
				await limit.consume();
			} catch (err) {
				console.error('rate limit write failed:', err);
			}
		}

		// Never throws; the entry is already saved.
		await notifyJoin(platform?.env?.DISCORD_WEBHOOK_URL, entry);

		return { success: true, email };
	}
};
