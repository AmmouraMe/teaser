import { describe, it, expect } from 'vitest';
import { load } from './+page.server.js';

describe('admin traffic load', () => {
	it('sends anonymous visitors to the login', async () => {
		await expect(load(/** @type {any} */ ({ locals: {}, platform: { env: {} } }))).rejects.toMatchObject({
			status: 302,
			location: '/auth/discord'
		});
	});

	it('asks for the setup instead of failing when the secrets are missing', async () => {
		const data = await load(/** @type {any} */ ({ locals: { user: { username: 'davis9001' } }, platform: { env: {} } }));
		expect(data.traffic.configured).toBe(false);
		expect(data.user.username).toBe('davis9001');
	});
});
