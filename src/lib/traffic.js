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
 * and link previews are in the numbers. Read them as traffic, not as people.
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
 *   totals: { pageViews7: number, pageViews30: number, visitors7: number, visitors30: number, requests30: number }
 * }} Traffic
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
		totals: { pageViews7: 0, pageViews30: 0, visitors7: 0, visitors30: 0, requests30: 0 }
	};
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

	return out;
}
