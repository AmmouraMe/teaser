/**
 * Per-client fixed-window rate limit, stored in the WAITLIST KV namespace.
 *
 * Workers share no memory, so the count has to live in KV. Every KV write
 * costs quota (1,000/day on the free plan), so the limiter is shaped to spend
 * as little as possible:
 *
 *   - checking costs one read and no write;
 *   - a rejected attempt costs nothing more;
 *   - only an attempt the caller actually accepts calls `consume()`, which is
 *     the one write, and that key expires on its own (`expirationTtl`).
 *
 * KV is eventually consistent, so a burst that lands on several edge locations
 * inside the same minute can get a few attempts past the limit. That is the
 * trade for not paying a write per check. It bounds a flood; it is not exact.
 *
 * Key: `ratelimit:<bucket>:<window>`. /admin lists only `entry:` keys, so these
 * never show up there.
 */

/** Signups accepted per client per window. */
export const SIGNUP_LIMIT = 5;
/** Window length in seconds. */
export const SIGNUP_WINDOW = 60 * 60;

/**
 * The client a request is counted against. IPv6 is bucketed by its /64,
 * because one subscriber is routinely handed a whole /64 and can rotate
 * through it for free.
 *
 * @param {Request} request
 * @param {{ getClientAddress?: () => string }} [event]
 * @returns {string}
 */
export function clientBucket(request, event) {
	let ip = request.headers.get('cf-connecting-ip');
	if (!ip && event?.getClientAddress) {
		try { ip = event.getClientAddress(); } catch { /* unavailable in some adapters */ }
	}
	if (!ip) return 'unknown';
	ip = ip.trim().toLowerCase();
	if (!ip.includes(':')) return ip;
	return `${expandV6(ip).slice(0, 4).join(':')}::/64`;
}

/**
 * Expand an IPv6 address into its eight hextets, leading zeros dropped, so
 * every spelling of one /64 lands in the same bucket.
 * @param {string} ip
 * @returns {string[]}
 */
function expandV6(ip) {
	const [head, tail] = ip.split('::');
	const h = head ? head.split(':') : [];
	const t = tail ? tail.split(':') : [];
	const fill = tail === undefined ? [] : Array(Math.max(0, 8 - h.length - t.length)).fill('0');
	return [...h, ...fill, ...t].map((x) => x.replace(/^0+(?=.)/, ''));
}

/**
 * @param {any} kv
 * @param {string} bucket
 * @param {{ limit?: number; window?: number; now?: number }} [opts]
 * @returns {Promise<{ allowed: boolean; consume: () => Promise<void> }>}
 */
export async function checkRateLimit(kv, bucket, opts = {}) {
	const limit = opts.limit ?? SIGNUP_LIMIT;
	const window = opts.window ?? SIGNUP_WINDOW;
	const now = opts.now ?? Date.now();

	if (!kv) return { allowed: true, consume: async () => {} };

	const slot = Math.floor(now / 1000 / window);
	const key = `ratelimit:${bucket}:${slot}`;
	const count = parseInt((await kv.get(key)) || '0', 10) || 0;

	return {
		allowed: count < limit,
		consume: async () => {
			// Live past the end of the window so the count never vanishes early.
			// KV refuses a TTL under 60 seconds.
			const ttl = Math.max(60, (slot + 1) * window - Math.floor(now / 1000) + 60);
			await kv.put(key, String(count + 1), { expirationTtl: ttl });
		}
	};
}
