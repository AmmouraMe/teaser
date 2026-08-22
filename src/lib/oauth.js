/**
 * OAuth providers for waitlist signup.
 *
 * These are join routes, not login routes. The only thing we want out of a
 * provider is a verified email address; nothing here creates a session. The
 * admin login at /auth/discord is a separate flow and must stay that way —
 * it is gated to a single username.
 *
 * Adding a provider means: register the app with the provider, set its env
 * vars, and add an entry below. The routes are generic.
 */

/** Cookie holding the CSRF state for an in-flight join. */
export const STATE_COOKIE = 'join_state';

/** Order matters — this is the order the buttons render in. */
export const PROVIDERS = ['github', 'discord', 'google', 'facebook', 'apple'];

/** @typedef {{ id: string; username?: string; email?: string; verified?: boolean }} Identity */

const CONFIG = {
	github: {
		label: 'GitHub',
		authorizeUrl: 'https://github.com/login/oauth/authorize',
		tokenUrl: 'https://github.com/login/oauth/access_token',
		scope: 'user:email',
		idVar: 'GITHUB_CLIENT_ID',
		secretVar: 'GITHUB_CLIENT_SECRET'
	},
	discord: {
		label: 'Discord',
		authorizeUrl: 'https://discord.com/api/oauth2/authorize',
		tokenUrl: 'https://discord.com/api/oauth2/token',
		scope: 'identify email',
		idVar: 'DISCORD_CLIENT_ID',
		secretVar: 'DISCORD_CLIENT_SECRET'
	},
	google: {
		label: 'Google',
		authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
		tokenUrl: 'https://oauth2.googleapis.com/token',
		scope: 'openid email profile',
		idVar: 'GOOGLE_CLIENT_ID',
		secretVar: 'GOOGLE_CLIENT_SECRET'
	},
	facebook: {
		label: 'Facebook',
		authorizeUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
		tokenUrl: 'https://graph.facebook.com/v21.0/oauth/access_token',
		scope: 'email',
		idVar: 'FACEBOOK_CLIENT_ID',
		secretVar: 'FACEBOOK_CLIENT_SECRET'
	},
	apple: {
		label: 'Apple',
		authorizeUrl: 'https://appleid.apple.com/auth/authorize',
		tokenUrl: 'https://appleid.apple.com/auth/token',
		scope: 'email',
		idVar: 'APPLE_CLIENT_ID',
		// Apple has no static secret — it is a signed JWT built per request.
		secretVar: null,
		// Requesting any scope forces form_post, so the callback arrives as POST.
		responseMode: 'form_post'
	}
};

/** @param {string} p */
export function providerConfig(p) {
	return CONFIG[/** @type {keyof typeof CONFIG} */ (p)] ?? null;
}

/**
 * Which providers have credentials set. The page only renders these, so an
 * unconfigured provider is never offered as a dead button.
 * @param {Record<string, any> | undefined} env
 */
export function configuredProviders(env) {
	if (!env) return [];
	return PROVIDERS.filter((p) => {
		const c = CONFIG[/** @type {keyof typeof CONFIG} */ (p)];
		if (!env[c.idVar]) return false;
		if (p === 'apple') {
			return Boolean(env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_PRIVATE_KEY);
		}
		return Boolean(env[c.secretVar]);
	}).map((p) => ({ id: p, label: CONFIG[/** @type {keyof typeof CONFIG} */ (p)].label }));
}

// ── base64url ────────────────────────────────────────────────────────────────

/** @param {ArrayBuffer | Uint8Array} buf */
function b64url(buf) {
	const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
	let s = '';
	for (const b of bytes) s += String.fromCharCode(b);
	return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** @param {string} s */
function b64urlDecode(s) {
	const pad = s.replace(/-/g, '+').replace(/_/g, '/');
	return atob(pad + '='.repeat((4 - (pad.length % 4)) % 4));
}

/**
 * Read the payload of a JWT without verifying it. Safe here only because we
 * received the token directly from the provider's token endpoint over TLS,
 * which is the OIDC code flow's own guarantee. Never use this on a token that
 * arrived from a browser.
 * @param {string} jwt
 */
export function decodeJwtPayload(jwt) {
	try {
		return JSON.parse(b64urlDecode(jwt.split('.')[1]));
	} catch {
		return null;
	}
}

// ── Apple client secret ──────────────────────────────────────────────────────

/**
 * Apple wants an ES256 JWT signed with the private key from the developer
 * portal, valid for at most 6 months. We mint a short-lived one per request.
 * @param {Record<string, any>} env
 */
async function appleClientSecret(env) {
	const pem = String(env.APPLE_PRIVATE_KEY).replace(/\\n/g, '\n');
	const der = pem
		.replace(/-----BEGIN PRIVATE KEY-----/, '')
		.replace(/-----END PRIVATE KEY-----/, '')
		.replace(/\s+/g, '');
	const raw = Uint8Array.from(atob(der), (c) => c.charCodeAt(0));

	const key = await crypto.subtle.importKey(
		'pkcs8',
		raw,
		{ name: 'ECDSA', namedCurve: 'P-256' },
		false,
		['sign']
	);

	const now = Math.floor(Date.now() / 1000);
	const header = { alg: 'ES256', kid: env.APPLE_KEY_ID };
	const payload = {
		iss: env.APPLE_TEAM_ID,
		iat: now,
		exp: now + 300,
		aud: 'https://appleid.apple.com',
		sub: env.APPLE_CLIENT_ID
	};

	const signingInput = `${b64url(new TextEncoder().encode(JSON.stringify(header)))}.${b64url(
		new TextEncoder().encode(JSON.stringify(payload))
	)}`;

	// WebCrypto ECDSA emits raw r||s, which is exactly the JWS ES256 encoding.
	const sig = await crypto.subtle.sign(
		{ name: 'ECDSA', hash: 'SHA-256' },
		key,
		new TextEncoder().encode(signingInput)
	);

	return `${signingInput}.${b64url(sig)}`;
}

/**
 * @param {string} provider
 * @param {Record<string, any>} env
 */
async function clientSecretFor(provider, env) {
	if (provider === 'apple') return appleClientSecret(env);
	const c = CONFIG[/** @type {keyof typeof CONFIG} */ (provider)];
	return env[c.secretVar];
}

// ── flow ─────────────────────────────────────────────────────────────────────

/**
 * @param {string} provider
 * @param {{ clientId: string; redirectUri: string; state: string }} opts
 */
export function buildAuthorizeUrl(provider, { clientId, redirectUri, state }) {
	const c = CONFIG[/** @type {keyof typeof CONFIG} */ (provider)];
	const params = new URLSearchParams({
		client_id: clientId,
		redirect_uri: redirectUri,
		response_type: 'code',
		scope: c.scope,
		state
	});
	if (c.responseMode) params.set('response_mode', c.responseMode);
	return `${c.authorizeUrl}?${params}`;
}

/**
 * Exchange the authorization code for tokens.
 * @param {string} provider
 * @param {{ code: string; redirectUri: string; env: Record<string, any> }} opts
 */
export async function exchangeCode(provider, { code, redirectUri, env }) {
	const c = CONFIG[/** @type {keyof typeof CONFIG} */ (provider)];
	const clientId = env[c.idVar];
	const clientSecret = await clientSecretFor(provider, env);

	const res = await fetch(c.tokenUrl, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			Accept: 'application/json'
		},
		body: new URLSearchParams({
			client_id: clientId,
			client_secret: clientSecret,
			grant_type: 'authorization_code',
			code,
			redirect_uri: redirectUri
		})
	});

	if (!res.ok) {
		console.error(`${provider} token exchange failed:`, res.status, await res.text());
		return null;
	}
	return res.json();
}

/**
 * Turn provider tokens into an identity with an email. Returns null when the
 * provider gave us no usable email — which is a real case (a GitHub account
 * with no verified address, an Apple private-relay refusal) and has to be
 * handled rather than assumed away.
 *
 * @param {string} provider
 * @param {any} tokens
 * @returns {Promise<Identity | null>}
 */
export async function fetchIdentity(provider, tokens) {
	const access = tokens?.access_token;

	if (provider === 'github') {
		const headers = { Authorization: `Bearer ${access}`, 'User-Agent': 'ammoura-teaser' };
		const userRes = await fetch('https://api.github.com/user', { headers });
		if (!userRes.ok) return null;
		const user = await userRes.json();

		// A GitHub profile email is often null or unverified; the emails
		// endpoint is the only reliable source.
		let email = null;
		const emailRes = await fetch('https://api.github.com/user/emails', { headers });
		if (emailRes.ok) {
			const emails = await emailRes.json();
			const primary = emails.find((/** @type {any} */ e) => e.primary && e.verified);
			email = primary?.email ?? emails.find((/** @type {any} */ e) => e.verified)?.email ?? null;
		}
		if (!email) return null;
		return { id: String(user.id), username: user.login, email, verified: true };
	}

	if (provider === 'discord') {
		const res = await fetch('https://discord.com/api/users/@me', {
			headers: { Authorization: `Bearer ${access}` }
		});
		if (!res.ok) return null;
		const user = await res.json();
		if (!user.email) return null;
		return {
			id: user.id,
			username: user.username,
			email: user.email,
			verified: Boolean(user.verified)
		};
	}

	if (provider === 'google') {
		const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
			headers: { Authorization: `Bearer ${access}` }
		});
		if (!res.ok) return null;
		const user = await res.json();
		if (!user.email) return null;
		return {
			id: user.sub,
			username: user.name ?? user.email,
			email: user.email,
			verified: Boolean(user.email_verified)
		};
	}

	if (provider === 'facebook') {
		const res = await fetch(
			`https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(access)}`
		);
		if (!res.ok) return null;
		const user = await res.json();
		// Facebook omits email when the account has none confirmed, or when the
		// user unticked the email permission on the consent screen.
		if (!user.email) return null;
		return { id: user.id, username: user.name, email: user.email, verified: true };
	}

	if (provider === 'apple') {
		const claims = decodeJwtPayload(tokens?.id_token ?? '');
		if (!claims?.email) return null;
		return {
			id: claims.sub,
			username: claims.email,
			email: claims.email,
			verified: claims.email_verified === true || claims.email_verified === 'true'
		};
	}

	return null;
}
