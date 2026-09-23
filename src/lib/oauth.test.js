import { describe, it, expect, vi, afterEach } from 'vitest';
import {
	PROVIDERS,
	providerConfig,
	configuredProviders,
	buildAuthorizeUrl,
	decodeJwtPayload,
	exchangeCode,
	fetchIdentity
} from './oauth.js';

afterEach(() => vi.unstubAllGlobals());

/** @param {Record<string, any>} routes url-prefix → [status, body] */
function stubFetch(routes) {
	const calls = /** @type {Array<[string, any]>} */ ([]);
	vi.stubGlobal(
		'fetch',
		vi.fn(async (/** @type {string} */ url, /** @type {any} */ init) => {
			calls.push([String(url), init]);
			const hit = Object.keys(routes).find((p) => String(url).startsWith(p));
			if (!hit) return new Response('not found', { status: 404 });
			const [status, body] = routes[hit];
			return new Response(JSON.stringify(body), { status });
		})
	);
	return calls;
}

/** @param {object} claims */
function fakeJwt(claims) {
	const enc = (/** @type {object} */ o) =>
		btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
	return `${enc({ alg: 'none' })}.${enc(claims)}.sig`;
}

describe('provider config', () => {
	it('knows every listed provider and nothing else', () => {
		for (const p of PROVIDERS) expect(providerConfig(p)).not.toBeNull();
		expect(providerConfig('myspace')).toBeNull();
	});

	it('offers only fully configured providers, in button order', () => {
		expect(configuredProviders(undefined)).toEqual([]);
		const env = {
			GOOGLE_CLIENT_ID: 'g',
			GOOGLE_CLIENT_SECRET: 's',
			GITHUB_CLIENT_ID: 'gh',
			GITHUB_CLIENT_SECRET: 's',
			DISCORD_CLIENT_ID: 'd', // no secret
			APPLE_CLIENT_ID: 'a',
			APPLE_TEAM_ID: 't',
			APPLE_KEY_ID: 'k' // no private key
		};
		expect(configuredProviders(env)).toEqual([
			{ id: 'github', label: 'GitHub' },
			{ id: 'google', label: 'Google' }
		]);
		expect(
			configuredProviders({ ...env, APPLE_PRIVATE_KEY: 'pem' }).map((p) => p.id)
		).toContain('apple');
	});

	it('builds an authorize URL with state, and form_post only for Apple', () => {
		const opts = { clientId: 'cid', redirectUri: 'https://x/cb', state: 'st' };
		const gh = new URL(buildAuthorizeUrl('github', opts));
		expect(gh.origin + gh.pathname).toBe('https://github.com/login/oauth/authorize');
		expect(Object.fromEntries(gh.searchParams)).toEqual({
			client_id: 'cid',
			redirect_uri: 'https://x/cb',
			response_type: 'code',
			scope: 'user:email',
			state: 'st'
		});
		const apple = new URL(buildAuthorizeUrl('apple', opts));
		expect(apple.searchParams.get('response_mode')).toBe('form_post');
	});
});

describe('decodeJwtPayload', () => {
	it('reads a base64url payload', () => {
		expect(decodeJwtPayload(fakeJwt({ sub: '1', email: 'a@b.co' }))).toEqual({
			sub: '1',
			email: 'a@b.co'
		});
	});
	it('returns null on garbage', () => {
		expect(decodeJwtPayload('')).toBeNull();
		expect(decodeJwtPayload('a.%%%.c')).toBeNull();
	});
});

describe('exchangeCode', () => {
	it('posts the code with the static secret', async () => {
		const calls = stubFetch({ 'https://github.com/login/oauth/access_token': [200, { access_token: 't' }] });
		const tokens = await exchangeCode('github', {
			code: 'c',
			redirectUri: 'https://x/cb',
			env: { GITHUB_CLIENT_ID: 'id', GITHUB_CLIENT_SECRET: 'sec' }
		});
		expect(tokens).toEqual({ access_token: 't' });
		const body = new URLSearchParams(calls[0][1].body);
		expect(body.get('client_secret')).toBe('sec');
		expect(body.get('code')).toBe('c');
		expect(body.get('grant_type')).toBe('authorization_code');
	});

	it('returns null when the provider refuses', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		stubFetch({ 'https://github.com': [400, { error: 'bad_verification_code' }] });
		expect(
			await exchangeCode('github', { code: 'c', redirectUri: 'r', env: {} })
		).toBeNull();
	});

	it('mints an ES256 client secret for Apple', async () => {
		const { privateKey } = await crypto.subtle.generateKey(
			{ name: 'ECDSA', namedCurve: 'P-256' },
			true,
			['sign', 'verify']
		);
		const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', privateKey));
		const pem = `-----BEGIN PRIVATE KEY-----\\n${btoa(String.fromCharCode(...pkcs8))}\\n-----END PRIVATE KEY-----`;
		const calls = stubFetch({ 'https://appleid.apple.com/auth/token': [200, { id_token: 'x' }] });
		await exchangeCode('apple', {
			code: 'c',
			redirectUri: 'r',
			env: { APPLE_CLIENT_ID: 'svc', APPLE_TEAM_ID: 'team', APPLE_KEY_ID: 'kid', APPLE_PRIVATE_KEY: pem }
		});
		const secret = new URLSearchParams(calls[0][1].body).get('client_secret') ?? '';
		const [h, , sig] = secret.split('.');
		expect(decodeJwtPayload(`x.${h}.y`)).toEqual({ alg: 'ES256', kid: 'kid' });
		expect(decodeJwtPayload(secret)).toMatchObject({
			iss: 'team',
			sub: 'svc',
			aud: 'https://appleid.apple.com'
		});
		expect(sig.length).toBeGreaterThan(80); // raw r||s, 64 bytes
	});
});

describe('fetchIdentity', () => {
	it('github: prefers the primary verified email', async () => {
		stubFetch({
			'https://api.github.com/user/emails': [
				200,
				[
					{ email: 'old@x.co', primary: false, verified: true },
					{ email: 'main@x.co', primary: true, verified: true }
				]
			],
			'https://api.github.com/user': [200, { id: 7, login: 'octo' }]
		});
		expect(await fetchIdentity('github', { access_token: 't' })).toEqual({
			id: '7',
			username: 'octo',
			email: 'main@x.co',
			verified: true
		});
	});

	it('github: no verified email means no identity', async () => {
		stubFetch({
			'https://api.github.com/user/emails': [200, [{ email: 'a@x.co', primary: true, verified: false }]],
			'https://api.github.com/user': [200, { id: 7, login: 'octo' }]
		});
		expect(await fetchIdentity('github', { access_token: 't' })).toBeNull();
	});

	it('discord: carries the verified flag through', async () => {
		stubFetch({
			'https://discord.com/api/users/@me': [200, { id: '1', username: 'u', email: 'u@x.co', verified: false }]
		});
		expect(await fetchIdentity('discord', { access_token: 't' })).toEqual({
			id: '1',
			username: 'u',
			email: 'u@x.co',
			verified: false
		});
	});

	it('google and facebook: missing email is null', async () => {
		stubFetch({
			'https://openidconnect.googleapis.com': [200, { sub: '1' }],
			'https://graph.facebook.com': [200, { id: '1', name: 'n' }]
		});
		expect(await fetchIdentity('google', { access_token: 't' })).toBeNull();
		expect(await fetchIdentity('facebook', { access_token: 't' })).toBeNull();
	});

	it('apple: reads the id_token claims', async () => {
		const id_token = fakeJwt({ sub: 's', email: 'r@privaterelay.appleid.com', email_verified: 'true' });
		expect(await fetchIdentity('apple', { id_token })).toEqual({
			id: 's',
			username: 'r@privaterelay.appleid.com',
			email: 'r@privaterelay.appleid.com',
			verified: true
		});
	});

	it('unknown provider is null', async () => {
		expect(await fetchIdentity('myspace', {})).toBeNull();
	});
});
