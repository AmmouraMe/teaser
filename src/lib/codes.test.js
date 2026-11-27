import { describe, it, expect, vi } from 'vitest';
import { cleanCode, recordCode, readCodes, signupsByCode } from './codes.js';

/** KV with metadata, which the shared helper does not have. */
function kvWithMeta() {
	/** @type {Map<string, { v: string, metadata: any }>} */
	const store = new Map();
	return {
		store,
		/** @param {string} k */
		async getWithMetadata(k) {
			const e = store.get(k);
			return { value: e?.v ?? null, metadata: e?.metadata ?? null };
		},
		/** @param {string} k @param {string} v @param {{ metadata?: any }} o */
		async put(k, v, o) {
			store.set(k, { v, metadata: o?.metadata });
		},
		/** @param {string} k */
		async get(k) {
			return store.get(k)?.v ?? null;
		},
		/** @param {{ prefix?: string }} o */
		async list(o) {
			const keys = [...store].filter(([k]) => k.startsWith(o.prefix ?? '')).map(([name, e]) => ({ name, metadata: e.metadata }));
			return { keys, list_complete: true };
		}
	};
}

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)';
const NOW = new Date('2026-11-21T20:00:00Z');

describe('cleanCode', () => {
	it('accepts the printed shape and nothing else', () => {
		expect(cleanCode('20261121-d')).toBe('20261121-d');
		expect(cleanCode(' 20261121-D ')).toBe('20261121-d');
		for (const bad of ['', null, undefined, 'x', '2026-11-21', '20261121-', '20261121-toolongcode', '../../etc']) {
			expect(cleanCode(/** @type {any} */ (bad))).toBeNull();
		}
	});
});

describe('recordCode', () => {
	it('counts a visit, and a repeat from the same visitor adds to the same key', async () => {
		const kv = kvWithMeta();
		const v = { code: '20261121-d', ip: '1.1.1.1', userAgent: UA, now: NOW };
		expect(await recordCode(kv, v)).toBe(true);
		expect(await recordCode(kv, v)).toBe(true);
		expect(await recordCode(kv, { ...v, ip: '2.2.2.2' })).toBe(true);
		expect(kv.store.size).toBe(2);
		expect([...kv.store.keys()][0]).toMatch(/^code:20261121-d:2026-11-21:[0-9a-f]{8}$/);
		expect([...kv.store.values()].map((e) => e.metadata.n).sort()).toEqual([1, 2]);
	});

	it('never stores the address', async () => {
		const kv = kvWithMeta();
		await recordCode(kv, { code: '20261121-d', ip: '203.0.113.9', userAgent: UA, now: NOW });
		expect(JSON.stringify([...kv.store])).not.toContain('203.0.113.9');
	});

	it('ignores bots, unknown codes, missing addresses and a missing namespace', async () => {
		const kv = kvWithMeta();
		const ok = { code: '20261121-d', ip: '1.1.1.1', userAgent: UA, now: NOW };
		expect(await recordCode(kv, { ...ok, userAgent: 'Slackbot-LinkExpanding 1.0' })).toBe(false);
		expect(await recordCode(kv, { ...ok, userAgent: null })).toBe(false);
		expect(await recordCode(kv, { ...ok, code: 'anything' })).toBe(false);
		expect(await recordCode(kv, { ...ok, ip: null })).toBe(false);
		expect(await recordCode(null, ok)).toBe(false);
		expect(kv.store.size).toBe(0);
	});

	it('does not throw when KV fails', async () => {
		const kv = { getWithMetadata: vi.fn().mockRejectedValue(new Error('down')) };
		expect(await recordCode(kv, { code: '20261121-d', ip: '1.1.1.1', userAgent: UA })).toBe(false);
	});
});

describe('readCodes', () => {
	it('is not configured without a namespace', async () => {
		expect(await readCodes(null)).toEqual({ configured: false, codes: [] });
	});

	it('totals visits and visitors per code and day, most visited first', async () => {
		const kv = kvWithMeta();
		const at = (/** @type {string} */ d) => new Date(`${d}T12:00:00Z`);
		await recordCode(kv, { code: '20261121-d', ip: '1.1.1.1', userAgent: UA, now: at('2026-11-15') });
		await recordCode(kv, { code: '20261121-d', ip: '1.1.1.1', userAgent: UA, now: at('2026-11-15') });
		await recordCode(kv, { code: '20261121-d', ip: '2.2.2.2', userAgent: UA, now: at('2026-11-16') });
		await recordCode(kv, { code: '20261121-e', ip: '3.3.3.3', userAgent: UA, now: at('2026-11-16') });
		kv.store.set('code:junk', { v: '1', metadata: null });
		const out = await readCodes(kv);
		expect(out.error).toBeUndefined();
		expect(out.codes.map((c) => c.code)).toEqual(['20261121-d', '20261121-e']);
		expect(out.codes[0]).toMatchObject({ visits: 3, visitors: 2, first: '2026-11-15', last: '2026-11-16' });
		expect(out.codes[0].days).toEqual([
			{ date: '2026-11-15', visits: 2, visitors: 1 },
			{ date: '2026-11-16', visits: 1, visitors: 1 }
		]);
	});

	it('follows the list cursor and reports a failure instead of throwing', async () => {
		const pages = [
			{ keys: [{ name: 'code:20261121-d:2026-11-15:aaaaaaaa', metadata: { n: 1 } }], list_complete: false, cursor: 'c1' },
			{ keys: [{ name: 'code:20261121-d:2026-11-15:bbbbbbbb', metadata: { n: 2 } }], list_complete: true }
		];
		const list = vi.fn(async () => /** @type {any} */ (pages.shift()));
		const out = await readCodes({ list });
		expect(out.codes[0]).toMatchObject({ visits: 3, visitors: 2 });
		// Two pages of counts, then the signup scan, which this fake has nothing for.
		expect(list.mock.calls.filter(([o]) => /** @type {any} */ (o).prefix === 'code:')).toHaveLength(2);
		const bad = await readCodes({ list: vi.fn().mockRejectedValue(new Error('kv down')) });
		expect(bad).toMatchObject({ configured: true, codes: [], error: 'kv down' });
	});
});

describe('signups by code', () => {
	/** @param {any} kv @param {string} id @param {any} entry */
	const entry = (kv, id, entry) => kv.store.set(`entry:${id}`, { v: JSON.stringify(entry), metadata: null });

	it('counts signups by the code on the page they came from, before any visit was counted', async () => {
		const kv = kvWithMeta();
		entry(kv, '1', { ts: '2026-11-14T10:00:00Z', client: { pageUrl: 'https://ammoura.me/?t=20261121-d' } });
		entry(kv, '2', { ts: '2026-11-13T10:00:00Z', client: { pageUrl: 'https://ammoura.me/?t=20261121-d&utm_source=qr' } });
		entry(kv, '3', { ts: '2026-11-15T10:00:00Z', client: { pageUrl: 'https://ammoura.me/' } });
		entry(kv, '4', { ts: '2026-11-15T10:00:00Z', client: { pageUrl: 'not a url' } });
		entry(kv, '5', { ts: '2026-11-15T10:00:00Z' });
		kv.store.set('entry:6', { v: '{bad', metadata: null });
		const out = await signupsByCode(kv);
		expect([...out]).toEqual([['20261121-d', { signups: 2, first: '2026-11-13' }]]);
		const all = await readCodes(kv);
		expect(all.codes).toEqual([
			expect.objectContaining({ code: '20261121-d', visits: 0, visitors: 0, signups: 2, first: '2026-11-13', days: [] })
		]);
	});
});
