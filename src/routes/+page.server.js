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
	const s = entry.server || {};
	const c = entry.client || {};

	/**
	 * Build a formatted field string from an object, picking only the given keys
	 * that have non-null, non-empty values.
	 */
	function pickLines(obj, keys) {
		if (!obj) return '';
		return keys
			.filter(k => obj[k] !== null && obj[k] !== undefined && obj[k] !== '' && obj[k] !== 'null')
			.map(k => {
				const v = typeof obj[k] === 'object' ? JSON.stringify(obj[k]) : String(obj[k]);
				return `**${k}:** ${v}`;
			})
			.join('\n');
	}

	/** Build a formatted field string from all non-null entries in an object */
	function allLines(obj) {
		if (!obj || typeof obj !== 'object') return '';
		return Object.entries(obj)
			.filter(([, v]) => v !== null && v !== undefined && v !== '' && v !== 'null')
			.map(([k, v]) => {
				const val = typeof v === 'object' ? JSON.stringify(v) : String(v);
				return `**${k}:** ${val}`;
			})
			.join('\n');
	}

	// -- Server key groups (same as admin page) --
	const geoKeys = ['ip', 'country', 'city', 'region', 'regionCode', 'continent', 'postalCode', 'latitude', 'longitude', 'timezone', 'metroCode'];
	const netKeys = ['asn', 'asOrganization', 'tlsVersion', 'tlsCipher', 'httpProtocol'];
	const reqKeys = ['userAgent', 'acceptLanguage', 'referer', 'origin', 'secFetchDest', 'secFetchMode', 'secFetchSite', 'secChUa', 'secChUaMobile', 'secChUaPlatform', 'secChUaPlatformVersion', 'secChUaArch', 'secChUaModel', 'secChUaFullVersion', 'dnt', 'cfRay', 'cfVisitor'];

	// -- Client key groups (same as admin page) --
	const screenKeys = ['screenWidth', 'screenHeight', 'screenAvailWidth', 'screenAvailHeight', 'colorDepth', 'pixelDepth', 'devicePixelRatio', 'viewportWidth', 'viewportHeight', 'screenOrientation'];
	const localeKeys = ['timezone', 'timezoneOffset', 'language', 'languages', 'localTime'];
	const hwKeys = ['platform', 'userAgent', 'hardwareConcurrency', 'deviceMemory', 'maxTouchPoints', 'webglRenderer', 'pluginCount', 'canvasHash'];
	const featKeys = ['cookieEnabled', 'doNotTrack', 'pdfViewerEnabled', 'webdriver', 'onLine', 'touchSupport', 'prefersDarkMode', 'prefersReducedMotion'];
	const connKeys = ['connectionType', 'connectionEffectiveType', 'connectionDownlink', 'connectionRtt', 'connectionSaveData'];
	const refKeys = ['referrer', 'pageUrl', 'utmSource', 'utmMedium', 'utmCampaign', 'utmTerm', 'utmContent'];

	// Build embeds — Discord allows up to 10 embeds per message and 25 fields per embed.
	// We split into multiple embeds to fit everything.

	// ── Embed 1: Core info + Server geo/network ──
	const embed1Fields = [
		{ name: 'Name', value: entry.name, inline: true },
		{ name: 'Email', value: entry.email, inline: true },
		{ name: 'Submitted', value: entry.ts, inline: true },
		{ name: "What's Stopping Them", value: entry.insecurity }
	];

	const geoBlock = pickLines(s, geoKeys);
	if (geoBlock) embed1Fields.push({ name: '\uD83C\uDF0D Location & Geo', value: geoBlock });

	const netBlock = pickLines(s, netKeys);
	if (netBlock) embed1Fields.push({ name: '\uD83D\uDD12 Network & Security', value: netBlock });

	const botBlock = s.botManagement ? allLines(s.botManagement) : '';
	if (botBlock) embed1Fields.push({ name: '\uD83E\uDD16 Bot Detection', value: botBlock.slice(0, 1024) });

	const reqBlock = pickLines(s, reqKeys);
	if (reqBlock) embed1Fields.push({ name: '\uD83D\uDCE8 Request Info', value: reqBlock.slice(0, 1024) });

	// ── Embed 2: Client data ──
	const embed2Fields = [];

	const screenBlock = pickLines(c, screenKeys);
	if (screenBlock) embed2Fields.push({ name: '\uD83D\uDDA5\uFE0F Screen & Viewport', value: screenBlock });

	const localeBlock = pickLines(c, localeKeys);
	if (localeBlock) embed2Fields.push({ name: '\uD83D\uDD52 Locale & Time', value: localeBlock });

	const hwBlock = pickLines(c, hwKeys);
	if (hwBlock) embed2Fields.push({ name: '\u2699\uFE0F Platform & Hardware', value: hwBlock.slice(0, 1024) });

	const featBlock = pickLines(c, featKeys);
	if (featBlock) embed2Fields.push({ name: '\uD83E\uDDE9 Features & Preferences', value: featBlock });

	const connBlock = pickLines(c, connKeys);
	if (connBlock) embed2Fields.push({ name: '\uD83D\uDCE1 Connection', value: connBlock });

	const refBlock = pickLines(c, refKeys);
	if (refBlock) embed2Fields.push({ name: '\uD83D\uDD17 Referrer & UTM', value: refBlock });

	// ── Embed 3 (optional): Raw Headers ──
	const embeds = [
		{ title: '\uD83D\uDE80 New Waitlist Entry', color: 0xffffff, fields: embed1Fields }
	];

	if (embed2Fields.length > 0) {
		embeds.push({ color: 0xffffff, fields: embed2Fields });
	}

	if (s.rawHeaders) {
		const headersJson = JSON.stringify(s.rawHeaders, null, 2);
		// Discord embed description max is 4096 chars
		embeds.push({
			color: 0xffffff,
			title: '\uD83D\uDCC4 Raw Headers',
			description: '```json\n' + headersJson.slice(0, 4000) + '\n```'
		});
	}

	const payload = { embeds };

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
				// Unique key per submission so repeat signups are never overwritten
				const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
				await kv.put(`entry:${uid}`, JSON.stringify(entry));
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
