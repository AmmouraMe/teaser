import { redirect, fail } from '@sveltejs/kit';
import {
	readConfig,
	writeConfig,
	publicConfig,
	validateHookUrl,
	buildEvent,
	sendToSpaceBot,
	CONFIG_KEY
} from '$lib/spacebot.js';

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals, platform }) {
	if (!locals.user) redirect(302, '/auth/discord');
	const config = publicConfig(await readConfig(platform?.env?.WAITLIST));
	return { config, kvAvailable: !!platform?.env?.WAITLIST, user: locals.user };
}

/** @param {any} event */
function guard({ locals, platform }) {
	if (!locals.user) return { err: fail(401) };
	const kv = platform?.env?.WAITLIST;
	if (!kv) return { err: fail(500, { error: 'KV not available' }) };
	return { kv };
}

/** @type {import('./$types').Actions} */
export const actions = {
	save: async (event) => {
		const { kv, err } = guard(event);
		if (err) return err;
		const form = await event.request.formData();
		const checked = validateHookUrl(form.get('url'));
		if (!checked.ok) return fail(400, { error: checked.error });
		const old = await readConfig(kv);
		const typed = String(form.get('secret') ?? '').trim();
		const secret = typed || old?.secret || '';
		if (!secret) return fail(400, { error: 'Paste the secret.' });
		await writeConfig(kv, {
			url: checked.url,
			secret,
			enabled: form.has('enabled'),
			events: { signup: form.has('signup'), test: true },
			...(old?.lastResult ? { lastResult: old.lastResult } : {})
		});
		return { saved: true };
	},

	toggle: async (event) => {
		const { kv, err } = guard(event);
		if (err) return err;
		const old = await readConfig(kv);
		if (!old) return fail(400, { error: 'Not connected yet.' });
		const form = await event.request.formData();
		await writeConfig(kv, { ...old, enabled: form.get('enabled') === '1' });
		return { saved: true };
	},

	events: async (event) => {
		const { kv, err } = guard(event);
		if (err) return err;
		const old = await readConfig(kv);
		if (!old) return fail(400, { error: 'Not connected yet.' });
		const form = await event.request.formData();
		await writeConfig(kv, { ...old, events: { signup: form.has('signup'), test: form.has('test') } });
		return { saved: true };
	},

	test: async (event) => {
		const { kv, err } = guard(event);
		if (err) return err;
		const old = await readConfig(kv);
		if (!old) return fail(400, { error: 'Not connected yet.' });
		const result = await sendToSpaceBot(
			old,
			buildEvent('test', { code: '20260101-test', country: 'XX', total: 0 })
		);
		await writeConfig(kv, { ...old, lastResult: { at: new Date().toISOString(), ...result } });
		return { tested: true, ok: result.ok };
	},

	remove: async (event) => {
		const { kv, err } = guard(event);
		if (err) return err;
		await kv.delete(CONFIG_KEY);
		return { removed: true };
	}
};
