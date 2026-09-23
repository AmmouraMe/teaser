import { describe, it, expect, vi, afterEach } from 'vitest';
import { saveEntry, notifyJoin } from './waitlist.js';
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

	it('writes an entry and counts the email once, case-insensitively', async () => {
		const kv = memoryKV();
		expect(await saveEntry(kv, entry('A@Example.org'))).toEqual({ stored: true, duplicate: false });
		expect(await saveEntry(kv, entry('a@example.org'))).toEqual({ stored: true, duplicate: true });

		const entries = [...kv.store.keys()].filter((k) => k.startsWith('entry:'));
		expect(entries).toHaveLength(2);
		expect(JSON.parse(kv.store.get(entries[0]) ?? '')).toMatchObject({ source: 'email' });
		expect(kv.store.get('seen_email:a@example.org')).toBe('1');
		expect(kv.store.get('counter:unique_emails')).toBe('1');
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
		const f = vi.fn(async () => new Response('', { status: 204 }));
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
