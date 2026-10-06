import { describe, it, expect, vi } from 'vitest';
import { checkRateLimit, clientBucket, SIGNUP_LIMIT, SIGNUP_WINDOW } from './ratelimit.js';
import { memoryKV } from './kv.test-helper.js';

/** @param {Record<string, string>} headers */
const req = (headers = {}) => new Request('https://ammoura.me/', { headers });

describe('clientBucket', () => {
	it('uses CF-Connecting-IP', () => {
		expect(clientBucket(req({ 'cf-connecting-ip': '198.51.100.7' }))).toBe('198.51.100.7');
	});

	it('buckets IPv6 by /64 so a host cannot rotate through its prefix', () => {
		const a = clientBucket(req({ 'cf-connecting-ip': '2001:db8:abcd:12::1' }));
		const b = clientBucket(req({ 'cf-connecting-ip': '2001:0DB8:abcd:0012:ffff:1:2:3' }));
		expect(a).toBe('2001:db8:abcd:12::/64');
		expect(b).toBe(a);
		expect(clientBucket(req({ 'cf-connecting-ip': '2001:db8:abcd:13::1' }))).not.toBe(a);
	});

	it('falls back to the platform client address, then to one shared bucket', () => {
		expect(clientBucket(req(), { getClientAddress: () => '203.0.113.9' })).toBe('203.0.113.9');
		expect(clientBucket(req(), { getClientAddress: () => { throw new Error('no'); } })).toBe('unknown');
	});
});

describe('checkRateLimit', () => {
	const now = Date.UTC(2026, 9, 6, 12, 30);

	it('allows everything without KV', async () => {
		const rl = await checkRateLimit(undefined, 'x', { now });
		expect(rl.allowed).toBe(true);
		await expect(rl.consume()).resolves.toBeUndefined();
	});

	it('checking costs no write; consuming costs one, with an expiry', async () => {
		const kv = memoryKV();
		const put = vi.spyOn(kv, 'put');
		const rl = await checkRateLimit(kv, 'x', { now });
		expect(rl.allowed).toBe(true);
		expect(put).not.toHaveBeenCalled();

		await rl.consume();
		expect(put).toHaveBeenCalledOnce();
		const [key] = /** @type {any} */ (put.mock.calls[0]);
		expect(key).toMatch(/^ratelimit:x:\d+$/);
		expect(kv.store.get(key)).toBe('1');
		const ttl = kv.options.get(key).expirationTtl;
		expect(ttl).toBeGreaterThanOrEqual(60);
		expect(ttl).toBeLessThanOrEqual(SIGNUP_WINDOW + 60);
	});

	it('refuses once the limit is spent, and a new window starts fresh', async () => {
		const kv = memoryKV();
		for (let i = 0; i < SIGNUP_LIMIT; i++) {
			const rl = await checkRateLimit(kv, 'x', { now });
			expect(rl.allowed).toBe(true);
			await rl.consume();
		}
		expect((await checkRateLimit(kv, 'x', { now })).allowed).toBe(false);
		expect((await checkRateLimit(kv, 'y', { now })).allowed).toBe(true);
		expect((await checkRateLimit(kv, 'x', { now: now + SIGNUP_WINDOW * 1000 })).allowed).toBe(true);
	});

	it('treats a garbage count as zero rather than locking the client out', async () => {
		const kv = memoryKV();
		const slot = Math.floor(now / 1000 / SIGNUP_WINDOW);
		kv.store.set(`ratelimit:x:${slot}`, 'nonsense');
		expect((await checkRateLimit(kv, 'x', { now })).allowed).toBe(true);
	});
});
