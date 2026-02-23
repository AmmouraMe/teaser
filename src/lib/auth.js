const COOKIE_NAME = 'admin_session';
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * HMAC-SHA256 sign a string.
 * @param {string} data
 * @param {string} secret
 * @returns {Promise<string>}
 */
async function sign(data, secret) {
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
	return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

/**
 * Verify an HMAC-SHA256 signature.
 * @param {string} data
 * @param {string} signature
 * @param {string} secret
 * @returns {Promise<boolean>}
 */
async function verify(data, signature, secret) {
	const expected = await sign(data, secret);
	return expected === signature;
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
		if (data.expires < Date.now()) return null;
		return { username: data.username };
	} catch {
		return null;
	}
}

export { COOKIE_NAME };
