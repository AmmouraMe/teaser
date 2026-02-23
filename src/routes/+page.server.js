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
 * @param {{ name: string; email: string; insecurity: string; ts: string; server: Record<string, any>; client: Record<string, any> }} entry
 */
async function notifyDiscord(webhookUrl, entry) {
	const geo = [entry.server.city, entry.server.region, entry.server.country].filter(Boolean).join(', ') || 'Unknown';
	const device = entry.client.platform || entry.server.secChUaPlatform || 'Unknown';
	const screen = entry.client.screenWidth ? `${entry.client.screenWidth}x${entry.client.screenHeight} @${entry.client.devicePixelRatio}x` : 'Unknown';
	const tz = entry.client.timezone || entry.server.timezone || 'Unknown';
	const lang = entry.client.language || 'Unknown';
	const conn = entry.client.connectionEffectiveType || 'Unknown';
	const referrer = entry.client.referrer || entry.server.referer || 'Direct';
	const utm = [entry.client.utmSource, entry.client.utmMedium, entry.client.utmCampaign].filter(Boolean).join(' / ') || 'None';
	const isp = entry.server.asOrganization || 'Unknown';

	const payload = {
		embeds: [
			{
				title: '\uD83D\uDE80 New Waitlist Entry',
				color: 0xffffff,
				fields: [
					{ name: 'Name', value: entry.name, inline: true },
					{ name: 'Email', value: entry.email, inline: true },
					{ name: 'What\'s Stopping Them', value: entry.insecurity },
					{ name: '\uD83C\uDF0D Location', value: geo, inline: true },
					{ name: '\uD83D\uDCF1 Device', value: device, inline: true },
					{ name: '\uD83D\uDDA5\uFE0F Screen', value: screen, inline: true },
					{ name: '\uD83D\uDD52 Timezone', value: tz, inline: true },
					{ name: '\uD83C\uDF10 Language', value: lang, inline: true },
					{ name: '\uD83D\uDCE1 Connection', value: conn, inline: true },
					{ name: '\uD83D\uDD17 Referrer', value: referrer, inline: true },
					{ name: '\uD83D\uDCCA UTM', value: utm, inline: true },
					{ name: '\uD83C\uDFE2 ISP', value: isp, inline: true },
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

/**
 * Extract all available data from the request and Cloudflare context.
 * @param {Request} request
 * @param {any} platform
 * @param {{ getClientAddress?: () => string }} [event]
 * @returns {Record<string, any>}
 */
function collectServerData(request, platform, event) {
	const headers = Object.fromEntries(request.headers.entries());

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

/** @type {import('./$types').Actions} */
export const actions = {
	default: async (event) => {
		const { request, platform } = event;
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

		// ── Collect all available data ──
		const ts = new Date().toISOString();
		const serverData = collectServerData(request, platform, event);

		// Parse client-side collected data
		let clientData = {};
		try {
			const raw = data.get('_clientData');
			if (raw) clientData = JSON.parse(raw.toString());
		} catch { /* ignore malformed client data */ }

		const entry = {
			name,
			email,
			insecurity,
			ts,
			server: serverData,
			client: clientData
		};

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
