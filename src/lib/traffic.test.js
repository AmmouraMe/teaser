import { describe, it, expect, vi } from 'vitest';
import { fetchTraffic } from './traffic.js';

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
