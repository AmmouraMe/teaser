import { redirect } from '@sveltejs/kit';

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals, platform }) {
	if (!locals.user) {
		redirect(302, '/auth/discord');
	}

	const kv = platform?.env?.WAITLIST;
	/** @type {Array<{ name: string; email: string; insecurity: string; ts: string }>} */
	const entries = [];

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
	}

	return { entries, user: locals.user };
}
