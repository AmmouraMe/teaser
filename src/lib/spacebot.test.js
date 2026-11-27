import { describe, it, expect, vi } from 'vitest';
import { memoryKV } from './kv.test-helper.js';
import { validateHookUrl, buildEvent, sendToSpaceBot, publicConfig, notifySignup, CONFIG_KEY } from './spacebot.js';

describe('validateHookUrl', () => {
	const good = ['https://bot.example.com/api/hooks/abc123', 'https://bot.example.com/api/hooks/abc_1-2/'];
	const bad = [
		'', '   ', 'nope', 'http://bot.example.com/api/hooks/abc', 'https://u:p@bot.example.com/api/hooks/abc',
		'https://u@bot.example.com/api/hooks/abc', 'https://bot.example.com/', 'https://bot.example.com/api/hooks/',
		'https://bot.example.com/api/hooks/a/b', 'https://bot.example.com/x/api/hooks/abc', 'ftp://bot.example.com/api/hooks/abc',
		'javascript:alert(1)', 'https://bot.example.com/api/hooks/a b'
	];
	it.each(good)('accepts %s', (u) => expect(validateHookUrl(u).ok).toBe(true));
	it.each(bad)('rejects %j with a message', (u) => {
		const r = validateHookUrl(u);
		expect(r.ok).toBe(false);
		expect(r.ok === false && r.error.length).toBeGreaterThan(5);
	});
	it('never throws on odd input', () => {
		const odd = [null, undefined, 5, {}, [], '\u0000', 'https://', 'https://[', '%%%', 'a'.repeat(100000), '\ud800'];
		for (const v of odd) expect(() => validateHookUrl(v)).not.toThrow();
	});
	it('strips query and trailing slash', () => {
		const r = validateHookUrl('https://bot.example.com/api/hooks/abc/?x=1');
		expect(r).toEqual({ ok: true, url: 'https://bot.example.com/api/hooks/abc' });
	});
});

describe('buildEvent', () => {
	it('has source, event and an ISO time', () => {
		const e = buildEvent('signup', { code: 'x', total: 3 });
		expect(e).toMatchObject({ source: 'ammoura-teaser', event: 'signup', code: 'x', total: 3 });
		expect(new Date(e.at).toISOString()).toBe(e.at);
	});
});

describe('sendToSpaceBot', () => {
	const cfg = { url: 'https://bot.example.com/api/hooks/abc', secret: 'sbw_secret' };
	it('sends the bearer secret and reports ok', async () => {
		const f = vi.fn(async () => new Response(null, { status: 202 }));
		expect(await sendToSpaceBot(cfg, { a: 1 }, /** @type {any} */ (f))).toEqual({ ok: true, status: 202 });
		const init = /** @type {any} */ (f.mock.calls[0])[1];
		expect(init.headers.authorization).toBe('Bearer sbw_secret');
	});
	it('does not throw on a fetch error, and leaks no secret', async () => {
		const f = async () => { throw new Error('boom sbw_secret'); };
		const r = await sendToSpaceBot(cfg, {}, /** @type {any} */ (f));
		expect(r.ok).toBe(false);
		expect(JSON.stringify(r)).not.toContain('sbw_secret');
	});
	it('reports a non-2xx', async () => {
		const r = await sendToSpaceBot(cfg, {}, /** @type {any} */ (async () => new Response('no', { status: 429 })));
		expect(r).toMatchObject({ ok: false, status: 429 });
	});
});

describe('publicConfig', () => {
	it('never carries the secret', () => {
		const p = publicConfig({ url: 'u', secret: 'sbw_abcdefgh', enabled: true, events: { signup: true, test: true } });
		expect(JSON.stringify(p)).not.toContain('sbw_abcdefgh');
		expect(p).toMatchObject({ hasSecret: true, secretTail: 'efgh' });
	});
});

describe('notifySignup', () => {
	const conf = { url: 'https://bot.example.com/api/hooks/abc', secret: 's', enabled: true, events: { signup: true, test: true } };
	it('sends when on, records the result', async () => {
		const kv = memoryKV();
		await kv.put(CONFIG_KEY, JSON.stringify(conf));
		const f = vi.fn(async () => new Response(null, { status: 202 }));
		await notifySignup(kv, { code: 'c' }, /** @type {any} */ (f));
		expect(f).toHaveBeenCalledOnce();
		expect(JSON.parse(kv.store.get(CONFIG_KEY) ?? '').lastResult.ok).toBe(true);
	});
	it('is silent when disabled, signup-off or unconnected', async () => {
		const f = vi.fn();
		await notifySignup(memoryKV(), {}, /** @type {any} */ (f));
		for (const c of [{ ...conf, enabled: false }, { ...conf, events: { signup: false, test: true } }]) {
			const kv = memoryKV();
			await kv.put(CONFIG_KEY, JSON.stringify(c));
			await notifySignup(kv, {}, /** @type {any} */ (f));
		}
		expect(f).not.toHaveBeenCalled();
	});
});
