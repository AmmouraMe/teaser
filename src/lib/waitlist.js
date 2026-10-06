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

// ── Email-form helpers ───────────────────────────────────────────────────────

const FAKE_DOMAINS = [
	'test.com', 'fake.com', 'example.com', 'mailinator.com', 'throwaway.email',
	'guerrillamail.com', 'yopmail.com', 'tempmail.com', 'trashmail.com',
	'disposable.com', 'sharklasers.com', 'guerrillamailblock.com', 'grr.la',
	'spam4.me', 'noemail.com', 'nomail.com', 'nomail.org', 'aol.com.invalid'
];

/**
 * Obviously fake or disposable addresses. The OAuth routes never call this —
 * a provider-verified email is real by definition.
 * @param {string} email
 */
export function isFakeEmail(email) {
	// RFC 5321 caps a forward-path at 254 characters; anything longer is not
	// deliverable and would only bloat the KV entry and the dedupe key.
	if (email.length > 254) return true;
	const at = email.lastIndexOf('@');
	if (at < 1) return true;
	const local = email.slice(0, at).toLowerCase();
	const domain = email.slice(at + 1).toLowerCase();
	return (
		!domain ||
		!domain.includes('.') ||
		/\s/.test(email) ||
		FAKE_DOMAINS.includes(domain) ||
		// The whole local part, optionally with a +tag. Unanchored, this used to
		// turn away noah@, nora@, tessa@ … anyone whose name began with "no" or
		// "test".
		/^(test|fake|asdf|nope|no|none|null)(\+.*)?$/.test(local)
	);
}

const CREDENTIAL_HEADERS = ['cookie', 'authorization', 'proxy-authorization', 'cf-access-jwt-assertion'];

/** Upper bound on the browser-supplied `_clientData` blob, in characters. */
export const MAX_CLIENT_DATA = 16 * 1024;

/**
 * Parse the form's `_clientData` field. It is whatever the browser sent, so
 * anything that is not a plain JSON object of reasonable size is dropped.
 * @param {FormDataEntryValue | null} raw
 * @returns {Record<string, any>}
 */
export function parseClientData(raw) {
	if (typeof raw !== 'string' || !raw || raw.length > MAX_CLIENT_DATA) return {};
	try {
		const parsed = JSON.parse(raw);
		return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
	} catch {
		return {};
	}
}

/**
 * Everything the request and Cloudflare's `cf` object say about the visitor.
 * Stored on the entry as `server`; /admin renders it.
 *
 * @param {Request} request
 * @param {{ getClientAddress?: () => string }} [event]
 * @returns {Record<string, any>}
 */
export function collectServerData(request, event) {
	const headers = Object.fromEntries(request.headers.entries());
	// Credentials never go into the waitlist. `cookie` carries admin_session
	// when the admin submits the form, and the entry is rendered on /admin.
	for (const h of CREDENTIAL_HEADERS) delete headers[h];

	// Cloudflare-specific headers & properties
	const cf = /** @type {any} */ (request).cf || {};

	// Try multiple sources for client IP
	let clientIp = headers['cf-connecting-ip'] || headers['x-forwarded-for'] || headers['x-real-ip'] || null;
	if (!clientIp && event?.getClientAddress) {
		try { clientIp = event.getClientAddress(); } catch { /* may throw if unavailable */ }
	}

	return {
		// IP & network
		ip: clientIp,
		// Geo (from Cloudflare)
		country: headers['cf-ipcountry'] || cf.country || null,
		city: cf.city || null,
		region: cf.region || null,
		regionCode: cf.regionCode || null,
		continent: cf.continent || null,
		postalCode: cf.postalCode || null,
		latitude: cf.latitude || null,
		longitude: cf.longitude || null,
		timezone: cf.timezone || null,
		metroCode: cf.metroCode || null,
		// Network info
		asn: cf.asn || null,
		asOrganization: cf.asOrganization || null,
		// TLS / security
		tlsVersion: cf.tlsVersion || null,
		tlsCipher: cf.tlsCipher || null,
		httpProtocol: cf.httpProtocol || null,
		// Bot detection
		botManagement: cf.botManagement || null,
		// Request info
		userAgent: headers['user-agent'] || null,
		acceptLanguage: headers['accept-language'] || null,
		referer: headers['referer'] || null,
		origin: headers['origin'] || null,
		secFetchDest: headers['sec-fetch-dest'] || null,
		secFetchMode: headers['sec-fetch-mode'] || null,
		secFetchSite: headers['sec-fetch-site'] || null,
		secChUa: headers['sec-ch-ua'] || null,
		secChUaMobile: headers['sec-ch-ua-mobile'] || null,
		secChUaPlatform: headers['sec-ch-ua-platform'] || null,
		secChUaPlatformVersion: headers['sec-ch-ua-platform-version'] || null,
		secChUaArch: headers['sec-ch-ua-arch'] || null,
		secChUaModel: headers['sec-ch-ua-model'] || null,
		secChUaFullVersion: headers['sec-ch-ua-full-version'] || null,
		dnt: headers['dnt'] || null,
		cfRay: headers['cf-ray'] || null,
		cfVisitor: headers['cf-visitor'] || null,
		// All raw headers (for anything we may have missed)
		rawHeaders: headers
	};
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
