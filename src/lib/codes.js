/**
 * Visits through a `?t=` campaign code, such as the one printed in a QR.
 *
 * Cloudflare's free plan does not expose the query string in its analytics, so
 * the page counts these itself. One KV key per code, visitor and day:
 *
 *   code:<code>:<yyyy-mm-dd>:<visitor>   metadata { n: visits that day }
 *
 * `visitor` is eight hex characters of a SHA-256 over the address and the code,
 * so the address is not stored and the same person on two codes is two keys.
 * Only codes shaped like `20261121-d` are counted, and only page loads from a
 * browser-looking client, so a bot or a typed guess cannot spend the free plan's
 * 1,000 writes a day. Reads and writes are not atomic: two visits in the same
 * instant can count once. That is fine for a tally and wrong for billing.
 */

import { looksLikeBrowser } from './traffic.js';

const CODE = /^\d{8}-[a-z0-9]{1,8}$/;
const KEEP_SECONDS = 90 * 86400;

/**
 * @param {string | null | undefined} raw
 * @returns {string | null}
 */
export function cleanCode(raw) {
	const c = String(raw ?? '').trim().toLowerCase();
	return CODE.test(c) ? c : null;
}

/** @param {string} text */
async function short(text) {
	const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
	return [...new Uint8Array(buf).slice(0, 4)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Count one visit. Never throws: a counter must not break the page.
 * @param {any} kv
 * @param {{ code: string | null | undefined, ip: string | null | undefined, userAgent: string | null | undefined, now?: Date }} visit
 * @returns {Promise<boolean>} whether a visit was counted
 */
export async function recordCode(kv, { code, ip, userAgent, now = new Date() }) {
	const c = cleanCode(code);
	if (!kv || !c || !ip || !looksLikeBrowser(String(userAgent ?? ''))) return false;
	try {
		const key = `code:${c}:${now.toISOString().slice(0, 10)}:${await short(`${ip}|${c}`)}`;
		const { metadata } = await kv.getWithMetadata(key);
		const n = Number(metadata?.n ?? 0) + 1;
		await kv.put(key, String(n), { metadata: { n }, expirationTtl: KEEP_SECONDS });
		return true;
	} catch {
		return false;
	}
}

/**
 * @typedef {{
 *   code: string, visits: number, visitors: number, signups: number, first: string, last: string,
 *   days: Array<{ date: string, visits: number, visitors: number }>
 * }} CodeTraffic
 */

/**
 * Signups by the code on the page they signed up from. Every email entry keeps
 * `client.pageUrl`, so this reaches back before the visit counter existed.
 * @param {any} kv
 * @returns {Promise<Map<string, { signups: number, first: string }>>}
 */
export async function signupsByCode(kv) {
	/** @type {Map<string, { signups: number, first: string }>} */
	const out = new Map();
	let cursor;
	let seen = 0;
	do {
		const page = await kv.list({ prefix: 'entry:', cursor });
		for (const k of page.keys) {
			if (++seen > 5000) return out;
			let entry;
			try {
				entry = JSON.parse((await kv.get(k.name)) ?? 'null');
			} catch {
				continue;
			}
			let code = null;
			try {
				code = cleanCode(new URL(String(entry?.client?.pageUrl ?? '')).searchParams.get('t'));
			} catch {
				/* no page URL, or not a URL */
			}
			if (!code) continue;
			const day = String(entry?.ts ?? '').slice(0, 10);
			const cur = out.get(code) ?? { signups: 0, first: day };
			cur.signups += 1;
			if (day && (!cur.first || day < cur.first)) cur.first = day;
			out.set(code, cur);
		}
		cursor = page.list_complete ? undefined : page.cursor;
	} while (cursor);
	return out;
}

/**
 * Every code's tally, most visited first.
 * @param {any} kv
 * @returns {Promise<{ configured: boolean, error?: string, codes: CodeTraffic[] }>}
 */
export async function readCodes(kv) {
	if (!kv) return { configured: false, codes: [] };
	try {
		/** @type {Map<string, Map<string, { visits: number, visitors: number }>>} */
		const byCode = new Map();
		let cursor;
		do {
			const page = await kv.list({ prefix: 'code:', cursor });
			for (const k of page.keys) {
				const [, code, date] = k.name.split(':');
				if (!code || !date) continue;
				if (!byCode.has(code)) byCode.set(code, new Map());
				const days = /** @type {Map<string, { visits: number, visitors: number }>} */ (byCode.get(code));
				const day = days.get(date) ?? { visits: 0, visitors: 0 };
				day.visits += Number(k.metadata?.n ?? 1);
				day.visitors += 1;
				days.set(date, day);
			}
			cursor = page.list_complete ? undefined : page.cursor;
		} while (cursor);

		const signups = await signupsByCode(kv).catch(() => new Map());
		for (const code of signups.keys()) if (!byCode.has(code)) byCode.set(code, new Map());

		const codes = [...byCode].map(([code, days]) => {
			const list = [...days].map(([date, d]) => ({ date, ...d })).sort((a, b) => a.date.localeCompare(b.date));
			return {
				code,
				visits: list.reduce((s, d) => s + d.visits, 0),
				// A person back on a second day is a second key, so this over-counts them.
				visitors: list.reduce((s, d) => s + d.visitors, 0),
				signups: signups.get(code)?.signups ?? 0,
				first: list[0]?.date ?? signups.get(code)?.first ?? '',
				last: list[list.length - 1]?.date ?? signups.get(code)?.first ?? '',
				days: list
			};
		});
		codes.sort((a, b) => b.visits - a.visits || b.signups - a.signups);
		return { configured: true, codes };
	} catch (err) {
		return { configured: true, error: err instanceof Error ? err.message : 'Could not read the code counts.', codes: [] };
	}
}
