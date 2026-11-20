import { redirect } from '@sveltejs/kit';
import { fetchTraffic } from '$lib/traffic.js';

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals, platform }) {
	if (!locals.user) {
		redirect(302, '/auth/discord');
	}

	const env = platform?.env;
	const traffic = await fetchTraffic({ token: env?.CF_API_TOKEN, zoneId: env?.CF_ZONE_ID });
	return { traffic, user: locals.user };
}
