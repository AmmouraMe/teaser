import { redirect, fail } from '@sveltejs/kit';

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals, platform }) {
	if (!locals.user) {
		redirect(302, '/auth/discord');
	}

	const kv = platform?.env?.WAITLIST;
	/** @type {Array<{ name: string; email: string; insecurity: string; ts: string; archived?: boolean; discord?: { id: string; username: string; globalName?: string; linkedAt: string }; server?: Record<string, any>; client?: Record<string, any> }>} */
	const allEntries = [];

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
						const parsed = JSON.parse(value);
						parsed._kvKey = key.name;
						allEntries.push(parsed);
					} catch {
						// skip malformed entries
					}
				}
			}
			cursor = list.list_complete ? undefined : list.cursor;
		} while (cursor);

		// Newest first
		allEntries.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
	}

	const entries = allEntries.filter((e) => !e.archived);
	const archivedEntries = allEntries.filter((e) => e.archived);

	// Compute stats from active (non-archived) entries only
	const emails = new Set(entries.map((e) => e.email?.toLowerCase()).filter(Boolean));
	const discords = new Set(entries.map((e) => e.discord?.id).filter(Boolean));
	const uniqueEmails = emails.size;
	const uniqueDiscords = discords.size;

	return { entries, archivedEntries, user: locals.user, uniqueEmails, uniqueDiscords };
}

/** @type {import('./$types').Actions} */
export const actions = {
	archive: async ({ request, locals, platform }) => {
		if (!locals.user) return fail(401);
		const kv = platform?.env?.WAITLIST;
		if (!kv) return fail(500, { error: 'KV not available' });

		const formData = await request.formData();
		const kvKey = formData.get('kvKey');
		if (!kvKey) return fail(400, { error: 'Missing key' });

		const raw = await kv.get(/** @type {string} */ (kvKey));
		if (!raw) return fail(404, { error: 'Entry not found' });

		try {
			const entry = JSON.parse(raw);
			entry.archived = true;
			await kv.put(/** @type {string} */ (kvKey), JSON.stringify(entry));
		} catch {
			return fail(500, { error: 'Failed to archive entry' });
		}
	},

	unarchive: async ({ request, locals, platform }) => {
		if (!locals.user) return fail(401);
		const kv = platform?.env?.WAITLIST;
		if (!kv) return fail(500, { error: 'KV not available' });

		const formData = await request.formData();
		const kvKey = formData.get('kvKey');
		if (!kvKey) return fail(400, { error: 'Missing key' });

		const raw = await kv.get(/** @type {string} */ (kvKey));
		if (!raw) return fail(404, { error: 'Entry not found' });

		try {
			const entry = JSON.parse(raw);
			delete entry.archived;
			await kv.put(/** @type {string} */ (kvKey), JSON.stringify(entry));
		} catch {
			return fail(500, { error: 'Failed to unarchive entry' });
		}
	}
};
