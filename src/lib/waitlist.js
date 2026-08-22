/**
 * Waitlist storage, shared by the email form and every OAuth join route.
 *
 * Both paths must write the same shape or /admin stops being able to read the
 * list. Keys:
 *   entry:<uid>             one submission
 *   seen_email:<email>      dedupe marker
 *   counter:unique_emails   running count of distinct emails
 */

/**
 * @typedef {object} WaitlistEntry
 * @property {string} email
 * @property {string} ts
 * @property {string} source          'email' or the provider id
 * @property {string} [name]
 * @property {string} [insecurity]
 * @property {object} [provider]      { id, username, email, verified }
 * @property {Record<string, any>} [server]
 * @property {Record<string, any>} [client]
 */

/**
 * Persist an entry. Returns whether this email had been seen before.
 *
 * A duplicate is still written — repeat signups are history, not errors — but
 * the unique counter only moves the first time.
 *
 * @param {any} kv
 * @param {WaitlistEntry} entry
 * @returns {Promise<{ stored: boolean; duplicate: boolean }>}
 */
export async function saveEntry(kv, entry) {
	if (!kv) {
		console.warn('WAITLIST KV namespace not available (local dev?)');
		return { stored: false, duplicate: false };
	}

	const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	await kv.put(`entry:${uid}`, JSON.stringify(entry));

	const emailKey = `seen_email:${entry.email.toLowerCase()}`;
	const alreadySeen = await kv.get(emailKey);
	if (!alreadySeen) {
		await kv.put(emailKey, '1');
		const current = parseInt((await kv.get('counter:unique_emails')) || '0', 10);
		await kv.put('counter:unique_emails', String(current + 1));
	}

	return { stored: true, duplicate: Boolean(alreadySeen) };
}

/**
 * Announce a signup to Discord. Never let this fail a signup — the entry is
 * already in KV by the time we get here.
 *
 * @param {string | undefined} webhookUrl
 * @param {WaitlistEntry} entry
 */
export async function notifyJoin(webhookUrl, entry) {
	if (!webhookUrl) return;

	const fields = [{ name: 'Email', value: entry.email, inline: true }];
	fields.push({ name: 'Via', value: entry.source, inline: true });
	if (entry.provider?.username) {
		fields.push({ name: 'Account', value: entry.provider.username, inline: true });
	}
	if (entry.server?.country) {
		fields.push({ name: 'Country', value: entry.server.country, inline: true });
	}

	try {
		const res = await fetch(webhookUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				embeds: [{ color: 0xff6a3d, title: '📥 New waitlist signup', fields }]
			})
		});
		if (!res.ok) {
			console.error('Discord webhook failed:', res.status);
		}
	} catch (err) {
		console.error('Discord webhook threw:', err);
	}
}
