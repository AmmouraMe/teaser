import { describe, it, expect, vi, afterEach } from 'vitest';
import { load, actions } from './+page.server.js';
import { memoryKV } from '$lib/kv.test-helper.js';
import { CONFIG_KEY } from '$lib/spacebot.js';

afterEach(() => vi.unstubAllGlobals());

const user = { username: 'davis9001' };
const URL_OK = 'https://bot.example.com/api/hooks/abc';

/** @param {any} kv @param {Record<string,string>} f @param {any} [locals] */
const ev = (kv, f, locals = { user }) => {
	const body = new FormData();
	for (const [k, v] of Object.entries(f)) body.set(k, v);
	return /** @type {any} */ ({ request: new Request('https://x/', { method: 'POST', body }), locals, platform: { env: { WAITLIST: kv } } });
};

describe('admin spacebot', () => {
	it('redirects anonymous visitors', async () => {
		await expect(load(/** @type {any} */ ({ locals: {}, platform: { env: {} } }))).rejects.toMatchObject({ status: 302 });
		expect(await actions.save(ev(memoryKV(), { url: URL_OK, secret: 's' }, {}))).toMatchObject({ status: 401 });
	});

	it('load never returns the secret', async () => {
		const kv = memoryKV();
		await actions.save(ev(kv, { url: URL_OK, secret: 'sbw_supersecret9', enabled: 'on' }));
		const data = await load(/** @type {any} */ ({ locals: { user }, platform: { env: { WAITLIST: kv } } }));
		expect(JSON.stringify(data)).not.toContain('supersecret');
		expect(data.config).toMatchObject({ connected: true, hasSecret: true, secretTail: 'ret9' });
	});

	it('rejects a bad URL and a missing secret', async () => {
		const kv = memoryKV();
		expect(await actions.save(ev(kv, { url: 'http://x/api/hooks/a', secret: 's' }))).toMatchObject({ status: 400 });
		expect(await actions.save(ev(kv, { url: URL_OK, secret: '' }))).toMatchObject({ status: 400 });
		expect(kv.store.size).toBe(0);
	});

	it('a blank secret keeps the old one', async () => {
		const kv = memoryKV();
		await actions.save(ev(kv, { url: URL_OK, secret: 'keepme' }));
		await actions.save(ev(kv, { url: 'https://bot.example.com/api/hooks/def', secret: '  ' }));
		const c = JSON.parse(kv.store.get(CONFIG_KEY) ?? '');
		expect(c.secret).toBe('keepme');
		expect(c.url).toBe('https://bot.example.com/api/hooks/def');
	});

	it('toggles, sets events, tests and removes', async () => {
		const kv = memoryKV();
		await actions.save(ev(kv, { url: URL_OK, secret: 's', enabled: 'on' }));
		await actions.toggle(ev(kv, { enabled: '0' }));
		expect(JSON.parse(kv.store.get(CONFIG_KEY) ?? '').enabled).toBe(false);
		await actions.events(ev(kv, { signup: 'on' }));
		expect(JSON.parse(kv.store.get(CONFIG_KEY) ?? '').events).toEqual({ signup: true, test: false });

		vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 202 })));
		expect(await actions.test(ev(kv, {}))).toMatchObject({ ok: true });
		expect(JSON.parse(kv.store.get(CONFIG_KEY) ?? '').lastResult).toMatchObject({ ok: true, status: 202 });

		vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('down'); }));
		expect(await actions.test(ev(kv, {}))).toMatchObject({ ok: false });
		expect(JSON.parse(kv.store.get(CONFIG_KEY) ?? '').lastResult.ok).toBe(false);

		await actions.remove(ev(kv, {}));
		expect(kv.store.has(CONFIG_KEY)).toBe(false);
	});
});
