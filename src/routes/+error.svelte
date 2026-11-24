<script>
	import { page } from '$app/state';

	// A missing page is the common case; anything else is our fault, not theirs.
	const notFound = $derived(page.status === 404);
</script>

<svelte:head>
	<title>{notFound ? 'Not found' : 'Something broke'} · Ammoura</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="lost">
	<p class="code">{page.status}</p>
	<h1>{notFound ? 'Nothing here.' : 'Something broke.'}</h1>
	<p class="line">
		{notFound
			? 'That page does not exist. Ammoura is not open yet.'
			: 'It is on our side. Try again in a moment.'}
	</p>
	<a class="home" href="/">&larr; Ammoura</a>
</main>

<style>
	/* Written against the theme tokens from the root layout, so the light theme
	   gets the same page in its own ink. */
	.lost {
		min-height: 100vh;
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		padding: 2rem 1.5rem;
		text-align: center;
		color: var(--ink);
	}

	.code {
		font-size: 0.75rem;
		letter-spacing: 0.35em;
		text-transform: uppercase;
		color: rgb(var(--ink-rgb) / 0.5);
	}

	h1 {
		font-size: clamp(1.8rem, 5vw, 2.8rem);
		line-height: 1.2;
		font-weight: normal;
	}

	.line {
		max-width: 28rem;
		line-height: 1.6;
		color: rgb(var(--ink-rgb) / 0.75);
	}

	.home {
		margin-top: 1.5rem;
		font-size: 0.7rem;
		letter-spacing: 0.25em;
		text-transform: uppercase;
		color: rgb(var(--ink-rgb) / 0.55);
		text-decoration: none;
	}
	.home:hover,
	.home:focus-visible {
		color: var(--ink);
	}
</style>
