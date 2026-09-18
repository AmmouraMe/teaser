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
	/* ── The site's foundation ──
	   This lives in the root layout because a Svelte style block, `:global()`
	   rules included, is only injected while its own component is rendered. All
	   of this used to sit in `+page.svelte`, which meant it existed on the home
	   page and nowhere else: /privacy and /terms set white text, inherited no
	   ground at all, and rendered white-on-white in both themes. The layout is
	   the only place that is on screen for every route.

	/* ── Themes ──
	   Two of them, and they are not the same page in two palettes. Dark is the
	   teaser: black, a wireframe planet, a launch date flying in on an arc.
	   Light is the other side of the same joke — a pastel sky, a unicorn where
	   the date was, and a candy mountain where the towers were.

	   Everything below is written once against these tokens, so the dark theme
	   still renders exactly what it rendered before the light one existed. */
	:global(html) {
		--ink-rgb: 255 255 255;
		--ink: #fff;
		--ground: #000;
		/* The halo that keeps the copy readable where the planet crosses it. */
		--halo-rgb: 6 7 9;
		--panel-rgb: 10 12 16;
		--accent-rgb: 132 226 136;
	}

	:global(html[data-theme='light']) {
		/* A deep plum rather than black: on a pastel ground pure black is a hole,
		   and every alpha below was chosen against a coloured ink. */
		--ink-rgb: 58 30 66;
		--ink: #3a1e42;
		--ground: #fff7fb;
		--halo-rgb: 255 248 252;
		--panel-rgb: 255 255 255;
		--accent-rgb: 236 92 168;
	}

	:global(*, *::before, *::after) {
		box-sizing: border-box;
		margin: 0;
		padding: 0;
	}

	:global(html, body) {
		background: var(--ground);
		color: var(--ink);
		font-family: 'Georgia', serif;
		scroll-behavior: smooth;
		-webkit-text-size-adjust: 100%;
	}

	/* The light theme's ground is a sky: dawn pink at the top, through lilac, to
	   a mint horizon. Fixed, so it does not slide as the page scrolls. */
	:global(html[data-theme='light'] body) {
		background:
			linear-gradient(180deg, #ffeef7 0%, #f6ecff 38%, #eef6ff 68%, #ecfbf3 100%)
			fixed;
	}

	:global(*) {
		-webkit-user-select: none;
		-moz-user-select: none;
		-ms-user-select: none;
		user-select: none;
	}
</style>

