import { redirect } from '@sveltejs/kit';
import { fetchTraffic } from '$lib/traffic.js';
import { readCodes } from '$lib/codes.js';

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals, platform }) {
	if (!locals.user) {
		redirect(302, '/auth/discord');
	}

	const env = platform?.env;
	// Cloudflare tells the edge where the request came from, so the days can be
	// cut in the viewer's own time zone. Without it they are UTC, and say so.
	const timeZone = /** @type {any} */ (platform)?.cf?.timezone;
	const traffic = await fetchTraffic({ token: env?.CF_API_TOKEN, zoneId: env?.CF_ZONE_ID, timeZone });
	const codes = await readCodes(env?.WAITLIST);
	return { traffic, codes, user: locals.user };
}
