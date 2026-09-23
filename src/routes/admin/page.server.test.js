import { describe, it, expect } from 'vitest';
import { actions, load } from './+page.server.js';
import { memoryKV } from '$lib/kv.test-helper.js';

/** @param {Record<string, string>} fields */
function form(fields) {
	const body = new FormData();
	for (const [k, v] of Object.entries(fields)) body.set(k, v);
	return new Request('https://ammoura.me/admin', { method: 'POST', body });
}

const admin = { username: 'davis9001' };

describe('admin load', () => {
	it('sends anonymous visitors to the login', async () => {
		await expect(load(/** @type {any} */ ({ locals: {}, platform: { env: {} } }))).rejects.toMatchObject({
			status: 302,
			location: '/auth/discord'
		});
	});

	it('splits active and archived entries, newest first', async () => {
		const kv = memoryKV();
		kv.store.set('entry:1', JSON.stringify({ email: 'a@x.co', ts: '2026-01-01T00:00:00Z' }));
		kv.store.set('entry:2', JSON.stringify({ email: 'A@x.co', ts: '2026-02-01T00:00:00Z' }));
		kv.store.set('entry:3', JSON.stringify({ email: 'b@x.co', ts: '2026-03-01T00:00:00Z', archived: true }));
		kv.store.set('entry:bad', '{');
		kv.store.set('seen_email:a@x.co', '1');
		const data = await load(/** @type {any} */ ({ locals: { user: admin }, platform: { env: { WAITLIST: kv } } }));
		expect(data.entries.map((/** @type {any} */ e) => e._kvKey)).toEqual(['entry:2', 'entry:1']);
		expect(data.archivedEntries.map((/** @type {any} */ e) => e._kvKey)).toEqual(['entry:3']);
		expect(data.uniqueEmails).toBe(1);
	});
});

describe('admin archive actions', () => {
	it('refuse anonymous callers', async () => {
		const kv = memoryKV();
		kv.store.set('entry:1', '{}');
		const res = await actions.archive(
			/** @type {any} */ ({ request: form({ kvKey: 'entry:1' }), locals: {}, platform: { env: { WAITLIST: kv } } })
		);
		expect(res).toMatchObject({ status: 401 });
		expect(kv.store.get('entry:1')).toBe('{}');
	});

	it('archive and unarchive an entry', async () => {
		const kv = memoryKV();
		kv.store.set('entry:1', JSON.stringify({ email: 'a@x.co' }));
		const ev = () => /** @type {any} */ ({ request: form({ kvKey: 'entry:1' }), locals: { user: admin }, platform: { env: { WAITLIST: kv } } });
		await actions.archive(ev());
		expect(JSON.parse(kv.store.get('entry:1') ?? '')).toEqual({ email: 'a@x.co', archived: true });
		await actions.unarchive(ev());
		expect(JSON.parse(kv.store.get('entry:1') ?? '')).toEqual({ email: 'a@x.co' });
	});

	it.each(['counter:unique_emails', 'seen_email:a@x.co', 'entry:', ''])('only touch entry keys, not %j', async (kvKey) => {
		const kv = memoryKV();
		kv.store.set('counter:unique_emails', '5');
		kv.store.set('seen_email:a@x.co', '1');
		const res = await actions.archive(
			/** @type {any} */ ({ request: form({ kvKey }), locals: { user: admin }, platform: { env: { WAITLIST: kv } } })
		);
		expect(res).toMatchObject({ status: 400 });
		expect(kv.store.get('counter:unique_emails')).toBe('5');
		expect(kv.store.get('seen_email:a@x.co')).toBe('1');
	});
});
