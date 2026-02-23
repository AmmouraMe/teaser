const FAKE_NAMES = [
	'test', 'asdf', 'qwerty', 'fake', 'nobody', 'anonymous', 'anon',
	'user', 'admin', 'null', 'undefined', 'none', 'n/a', 'na', 'xxx',
	'abc', 'aaa', 'bbb', 'ccc', '123', 'john doe', 'jane doe', 'lorem'
];

const FAKE_DOMAINS = [
	'test.com', 'fake.com', 'example.com', 'mailinator.com', 'throwaway.email',
	'guerrillamail.com', 'yopmail.com', 'tempmail.com', 'trashmail.com',
	'disposable.com', 'sharklasers.com', 'guerrillamailblock.com', 'grr.la',
	'spam4.me', 'noemail.com', 'nomail.com', 'nomail.org', 'aol.com.invalid'
];

const FAKE_INSECURITIES = [
	'nothing', 'idk', "i don't know", 'none', 'n/a', 'na', 'no', 'nope',
	'not sure', 'unsure', 'whatever', 'everything', 'nothing really',
	'no insecurities', "i'm fine", 'nothing lol', 'lol', 'haha', 'ha',
	'test', 'asdf', 'qwerty', 'abc', '123', '...', '???', 'pass', 'skip',
	'rather not say', 'prefer not to say', 'none of your business'
];

function looksLie(value, list) {
	const v = value.trim().toLowerCase();
	return list.some((f) => v === f || v.startsWith(f + ' ') || v.endsWith(' ' + f));
}

function isLying(name, email, insecurity) {
	const nameLie =
		name.trim().length < 2 ||
		looksLie(name, FAKE_NAMES) ||
		/^[^a-zA-Z]+$/.test(name.trim()) ||
		/(.)\1{3,}/.test(name.trim());

	const emailDomain = email.includes('@') ? email.split('@')[1]?.toLowerCase() : '';
	const emailLie =
		!email.includes('@') ||
		!emailDomain ||
		FAKE_DOMAINS.includes(emailDomain) ||
		/^(test|fake|asdf|nope|no|none|null)\+?/.test(email.split('@')[0].toLowerCase());

	const insecurityLie =
		insecurity.trim().length < 5 ||
		looksLie(insecurity, FAKE_INSECURITIES) ||
		/(.)\1{4,}/.test(insecurity.trim());

	return nameLie || emailLie || insecurityLie;
}

/**
 * Send a waitlist entry to a Discord channel via webhook.
 * @param {string} webhookUrl
 * @param {{ name: string; email: string; insecurity: string; ts: string }} entry
 */
async function notifyDiscord(webhookUrl, entry) {
	const payload = {
		embeds: [
			{
				title: '🚀 New Waitlist Entry',
				color: 0xffffff,
				fields: [
					{ name: 'Name', value: entry.name, inline: true },
					{ name: 'Email', value: entry.email, inline: true },
					{ name: 'What\'s Stopping Them', value: entry.insecurity },
					{ name: 'Submitted', value: entry.ts, inline: true }
				]
			}
		]
	};

	const res = await fetch(webhookUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});

	if (!res.ok) {
		console.error('Discord webhook failed:', res.status, await res.text());
	}
}

/** @type {import('./$types').Actions} */
export const actions = {
	default: async ({ request, platform }) => {
		const data = await request.formData();
		const name = /** @type {string} */ (data.get('name') ?? '').toString().trim();
		const email = /** @type {string} */ (data.get('email') ?? '').toString().trim();
		const insecurity = /** @type {string} */ (data.get('insecurity') ?? '').toString().trim();

		// Server-side validation (mirrors client checks)
		if (!name || !email || !insecurity) {
			return { success: false, error: 'All fields are required.' };
		}

		if (isLying(name, email, insecurity)) {
			return { success: false, error: 'It knows.' };
		}

		const ts = new Date().toISOString();
		const entry = { name, email, insecurity, ts };

		// ── Persist to Cloudflare KV ──
		try {
			const kv = platform?.env?.WAITLIST;
			if (kv) {
				// Key by email (lower-cased) for natural dedup
				await kv.put(`entry:${email.toLowerCase()}`, JSON.stringify(entry));
			} else {
				console.warn('WAITLIST KV namespace not available (local dev?)');
			}
		} catch (err) {
			console.error('KV write failed:', err);
			return { success: false, error: 'Something broke. Try again.' };
		}

		// ── Notify Discord ──
		try {
			const webhookUrl = platform?.env?.DISCORD_WEBHOOK_URL;
			if (webhookUrl) {
				// Fire-and-forget so the user isn't blocked by Discord latency,
				// but we still await so the worker doesn't terminate the fetch.
				await notifyDiscord(webhookUrl, entry);
			} else {
				console.warn('DISCORD_WEBHOOK_URL not set');
			}
		} catch (err) {
			// Non-fatal — entry is already saved in KV
			console.error('Discord notify failed:', err);
		}

		return { success: true, email };
	}
};
