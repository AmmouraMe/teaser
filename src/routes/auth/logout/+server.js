import { redirect } from '@sveltejs/kit';
import { COOKIE_NAME } from '$lib/auth.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ cookies }) {
	cookies.delete(COOKIE_NAME, { path: '/' });
	redirect(302, '/');
}
