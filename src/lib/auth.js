const COOKIE_NAME = 'admin_session';
/** CSRF state for an in-flight admin login. */
export const ADMIN_STATE_COOKIE = 'admin_state';
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

/** @param {string} secret @param {KeyUsage[]} usages */
function hmacKey(secret, usages) {
	return crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		usages
	);
}

/**
 * HMAC-SHA256 sign a string.
 * @param {string} data
 * @param {string} secret
 * @returns {Promise<string>}
 */
export async function sign(data, secret) {
	const key = await hmacKey(secret, ['sign']);
	const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
	return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

/**
 * Verify an HMAC-SHA256 signature. WebCrypto's verify compares in constant
 * time; comparing two base64 strings with === does not.
 * @param {string} data
 * @param {string} signature  base64, as produced by sign()
 * @param {string} secret
 * @returns {Promise<boolean>}
 */
export async function verify(data, signature, secret) {
	let sig;
	try {
		sig = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0));
	} catch {
		return false;
	}
	const key = await hmacKey(secret, ['verify']);
	return crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(data));
}

/**
 * Create a signed session cookie value.
 * @param {string} username
 * @param {string} secret
 * @returns {Promise<string>}
 */
export async function createSession(username, secret) {
	const expires = Date.now() + SESSION_DURATION;
	const payload = btoa(JSON.stringify({ username, expires }));
	const sig = await sign(payload, secret);
	return `${payload}.${sig}`;
}

/**
 * Verify and decode a session cookie.
 * @param {string | undefined} cookie
 * @param {string} secret
 * @returns {Promise<{ username: string } | null>}
 */
export async function verifySession(cookie, secret) {
	if (!cookie) return null;
	const dot = cookie.indexOf('.');
	if (dot === -1) return null;

	const payload = cookie.slice(0, dot);
	const sig = cookie.slice(dot + 1);
	if (!payload || !sig) return null;

	const valid = await verify(payload, sig, secret);
	if (!valid) return null;

	try {
		const data = JSON.parse(atob(payload));
		// A payload without a numeric expiry never expires under `<`, so
		// treat it as invalid rather than as permanent.
		if (!Number.isFinite(data?.expires) || data.expires <= Date.now()) return null;
		if (typeof data.username !== 'string' || !data.username) return null;
		return { username: data.username };
	} catch {
		return null;
	}
}

export { COOKIE_NAME };
