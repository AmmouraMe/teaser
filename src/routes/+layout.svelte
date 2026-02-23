<script>
	import { onMount } from 'svelte';

	let { children } = $props();

	const COOKIE_NAME = 'admin_session';
	const LS_KEY = 'admin_session';

	onMount(() => {
		const hasCookie = document.cookie.split('; ').some(c => c.startsWith(COOKIE_NAME + '='));
		if (!hasCookie) {
			const stored = localStorage.getItem(LS_KEY);
			if (stored) {
				// Restore the cookie from localStorage and reload so the server picks it up
				const maxAge = 7 * 24 * 60 * 60;
				const secure = location.protocol === 'https:' ? '; Secure' : '';
				document.cookie = `${COOKIE_NAME}=${stored}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
				location.reload();
			}
		}
	});
</script>

{@render children()}

<style>
	:global(*) {
		-webkit-user-select: none;
		-moz-user-select: none;
		-ms-user-select: none;
		user-select: none;
	}
</style>

