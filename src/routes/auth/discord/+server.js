import { redirect } from '@sveltejs/kit';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url, platform }) {
	const clientId = platform?.env?.DISCORD_CLIENT_ID;
	if (!clientId) {
		return new Response('DISCORD_CLIENT_ID not configured', { status: 500 });
	}

	const redirectUri = `${url.origin}/auth/discord/callback`;
	const params = new URLSearchParams({
		client_id: clientId,
		redirect_uri: redirectUri,
		response_type: 'code',
		scope: 'identify'
	});

	redirect(302, `https://discord.com/api/oauth2/authorize?${params}`);
}
