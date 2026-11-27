import { describe, it, expect, vi } from 'vitest';
import { fetchTraffic, fetchCodes, parseCode, looksLikeBrowser, localDays } from './traffic.js';

const NOW = new Date('2026-11-20T12:00:00Z');

/** @param {unknown} body @param {number} [status] */
function reply(body, status = 200) {
	return new Response(JSON.stringify(body), { status });
}

const daily = {
	data: {
		viewer: {
			zones: [
				{
					series: [
						{
							dimensions: { date: '2026-11-18' },
							sum: { requests: 100, pageViews: 40, countryMap: [{ clientCountryName: 'US', requests: 80 }, { clientCountryName: 'CA', requests: 20 }] },
							uniq: { uniques: 30 }
						},
						{
							dimensions: { date: '2026-11-19' },
							sum: { requests: 50, pageViews: 20, countryMap: [{ clientCountryName: 'US', requests: 50 }] },
							uniq: { uniques: 10 }
						}
					]
				}
			]
		}
	}
};

const pages = {
	data: {
		viewer: {
			zones: [
				{
					pages: [
						{ count: 90, dimensions: { clientRequestPath: '/' } },
						{ count: 80, dimensions: { clientRequestPath: '/_app/immutable/x.js' } },
						{ count: 70, dimensions: { clientRequestPath: '/favicon.png' } },
						{ count: 60, dimensions: { clientRequestPath: '/admin' } },
						{ count: 5, dimensions: { clientRequestPath: '/terms' } }
					]
				}
			]
		}
	}
};

describe('fetchTraffic', () => {
	it('does nothing and says so when it is not configured', async () => {
		const f = vi.fn();
		const t = await fetchTraffic({ fetchImpl: /** @type {any} */ (f), now: NOW });
		expect(t.configured).toBe(false);
		expect(f).not.toHaveBeenCalled();
		expect(await fetchTraffic({ token: 'x', fetchImpl: /** @type {any} */ (f), now: NOW })).toMatchObject({ configured: false });
	});

	it('totals the days, ranks countries and lists only real pages', async () => {
		const f = vi.fn().mockResolvedValueOnce(reply(daily)).mockResolvedValueOnce(reply(pages));
		const t = await fetchTraffic({ token: 'tok', zoneId: 'zone', now: NOW, fetchImpl: /** @type {any} */ (f) });
		expect(t.configured).toBe(true);
		expect(t.error).toBeUndefined();
		expect(t.days).toEqual([
			{ date: '2026-11-18', requests: 100, pageViews: 40, visitors: 30 },
			{ date: '2026-11-19', requests: 50, pageViews: 20, visitors: 10 }
		]);
		expect(t.totals).toEqual({ pageViews7: 60, pageViews30: 60, visitors7: 40, visitors30: 40, requests30: 150 });
		expect(t.countries).toEqual([
			{ name: 'US', requests: 130 },
			{ name: 'CA', requests: 20 }
		]);
		expect(t.topPaths).toEqual([
			{ path: '/', views: 90 },
			{ path: '/terms', views: 5 }
		]);
	});

	it('sends the token as a bearer and asks for a 30 day window', async () => {
		const f = vi.fn().mockResolvedValue(reply(daily));
		await fetchTraffic({ token: 'tok', zoneId: 'zone', now: NOW, fetchImpl: /** @type {any} */ (f) });
		const [url, init] = f.mock.calls[0];
		expect(url).toBe('https://api.cloudflare.com/client/v4/graphql');
		expect(init.headers.authorization).toBe('Bearer tok');
		const body = JSON.parse(init.body);
		expect(body.variables).toEqual({ zone: 'zone', since: '2026-10-22', until: '2026-11-20' });
	});

	it('says what is wrong when Cloudflare refuses the token', async () => {
		const f = vi.fn().mockResolvedValue(reply({}, 403));
		const t = await fetchTraffic({ token: 'bad', zoneId: 'zone', now: NOW, fetchImpl: /** @type {any} */ (f) });
		expect(t.configured).toBe(true);
		expect(t.error).toMatch(/Analytics: Read/);
		expect(t.days).toEqual([]);
	});

	it('reports a GraphQL error from the daily query', async () => {
		const f = vi.fn().mockResolvedValue(reply({ errors: [{ message: 'zone not found' }] }));
		const t = await fetchTraffic({ token: 'tok', zoneId: 'nope', now: NOW, fetchImpl: /** @type {any} */ (f) });
		expect(t.error).toBe('zone not found');
	});

	it('keeps the main numbers when only the top pages query fails', async () => {
		const f = vi.fn().mockResolvedValueOnce(reply(daily)).mockResolvedValueOnce(reply({ errors: [{ message: 'not available on this plan' }] }));
		const t = await fetchTraffic({ token: 'tok', zoneId: 'zone', now: NOW, fetchImpl: /** @type {any} */ (f) });
		expect(t.error).toBeUndefined();
		expect(t.topPaths).toBeNull();
		expect(t.totals.visitors30).toBe(40);
	});

	it('survives a network failure', async () => {
		const f = vi.fn().mockRejectedValue(new Error('offline'));
		const t = await fetchTraffic({ token: 'tok', zoneId: 'zone', now: NOW, fetchImpl: /** @type {any} */ (f) });
		expect(t.error).toBe('offline');
	});
});

const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

describe('looksLikeBrowser', () => {
	it('accepts browsers and rejects scripts, scanners and previews', () => {
		expect(looksLikeBrowser(CHROME)).toBe(true);
		expect(looksLikeBrowser('curl/8.4.0')).toBe(false);
		expect(looksLikeBrowser('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe(false);
		expect(looksLikeBrowser('Hello from Palo Alto Networks, find out more about our scans')).toBe(false);
		expect(looksLikeBrowser('Mozilla/5.0 (compatible; CMS-Checker/1.0)')).toBe(false);
		expect(looksLikeBrowser('Mozilla/5.0 (Macintosh) Discordbot/2.0')).toBe(false);
		expect(looksLikeBrowser('')).toBe(false);
	});
});

describe('fetchTraffic, likely real visitors', () => {
	const NOW2 = new Date('2026-11-20T12:00:00Z');
	/** One reply for a day query: html rows for the first alias of the first chunk, JS fetches for it too. */
	function dayReply(/** @type {Record<string, any[]>} */ extra) {
		return reply({ data: { viewer: { zones: [extra] } } });
	}
	const row = (/** @type {string} */ ip, /** @type {string} */ ua, path = '/', count = 1, cc = 'US', vb = '') => ({
		count,
		dimensions: { clientIP: ip, userAgent: ua, clientRequestPath: path, clientCountryName: cc, verifiedBotCategory: vb }
	});

	it('keeps only a browser that also fetched the JavaScript, and counts distinct addresses', async () => {
		const today = [
			row('1.1.1.1', CHROME, '/', 3),
			row('1.1.1.1', CHROME, '/hammurabi', 1),
			row('2.2.2.2', CHROME, '/', 5), // never fetched the JS: a scanner reading HTML
			row('3.3.3.3', 'curl/8.4.0', '/', 9),
			row('4.4.4.4', CHROME, '/', 2, 'DE', 'Search Engine Crawler'),
			row('1.1.1.1', CHROME, '/admin', 7)
		];
		// Today is the last of 30 days, so it lands in the third chunk at alias 9.
		const f = vi
			.fn()
			.mockResolvedValueOnce(reply(daily)) // daily
			.mockResolvedValueOnce(reply(pages)) // top paths
			.mockResolvedValueOnce(dayReply({})) // days 1-10
			.mockResolvedValueOnce(dayReply({})) // days 11-20
			.mockResolvedValueOnce(dayReply({ h9: today, a9: [{ dimensions: { clientIP: '1.1.1.1' } }, { dimensions: { clientIP: '3.3.3.3' } }, { dimensions: { clientIP: '4.4.4.4' } }] }));
		const t = await fetchTraffic({ token: 'tok', zoneId: 'zone', now: NOW2, fetchImpl: /** @type {any} */ (f) });
		expect(t.human?.totals).toEqual({ visitors7: 1, visitors30: 1, pageViews7: 4, pageViews30: 4 });
		expect(t.human?.days.at(-1)).toEqual({ date: '2026-11-20', visitors: 1, pageViews: 4 });
		expect(t.human?.countries).toEqual([{ name: 'US', visitors: 1 }]);
		expect(t.human?.topPaths).toEqual([
			{ path: '/', views: 3 },
			{ path: '/hammurabi', views: 1 }
		]);
		// The raw numbers are untouched.
		expect(t.totals.visitors30).toBe(40);
	});

	it('asks for ten days at a time, because Cloudflare refuses more', async () => {
		const f = vi.fn().mockImplementation(async (/** @type {string} */ _u, /** @type {any} */ init) =>
			init.body.includes('httpRequests1dGroups') ? reply(daily) : dayReply({})
		);
		await fetchTraffic({ token: 'tok', zoneId: 'zone', now: NOW2, fetchImpl: /** @type {any} */ (f) });
		// daily + top paths + three day-chunks
		expect(f).toHaveBeenCalledTimes(5);
	});

	it('leaves human null when that query fails but keeps everything else', async () => {
		const f = vi
			.fn()
			.mockResolvedValueOnce(reply(daily))
			.mockResolvedValueOnce(reply(pages))
			.mockResolvedValue(reply({ errors: [{ message: 'nope' }] }));
		const t = await fetchTraffic({ token: 'tok', zoneId: 'zone', now: NOW2, fetchImpl: /** @type {any} */ (f) });
		expect(t.human).toBeNull();
		expect(t.error).toBeUndefined();
		expect(t.totals.visitors30).toBe(40);
	});
});

describe('localDays', () => {
	it('cuts days at local midnight, not UTC', () => {
		const days = localDays(new Date('2026-11-21T01:00:00Z'), 2, 'America/Phoenix');
		// 01:00 UTC on the 21st is 6pm on the 20th in Arizona (UTC-7, no DST).
		expect(days.map((d) => d.date)).toEqual(['2026-11-19', '2026-11-20']);
		expect(days[1]).toEqual({ date: '2026-11-20', start: '2026-11-20T07:00:00.000Z', end: '2026-11-21T06:59:59.000Z' });
	});

	it('handles a daylight saving change and an unknown zone', () => {
		const ny = localDays(new Date('2026-11-02T12:00:00Z'), 2, 'America/New_York');
		expect(ny[0]).toEqual({ date: '2026-11-01', start: '2026-11-01T04:00:00.000Z', end: '2026-11-02T04:59:59.000Z' }); // 25-hour day
		expect(localDays(new Date('2026-11-20T12:00:00Z'), 1, 'Not/AZone')[0].start).toBe('2026-11-20T00:00:00.000Z');
	});
});

describe('campaign codes', () => {
	const row = (/** @type {any} */ d, count = 1) => ({
		count,
		dimensions: { date: '2026-11-15', clientIP: '1.1.1.1', userAgent: 'Mozilla/5.0 (iPhone)', verifiedBotCategory: '', edgeResponseStatus: 200, edgeResponseContentTypeName: 'html', clientRequestQuery: '?t=20261121-d', ...d }
	});
	const hits = (/** @type {any[]} */ rows) => reply({ data: { viewer: { zones: [{ hits: rows }] } } });

	it('reads the t code from a query with or without the question mark', () => {
		expect(parseCode('?t=20261121-d')).toBe('20261121-d');
		expect(parseCode('a=1&t=x')).toBe('x');
		expect(parseCode('a=1')).toBeNull();
		expect(parseCode('t=' + 'x'.repeat(65))).toBeNull();
		expect(parseCode(/** @type {any} */ (undefined))).toBeNull();
	});

	it('is not configured without a token, and does not call out', async () => {
		const f = vi.fn();
		expect(await fetchCodes({ fetchImpl: f })).toEqual({ configured: false, codes: [] });
		expect(f).not.toHaveBeenCalled();
	});

	it('counts visits and distinct visitors per code, and ignores bots and previews', async () => {
		const f = vi.fn(async () =>
			hits([
				row({}, 2),
				row({ date: '2026-11-16', clientIP: '2.2.2.2' }),
				row({ userAgent: 'Slackbot-LinkExpanding 1.0' }),
				row({ verifiedBotCategory: 'Search Engine Crawler' }),
				row({ edgeResponseStatus: 304 }),
				row({ clientRequestQuery: 't=other' }),
				row({ clientRequestQuery: 'x=1' })
			])
		);
		const out = await fetchCodes({ token: 't', zoneId: 'z', now: NOW, fetchImpl: f });
		expect(out.error).toBeUndefined();
		const c = out.codes.find((x) => x.code === '20261121-d');
		expect(c).toMatchObject({ requests: 6, visits: 3, visitors: 2, first: '2026-11-15', last: '2026-11-16' });
		expect(c?.days).toEqual([
			{ date: '2026-11-15', visits: 2, visitors: 1 },
			{ date: '2026-11-16', visits: 1, visitors: 1 }
		]);
		expect(out.codes.map((x) => x.code)).toEqual(['20261121-d', 'other']);
	});

	it('reports a Cloudflare error instead of throwing', async () => {
		const out = await fetchCodes({ token: 't', zoneId: 'z', fetchImpl: async () => reply({}, 500) });
		expect(out).toMatchObject({ configured: true, codes: [] });
		expect(out.error).toContain('500');
	});
});
