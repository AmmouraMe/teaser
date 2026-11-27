/**
 * The SpaceBot connection: the teaser posts events to a SpaceBot incoming
 * webhook (`POST https://<host>/api/hooks/<publicId>`, `Authorization: Bearer
 * sbw_...`) so a SpaceBot automation with the "Webhook received" trigger can
 * react. The config lives in one KV key, `config:spacebot`, and the secret in
 * it never leaves the server: `publicConfig` is the only shape a page gets.
 */

export const CONFIG_KEY = 'config:spacebot';
export const EVENT_KINDS = /** @type {const} */ (['signup', 'test']);

/**
 * @typedef {{ at: string, ok: boolean, status: number, error?: string }} LastResult
 * @typedef {{
 *   url: string, secret: string, enabled: boolean,
 *   events: { signup: boolean, test: boolean }, lastResult?: LastResult
 * }} SpaceBotConfig
 */

/**
 * https only, path `/api/hooks/<id>`, no credentials in the URL.
 * Never throws.
 * @param {unknown} url
 * @returns {{ ok: true, url: string } | { ok: false, error: string }}
 */
export function validateHookUrl(url) {
	const text = typeof url === 'string' ? url.trim() : '';
	if (!text) return { ok: false, error: 'Paste the webhook URL.' };
	let u;
	try {
		u = new URL(text);
	} catch {
		return { ok: false, error: 'That is not a URL.' };
	}
	if (u.protocol !== 'https:') return { ok: false, error: 'The URL must start with https://.' };
	if (u.username || u.password) {
		return { ok: false, error: 'Remove the user name and password from the URL. Use the secret field.' };
	}
	if (!/^\/api\/hooks\/[A-Za-z0-9_-]+\/?$/.test(u.pathname)) {
		return { ok: false, error: 'The path must look like /api/hooks/<id>. Copy the URL from SpaceBot.' };
	}
	return { ok: true, url: `${u.origin}${u.pathname.replace(/\/$/, '')}` };
}

/**
 * @param {string} kind
 * @param {Record<string, unknown>} [data]
 */
export function buildEvent(kind, data = {}) {
	return { source: 'ammoura-teaser', event: kind, at: new Date().toISOString(), ...data };
}

/**
 * Post one event. Never throws, never logs the secret.
 * @param {{ url: string, secret: string }} config
 * @param {Record<string, unknown>} payload
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<{ ok: boolean, status: number, error?: string }>}
 */
export async function sendToSpaceBot(config, payload, fetchImpl = fetch) {
	try {
		const res = await fetchImpl(config.url, {
			method: 'POST',
			headers: { 'content-type': 'application/json', authorization: `Bearer ${config.secret}` },
			body: JSON.stringify(payload),
			signal: AbortSignal.timeout(5000)
		});
		if (res.ok) return { ok: true, status: res.status };
		return { ok: false, status: res.status, error: `SpaceBot answered ${res.status}.` };
	} catch (err) {
		const timedOut = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
		return { ok: false, status: 0, error: timedOut ? 'SpaceBot did not answer in 5 seconds.' : 'Could not reach SpaceBot.' };
	}
}

/**
 * @param {any} kv
 * @returns {Promise<SpaceBotConfig | null>}
 */
export async function readConfig(kv) {
	if (!kv) return null;
	try {
		const c = JSON.parse((await kv.get(CONFIG_KEY)) ?? 'null');
		if (!c || typeof c.url !== 'string' || typeof c.secret !== 'string') return null;
		return {
			url: c.url,
			secret: c.secret,
			enabled: c.enabled === true,
			events: { signup: c.events?.signup === true, test: c.events?.test !== false },
			...(c.lastResult ? { lastResult: c.lastResult } : {})
		};
	} catch {
		return null;
	}
}

/**
 * @param {any} kv
 * @param {SpaceBotConfig} config
 */
export async function writeConfig(kv, config) {
	await kv.put(CONFIG_KEY, JSON.stringify(config));
}

/**
 * What a page may see: no secret, only whether one is set and its last 4 characters.
 * @param {SpaceBotConfig | null} c
 */
export function publicConfig(c) {
	if (!c) return { connected: false };
	return {
		connected: true,
		url: c.url,
		enabled: c.enabled,
		events: c.events,
		hasSecret: c.secret.length > 0,
		secretTail: c.secret.slice(-4),
		lastResult: c.lastResult ?? null
	};
}

/**
 * Send a signup event if the connection is on for it. Never throws.
 * @param {any} kv
 * @param {Record<string, unknown>} data
 * @param {typeof fetch} [fetchImpl]
 */
export async function notifySignup(kv, data, fetchImpl = fetch) {
	try {
		const c = await readConfig(kv);
		if (!c || !c.enabled || !c.events.signup) return;
		const result = await sendToSpaceBot(c, buildEvent('signup', data), fetchImpl);
		// A write per signup is the cost of showing the last result; skip it when unchanged-ok is not worth it.
		await writeConfig(kv, { ...c, lastResult: { at: new Date().toISOString(), ...result } });
	} catch {
		/* a signup must never break on this */
	}
}
