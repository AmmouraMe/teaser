import { describe, it, expect, vi, afterEach } from 'vitest';
import { saveEntry, notifyJoin, isFakeEmail, collectServerData, parseClientData, MAX_CLIENT_DATA } from './waitlist.js';
import { memoryKV } from './kv.test-helper.js';

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

const entry = (email = 'A@Example.org') => ({ email, ts: '2026-01-01T00:00:00Z', source: 'email' });

describe('saveEntry', () => {
	it('is a no-op without KV', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		expect(await saveEntry(undefined, entry())).toEqual({ stored: false, duplicate: false });
	});

	it('writes an entry and counts the email once', async () => {
		const kv = memoryKV();
		expect(await saveEntry(kv, entry('A@Example.org'))).toEqual({ stored: true, duplicate: false });

		const entries = [...kv.store.keys()].filter((k) => k.startsWith('entry:'));
		expect(entries).toHaveLength(1);
		expect(JSON.parse(kv.store.get(entries[0]) ?? '')).toMatchObject({ source: 'email' });
		expect(kv.store.get('seen_email:a@example.org')).toBe('1');
		expect(kv.store.get('counter:unique_emails')).toBe('1');
	});

	it('writes nothing for an email already on the list, case-insensitively', async () => {
		const kv = memoryKV();
		await saveEntry(kv, entry('A@Example.org'));
		const before = new Map(kv.store);
		const put = vi.spyOn(kv, 'put');

		expect(await saveEntry(kv, entry('a@example.org'))).toEqual({ stored: false, duplicate: true });
		expect(put).not.toHaveBeenCalled();
		expect(kv.store).toEqual(before);
	});
});

describe('notifyJoin', () => {
	it('does nothing without a webhook', async () => {
		const f = vi.fn();
		vi.stubGlobal('fetch', f);
		await notifyJoin(undefined, entry());
		expect(f).not.toHaveBeenCalled();
	});

	it('posts an embed with only defined field values', async () => {
		const f = vi.fn(async () => new Response(null, { status: 204 }));
		vi.stubGlobal('fetch', f);
		await notifyJoin('https://hook', {
			...entry(),
			source: 'github',
			provider: { id: '1', username: 'octo' },
			server: { country: 'US' }
		});
		const body = JSON.parse(/** @type {any} */ (f.mock.calls[0])[1].body);
		const fields = body.embeds[0].fields;
		expect(fields.map((/** @type {any} */ x) => x.name)).toEqual(['Email', 'Via', 'Account', 'Country']);
		for (const x of fields) expect(typeof x.value).toBe('string');
	});

	it('never throws when Discord is down', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
		await expect(notifyJoin('https://hook', entry())).resolves.toBeUndefined();
		vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 400 })));
		await expect(notifyJoin('https://hook', entry())).resolves.toBeUndefined();
	});
});

describe('isFakeEmail', () => {
	it.each([
		'noah@gmail.com',
		'nora.smith@proton.me',
		'tessa@icloud.com',
		'tester.jones@company.io',
		'nullable@dev.io',
		'first+tag@sub.domain.co'
	])('accepts a real-looking address: %s', (email) => {
		expect(isFakeEmail(email)).toBe(false);
	});

	it.each([
		'',
		'no-at-sign',
		'@domain.com',
		'user@',
		'user@localhost',
		'has space@x.co',
		'x@mailinator.com',
		'x@Example.COM',
		'test@gmail.com',
		'test+1@gmail.com',
		'no@gmail.com',
		'NULL@gmail.com',
		`${'a'.repeat(250)}@x.co`
	])('rejects %s', (email) => {
		expect(isFakeEmail(email)).toBe(true);
	});
});

describe('collectServerData', () => {
	it('keeps request metadata but never credentials', () => {
		const request = new Request('https://ammoura.me/', {
			headers: {
				cookie: 'admin_session=secret.sig; join_state=x',
				authorization: 'Bearer t',
				'user-agent': 'UA',
				'cf-connecting-ip': '198.51.100.4',
				'cf-ipcountry': 'DE'
			}
		});
		const data = collectServerData(request);
		expect(data).toMatchObject({ ip: '198.51.100.4', country: 'DE', userAgent: 'UA' });
		expect(data.rawHeaders['user-agent']).toBe('UA');
		expect(data.rawHeaders).not.toHaveProperty('cookie');
		expect(data.rawHeaders).not.toHaveProperty('authorization');
		expect(JSON.stringify(data)).not.toContain('secret.sig');
	});

	it('falls back to the platform client address', () => {
		const data = collectServerData(new Request('https://ammoura.me/'), {
			getClientAddress: () => '192.0.2.1'
		});
		expect(data.ip).toBe('192.0.2.1');
	});
});

describe('parseClientData', () => {
	it('accepts a JSON object', () => {
		expect(parseClientData('{"a":1}')).toEqual({ a: 1 });
	});
	it.each([null, '', '{bad', '[1,2]', '"str"', 'null', `{"a":"${'x'.repeat(MAX_CLIENT_DATA)}"}`])(
		'drops %s',
		(raw) => {
			expect(parseClientData(raw)).toEqual({});
		}
	);
});
