import { describe, it, expect, vi, afterEach } from 'vitest';
import { createSession, verifySession, sign, verify, COOKIE_NAME } from './auth.js';

const SECRET = 'test-secret';

afterEach(() => vi.useRealTimers());

describe('admin session cookie', () => {
	it('uses the admin_session cookie name', () => {
		expect(COOKIE_NAME).toBe('admin_session');
	});

	it('round-trips a username', async () => {
		const cookie = await createSession('davis9001', SECRET);
		expect(await verifySession(cookie, SECRET)).toEqual({ username: 'davis9001' });
	});

	it('rejects a cookie signed with another secret', async () => {
		const cookie = await createSession('davis9001', 'other');
		expect(await verifySession(cookie, SECRET)).toBeNull();
	});

	it('rejects a tampered payload', async () => {
		const cookie = await createSession('davis9001', SECRET);
		const [, sig] = cookie.split('.');
		const forged = btoa(JSON.stringify({ username: 'attacker', expires: Date.now() + 1e9 }));
		expect(await verifySession(`${forged}.${sig}`, SECRET)).toBeNull();
	});

	it('rejects missing and malformed cookies', async () => {
		expect(await verifySession(undefined, SECRET)).toBeNull();
		expect(await verifySession('', SECRET)).toBeNull();
		expect(await verifySession('nodot', SECRET)).toBeNull();
		expect(await verifySession('.sig', SECRET)).toBeNull();
		expect(await verifySession('payload.', SECRET)).toBeNull();
		expect(await verifySession('abc.!!!not-base64!!!', SECRET)).toBeNull();
	});

	it('expires after seven days', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
		const cookie = await createSession('davis9001', SECRET);
		vi.setSystemTime(new Date('2026-01-07T23:00:00Z'));
		expect(await verifySession(cookie, SECRET)).not.toBeNull();
		vi.setSystemTime(new Date('2026-01-08T00:00:01Z'));
		expect(await verifySession(cookie, SECRET)).toBeNull();
	});
});

describe('sign/verify', () => {
	it('verifies its own signatures and nothing else', async () => {
		const sig = await sign('data', SECRET);
		expect(await verify('data', sig, SECRET)).toBe(true);
		expect(await verify('data!', sig, SECRET)).toBe(false);
		expect(await verify('data', sig, 'other')).toBe(false);
		expect(await verify('data', 'not base64 at all!', SECRET)).toBe(false);
		expect(await verify('data', '', SECRET)).toBe(false);
	});

	it('refuses a correctly signed payload with no expiry or username', async () => {
		for (const body of [{ username: 'davis9001' }, { username: 'davis9001', expires: 'never' }, { expires: Date.now() + 1e6 }]) {
			const payload = btoa(JSON.stringify(body));
			const cookie = `${payload}.${await sign(payload, SECRET)}`;
			expect(await verifySession(cookie, SECRET)).toBeNull();
		}
	});
});
