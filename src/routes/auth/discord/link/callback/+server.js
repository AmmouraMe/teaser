import { redirect, error } from '@sveltejs/kit';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url, platform }) {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	if (!code || !state) throw error(400, 'Missing authorization code or state');

	const clientId = platform?.env?.DISCORD_CLIENT_ID;
	const clientSecret = platform?.env?.DISCORD_CLIENT_SECRET;
	if (!clientId || !clientSecret) {
		throw error(500, 'Discord OAuth not configured');
	}

	// ── Verify & decode the signed state ──
	const email = await verifyState(state, clientSecret);
	if (!email) throw error(400, 'Invalid or tampered state');

	const redirectUri = `${url.origin}/auth/discord/link/callback`;

	// ── Exchange authorization code for access token ──
	const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			client_id: clientId,
			client_secret: clientSecret,
			grant_type: 'authorization_code',
			code,
			redirect_uri: redirectUri
		})
	});

	if (!tokenRes.ok) {
		console.error('Discord token exchange failed:', tokenRes.status, await tokenRes.text());
		throw error(401, 'Failed to authenticate with Discord');
	}

	const tokenData = await tokenRes.json();

	// ── Fetch Discord profile ──
	const userRes = await fetch('https://discord.com/api/users/@me', {
		headers: { Authorization: `Bearer ${tokenData.access_token}` }
	});

	if (!userRes.ok) {
		throw error(401, 'Failed to fetch Discord user');
	}

	const user = await userRes.json();

	// ── Update the waitlist KV entry with Discord info ──
	try {
		const kv = platform?.env?.WAITLIST;
		if (kv) {
			const key = `entry:${email.toLowerCase()}`;
			const existing = await kv.get(key);
			if (existing) {
				const entry = JSON.parse(existing);
				entry.discord = {
					id: user.id,
					username: user.username,
					globalName: user.global_name || null,
					linkedAt: new Date().toISOString()
				};
				await kv.put(key, JSON.stringify(entry));
			} else {
				console.warn(`No waitlist entry found for ${email}`);
			}

			// ── Track unique Discord signups ──
			const discordKey = `seen_discord:${user.id}`;
			const alreadySeen = await kv.get(discordKey);
			if (!alreadySeen) {
				await kv.put(discordKey, '1');
				const current = parseInt((await kv.get('counter:unique_discords')) || '0', 10);
				await kv.put('counter:unique_discords', String(current + 1));
			}
		}
	} catch (err) {
		console.error('KV update for Discord link failed:', err);
	}

	// ── Notify via webhook ──
	try {
		const webhookUrl = platform?.env?.DISCORD_WEBHOOK_URL;
		if (webhookUrl) {
			await fetch(webhookUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					embeds: [
						{
							title: '🔗 Discord Linked',
							color: 0x5865f2,
							fields: [
								{ name: 'Email', value: email, inline: true },
								{ name: 'Discord', value: `<@${user.id}>`, inline: true }
							]
						}
					]
				})
			});
		}
	} catch (err) {
		console.error('Discord webhook notify failed:', err);
	}

	redirect(302, '/?linked=1');
}

/**
 * Verify the HMAC-signed state and return the email.
 * @param {string} state  – "base64(email).base64(sig)"
 * @param {string} secret
 * @returns {Promise<string|null>}
 */
async function verifyState(state, secret) {
	const dot = state.indexOf('.');
	if (dot === -1) return null;

	const payload = state.slice(0, dot);
	const sigB64 = state.slice(dot + 1);

	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const expected = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
	const expectedB64 = btoa(String.fromCharCode(...new Uint8Array(expected)));

	if (expectedB64 !== sigB64) return null;

	try {
		return atob(payload);
	} catch {
		return null;
	}
}
