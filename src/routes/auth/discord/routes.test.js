import { describe, it, expect } from 'vitest';

// /auth/discord/link signed any ?email= it was handed and its callback only
// bumped counter:unique_discords and posted to the webhook — an
// unauthenticated webhook spammer. It was removed; this keeps it removed.
// Discord sign-up goes through /auth/join/discord, admin login through
// /auth/discord.
describe('/auth/discord routes', () => {
	it('ships no /auth/discord/link endpoint', () => {
		const routes = Object.keys(import.meta.glob('/src/routes/auth/discord/**/+server.js'));
		expect(routes.length).toBeGreaterThan(0);
		expect(routes.filter((r) => r.includes('/link'))).toEqual([]);
	});
});
