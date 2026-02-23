import { redirect } from '@sveltejs/kit';

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals, platform }) {
	if (!locals.user) {
		redirect(302, '/auth/discord');
	}

	const kv = platform?.env?.WAITLIST;
	/** @type {Array<{ name: string; email: string; insecurity: string; ts: string; discord?: { id: string; username: string; globalName?: string; linkedAt: string }; server?: Record<string, any>; client?: Record<string, any> }>} */
	const entries = [];

	let uniqueEmails = 0;
	let uniqueDiscords = 0;

	if (kv) {
		let cursor = undefined;
		// Paginate through all KV keys
		do {
			/** @type {KVNamespaceListResult<unknown>} */
			const list = await kv.list({ prefix: 'entry:', cursor });
			for (const key of list.keys) {
				const value = await kv.get(key.name);
				if (value) {
					try {
						entries.push(JSON.parse(value));
					} catch {
						// skip malformed entries
					}
				}
			}
			cursor = list.list_complete ? undefined : list.cursor;
		} while (cursor);

		// Newest first
		entries.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

		// Read persistent counters
		try {
			const emailCount = await kv.get('counter:unique_emails');
			const discordCount = await kv.get('counter:unique_discords');
			uniqueEmails = emailCount ? parseInt(emailCount, 10) : 0;
			uniqueDiscords = discordCount ? parseInt(discordCount, 10) : 0;
		} catch {
			// Fall back to computing from entries if counters unavailable
			const emails = new Set(entries.map((e) => e.email?.toLowerCase()).filter(Boolean));
			const discords = new Set(
				entries.map((e) => e.discord?.id).filter(Boolean)
			);
			uniqueEmails = emails.size;
			uniqueDiscords = discords.size;
		}

		// If counters haven't been initialised yet, compute from entries
		if (uniqueEmails === 0 && entries.length > 0) {
			const emails = new Set(entries.map((e) => e.email?.toLowerCase()).filter(Boolean));
			const discords = new Set(
				entries.map((e) => e.discord?.id).filter(Boolean)
			);
			uniqueEmails = emails.size;
			uniqueDiscords = discords.size;
		}
	}

	return { entries, user: locals.user, uniqueEmails, uniqueDiscords };
}
