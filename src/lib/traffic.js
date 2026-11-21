/**
 * Site traffic for /admin/traffic, read from Cloudflare's own analytics.
 *
 * ammoura.me sits behind Cloudflare, which already counts every request at the
 * edge. Reading those counts costs the visitor nothing and puts nothing on the
 * request path: no tracking script, no KV writes (the free KV plan allows 1,000
 * writes a day, which a launch spike would eat, and the waitlist needs them).
 *
 * It needs two settings, neither of which is in the repo:
 *   CF_API_TOKEN  an API token with "Analytics: Read" on the ammoura.me zone
 *   CF_ZONE_ID    the zone id (Cloudflare dashboard, zone Overview, right side)
 * Without them the page says what to add instead of showing zeros.
 *
 * Cloudflare counts requests, and "visitors" are its unique-IP estimate, so bots
 * and link previews are in those numbers. Read them as traffic, not as people.
 *
 * `human` is a second, stricter view of the same traffic. The free plan has no
 * bot score, so it is a rule of thumb, not a verdict: a real page load, from a
 * browser-looking user agent that is not a known bot or scanner, from an address
 * that also fetched the site's own JavaScript at some point in the window (a
 * scanner reads the HTML and leaves). It is still an estimate and says so.
 */

const GRAPHQL = 'https://api.cloudflare.com/client/v4/graphql';

/** @typedef {{ date: string, requests: number, pageViews: number, visitors: number }} TrafficDay */
/**
 * @typedef {{
 *   configured: boolean,
 *   error?: string,
 *   days: TrafficDay[],
 *   countries: Array<{ name: string, requests: number }>,
 *   topPaths: Array<{ path: string, views: number }> | null,
 *   totals: { pageViews7: number, pageViews30: number, visitors7: number, visitors30: number, requests30: number },
 *   human: Human | null
 * }} Traffic
 */
/**
 * @typedef {{
 *   days: Array<{ date: string, visitors: number, pageViews: number }>,
 *   countries: Array<{ name: string, visitors: number }>,
 *   topPaths: Array<{ path: string, views: number }>,
 *   totals: { visitors7: number, visitors30: number, pageViews7: number, pageViews30: number }
 * }} Human
 */

/** @param {Date} d */
function isoDate(d) {
	return d.toISOString().slice(0, 10);
}

/** @returns {Traffic} */
export function emptyTraffic() {
	return {
		configured: false,
		days: [],
		countries: [],
		topPaths: null,
		totals: { pageViews7: 0, pageViews30: 0, visitors7: 0, visitors30: 0, requests30: 0 },
		human: null
	};
}

/** User agents that announce a bot, a scanner, a link preview or a script. */
const BOT_UA =
	/bot|crawl|spider|scan|curl|wget|python|go-http|java|okhttp|headless|axios|fetch|monitor|preview|slurp|palo alto|censys|expanse|shodan|http-client|libwww|ahrefs|semrush|uptime|lighthouse|pingdom|facebookexternalhit|embedly|whatsapp|telegram|discord|slack|checker/i;

/** @param {string} ua A browser-looking user agent that does not announce itself as a bot. */
export function looksLikeBrowser(ua) {
	return /^Mozilla\//.test(ua) && !BOT_UA.test(ua);
}

/**
 * One GraphQL call. Throws with a readable message on a transport or API error.
 * @param {typeof fetch} fetchImpl
 * @param {string} token
 * @param {string} query
 * @param {Record<string, unknown>} variables
 */
async function gql(fetchImpl, token, query, variables) {
	const res = await fetchImpl(GRAPHQL, {
		method: 'POST',
		headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
		body: JSON.stringify({ query, variables })
	});
	if (res.status === 401 || res.status === 403) {
		throw new Error('Cloudflare refused the API token. Check that it has Analytics: Read on this zone.');
	}
	if (!res.ok) throw new Error(`Cloudflare analytics answered ${res.status}.`);
	const body = await res.json();
	if (body.errors?.length) throw new Error(String(body.errors[0]?.message ?? 'Cloudflare analytics error.'));
	return body.data;
}

const DAILY = `
query Daily($zone: String!, $since: Date!, $until: Date!) {
  viewer {
    zones(filter: { zoneTag: $zone }) {
      series: httpRequests1dGroups(
        limit: 40
        filter: { date_geq: $since, date_leq: $until }
        orderBy: [date_ASC]
      ) {
        dimensions { date }
        sum { requests pageViews countryMap { clientCountryName requests } }
        uniq { uniques }
      }
    }
  }
}`;

const PATHS = `
query Paths($zone: String!, $since: Time!, $until: Time!) {
  viewer {
    zones(filter: { zoneTag: $zone }) {
      pages: httpRequestsAdaptiveGroups(
        limit: 60
        filter: { datetime_geq: $since, datetime_leq: $until, requestSource: "eyeball" }
        orderBy: [count_DESC]
      ) {
        count
        dimensions { clientRequestPath }
      }
    }
  }
}`;

/** A path worth listing: a page, not an asset, and not the admin. */
function isPagePath(/** @type {string} */ p) {
	if (!p.startsWith('/')) return false;
	if (p.startsWith('/_app/') || p.startsWith('/admin') || p.startsWith('/auth/')) return false;
	return !/\.[a-z0-9]{2,5}$/i.test(p);
}

/**
 * Page loads and JS fetches for a run of days, one alias pair per day. Single
 * days come back exact; a month in one query is sampled into rounded counts, and
 * Cloudflare refuses more than about ten days of aliases at once.
 * @param {string[]} dates
 */
function dayQuery(dates) {
	const parts = dates.map((d, i) => {
		const w = `datetime_geq: "${d}T00:00:00Z", datetime_leq: "${d}T23:59:59Z", requestSource: "eyeball"`;
		return `h${i}: httpRequestsAdaptiveGroups(limit: 10000, filter: { ${w}, edgeResponseStatus: 200, edgeResponseContentTypeName: "html" }) { count dimensions { clientIP userAgent clientRequestPath clientCountryName verifiedBotCategory } }
		a${i}: httpRequestsAdaptiveGroups(limit: 10000, filter: { ${w}, clientRequestPath_like: "/_app/%" }) { dimensions { clientIP } }`;
	});
	return `query Day($zone: String!) { viewer { zones(filter: { zoneTag: $zone }) { ${parts.join('\n')} } } }`;
}

/**
 * @param {typeof fetch} fetchImpl
 * @param {string} token
 * @param {string} zoneId
 * @param {string[]} dates
 * @returns {Promise<Human>}
 */
async function fetchHuman(fetchImpl, token, zoneId, dates) {
	/** @type {Record<string, any[]>} */
	const pages = {};
	/** @type {Set<string>} */
	const jsIps = new Set();
	for (let i = 0; i < dates.length; i += 10) {
		const chunk = dates.slice(i, i + 10);
		const data = await gql(fetchImpl, token, dayQuery(chunk), { zone: zoneId });
		const z = data?.viewer?.zones?.[0] ?? {};
		chunk.forEach((d, j) => {
			pages[d] = z[`h${j}`] ?? [];
			for (const r of z[`a${j}`] ?? []) jsIps.add(r.dimensions.clientIP);
		});
	}

	/** @type {Human} */
	const human = { days: [], countries: [], topPaths: [], totals: { visitors7: 0, visitors30: 0, pageViews7: 0, pageViews30: 0 } };
	/** @type {Map<string, number>} */
	const paths = new Map();
	/** @type {Map<string, Set<string>>} */
	const countries = new Map();
	const all = new Set();
	const last7 = new Set();
	const recent = new Set(dates.slice(-7));
	for (const date of dates) {
		const ips = new Set();
		let views = 0;
		for (const r of pages[date]) {
			const d = r.dimensions;
			if (d.verifiedBotCategory || !looksLikeBrowser(d.userAgent) || !jsIps.has(d.clientIP)) continue;
			if (!isPagePath(d.clientRequestPath)) continue;
			views += r.count;
			ips.add(d.clientIP);
			paths.set(d.clientRequestPath, (paths.get(d.clientRequestPath) ?? 0) + r.count);
			if (!countries.has(d.clientCountryName)) countries.set(d.clientCountryName, new Set());
			countries.get(d.clientCountryName)?.add(d.clientIP);
		}
		human.days.push({ date, visitors: ips.size, pageViews: views });
		human.totals.pageViews30 += views;
		if (recent.has(date)) human.totals.pageViews7 += views;
		for (const ip of ips) {
			all.add(ip);
			if (recent.has(date)) last7.add(ip);
		}
	}
	// Distinct addresses over the whole window, so a person who comes back on
	// five days is one visitor, not five.
	human.totals.visitors30 = all.size;
	human.totals.visitors7 = last7.size;
	human.countries = [...countries]
		.map(([name, ips]) => ({ name, visitors: ips.size }))
		.sort((a, b) => b.visitors - a.visitors)
		.slice(0, 10);
	human.topPaths = [...paths]
		.map(([path, views]) => ({ path, views }))
		.sort((a, b) => b.views - a.views)
		.slice(0, 10);
	return human;
}

/**
 * @param {{ token?: string, zoneId?: string, days?: number, now?: Date, fetchImpl?: typeof fetch }} opts
 * @returns {Promise<Traffic>}
 */
export async function fetchTraffic({ token, zoneId, days = 30, now = new Date(), fetchImpl = fetch }) {
	const out = emptyTraffic();
	if (!token || !zoneId) return out;
	out.configured = true;

	const until = isoDate(now);
	const since = isoDate(new Date(now.getTime() - (days - 1) * 86400000));

	try {
		const data = await gql(fetchImpl, token, DAILY, { zone: zoneId, since, until });
		const rows = data?.viewer?.zones?.[0]?.series ?? [];
		/** @type {Map<string, number>} */
		const countries = new Map();
		for (const r of rows) {
			out.days.push({
				date: r.dimensions.date,
				requests: r.sum?.requests ?? 0,
				pageViews: r.sum?.pageViews ?? 0,
				visitors: r.uniq?.uniques ?? 0
			});
			for (const c of r.sum?.countryMap ?? []) {
				countries.set(c.clientCountryName, (countries.get(c.clientCountryName) ?? 0) + c.requests);
			}
		}
		out.countries = [...countries]
			.map(([name, requests]) => ({ name, requests }))
			.sort((a, b) => b.requests - a.requests)
			.slice(0, 10);
	} catch (err) {
		out.error = err instanceof Error ? err.message : 'Could not read Cloudflare analytics.';
		return out;
	}

	const last7 = out.days.slice(-7);
	const sum = (/** @type {TrafficDay[]} */ ds, /** @type {keyof TrafficDay} */ k) =>
		ds.reduce((n, d) => n + Number(d[k]), 0);
	out.totals = {
		pageViews7: sum(last7, 'pageViews'),
		pageViews30: sum(out.days, 'pageViews'),
		visitors7: sum(last7, 'visitors'),
		visitors30: sum(out.days, 'visitors'),
		requests30: sum(out.days, 'requests')
	};

	// Top pages come from a dataset with short retention, and the plan may not
	// include it. It is a nice-to-have, so a failure hides the table rather than
	// the whole page.
	try {
		const data = await gql(fetchImpl, token, PATHS, {
			zone: zoneId,
			since: new Date(now.getTime() - 86400000).toISOString(),
			until: now.toISOString()
		});
		const rows = data?.viewer?.zones?.[0]?.pages ?? [];
		out.topPaths = rows
			.map((/** @type {any} */ r) => ({ path: String(r.dimensions.clientRequestPath), views: Number(r.count) }))
			.filter((/** @type {{ path: string }} */ r) => isPagePath(r.path))
			.slice(0, 10);
	} catch {
		out.topPaths = null;
	}

	// The stricter view. Optional for the same reason: if it fails, the raw
	// numbers above still show.
	try {
		const dates = [];
		for (let i = days - 1; i >= 0; i--) dates.push(isoDate(new Date(now.getTime() - i * 86400000)));
		out.human = await fetchHuman(fetchImpl, token, zoneId, dates);
	} catch {
		out.human = null;
	}

	return out;
}
