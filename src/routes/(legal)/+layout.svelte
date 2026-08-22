<script>
	let { children } = $props();
</script>

<main class="legal">
	<a class="back" href="/">&larr; Ammoura</a>
	{@render children()}
	<footer class="legal-footer">
		<a href="/privacy">Privacy Policy</a>
		<span aria-hidden="true">·</span>
		<a href="/terms">Terms of Service</a>
		<span aria-hidden="true">·</span>
		<a href="/">Home</a>
	</footer>
</main>

<style>
	/* The root layout disables selection site-wide, which is wrong for a legal
	   document — people need to be able to read, copy and keep these. */
	.legal,
	.legal :global(*) {
		-webkit-user-select: text;
		-moz-user-select: text;
		user-select: text;
	}

	.legal {
		max-width: 46rem;
		margin: 0 auto;
		padding: 4rem 1.5rem 6rem;
		color: #fff;
		font-size: 1rem;
		line-height: 1.75;
	}

	.back {
		display: inline-block;
		margin-bottom: 3rem;
		font-size: 0.7rem;
		letter-spacing: 0.25em;
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.55);
		text-decoration: none;
	}
	.back:hover,
	.back:focus-visible {
		color: #fff;
	}

	.legal :global(h1) {
		font-size: clamp(1.6rem, 4vw, 2.2rem);
		line-height: 1.25;
		margin-bottom: 0.5rem;
	}

	.legal :global(.updated) {
		font-size: 0.7rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.45);
		margin-bottom: 3rem;
	}

	.legal :global(.lede) {
		font-size: 1.05rem;
		color: rgba(255, 255, 255, 0.85);
		border-left: 2px solid rgba(255, 255, 255, 0.25);
		padding-left: 1.25rem;
		margin-bottom: 3rem;
	}

	.legal :global(h2) {
		font-size: 0.75rem;
		letter-spacing: 0.25em;
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.55);
		margin: 3rem 0 1rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.12);
	}

	.legal :global(h3) {
		font-size: 0.95rem;
		margin: 2rem 0 0.5rem;
		color: #fff;
	}

	.legal :global(p) {
		margin-bottom: 1.1rem;
		color: rgba(255, 255, 255, 0.8);
	}

	.legal :global(ul) {
		margin: 0 0 1.4rem 1.1rem;
		color: rgba(255, 255, 255, 0.8);
	}
	.legal :global(li) {
		margin-bottom: 0.5rem;
	}

	.legal :global(a) {
		color: #fff;
	}

	.legal :global(strong) {
		color: #fff;
	}

	.legal :global(table) {
		width: 100%;
		border-collapse: collapse;
		margin-bottom: 1.5rem;
		font-size: 0.9rem;
	}
	.legal :global(th),
	.legal :global(td) {
		text-align: left;
		vertical-align: top;
		padding: 0.6rem 0.75rem 0.6rem 0;
		border-bottom: 1px solid rgba(255, 255, 255, 0.12);
		color: rgba(255, 255, 255, 0.8);
	}
	.legal :global(th) {
		color: #fff;
		font-weight: 600;
		font-size: 0.7rem;
		letter-spacing: 0.15em;
		text-transform: uppercase;
	}

	.legal :global(.note) {
		border: 1px solid rgba(255, 255, 255, 0.2);
		padding: 1.25rem 1.4rem;
		margin: 2rem 0;
		font-size: 0.95rem;
	}

	.legal-footer {
		margin-top: 5rem;
		padding-top: 2rem;
		border-top: 1px solid rgba(255, 255, 255, 0.12);
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		font-size: 0.7rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
	}
	.legal-footer a {
		color: rgba(255, 255, 255, 0.55);
		text-decoration: none;
	}
	.legal-footer a:hover,
	.legal-footer a:focus-visible {
		color: #fff;
	}
	.legal-footer span {
		color: rgba(255, 255, 255, 0.25);
	}

	/* The table is the widest thing here; let it scroll rather than the page. */
	@media (max-width: 560px) {
		.legal {
			padding: 3rem 1.25rem 4rem;
		}
		.legal :global(table) {
			display: block;
			overflow-x: auto;
		}
	}
</style>
