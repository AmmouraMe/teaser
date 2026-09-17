<!--
	Where the name came from.

	Reached from one small cuneiform mark in the corner of the home page and
	from nowhere else — it is a thing to find, not a thing to be sold. It gets
	its own look rather than either of the site's two themes: basalt and
	lamplight, because the object the whole page is about is a two-metre finger
	of black stone that spent most of its life lit by fire.

	The cuneiform is real and rendered from a seven-sign subset of Noto Sans
	Cuneiform served from /fonts. Without a webfont these characters are empty
	boxes on most machines — Linux ships a cuneiform font, Windows and macOS do
	not — and the one thing this page cannot afford is for its own title to be
	tofu.
-->
<script>
	import Seo from '$lib/components/Seo.svelte';

	// ḫa-am-mu-ra-bi, the name as Akkadian scribes wrote it.
	const SIGNS = [
		{ sign: '𒄩', value: 'ḫa' },
		{ sign: '𒄠', value: 'am' },
		{ sign: '𒈬', value: 'mu' },
		{ sign: '𒊏', value: 'ra' },
		{ sign: '𒁉', value: 'bi' }
	];

	const FACTS = [
		{ k: 'Reigned', v: 'c. 1792 – 1750 BC' },
		{ k: 'Sixth king of', v: 'Babylon' },
		{ k: 'Dynasty', v: 'First Babylonian, Amorite' },
		{ k: 'Laws', v: '282, cut into basalt' },
		{ k: 'The stele now', v: 'Musée du Louvre, Paris' }
	];
</script>

<Seo
	title="Where the name came from | Ammoura"
	description="Ammoura is named after Hammurabi — ʻAmmurāpi in his own language, from ʻAmmu, paternal kinsman, and Rāpi, healer. The kinsman is a healer."
	path="/hammurabi"
/>

<div class="tablet">
	<div class="grain" aria-hidden="true"></div>

	<main class="chamber">
		<a class="back" href="/">&larr; Ammoura</a>

		<header class="stone">
			<p class="eyebrow">Where the name came from</p>
			<h1 class="name" lang="akk">𒄩𒄠𒈬𒊏𒁉</h1>
			<p class="roman">ʻAmmurāpi</p>
		</header>

		<!-- The five signs, set out the way a museum card sets them out. -->
		<ol class="signs" aria-label="The name, sign by sign">
			{#each SIGNS as s (s.value)}
				<li>
					<span class="glyph" lang="akk">{s.sign}</span>
					<span class="value">{s.value}</span>
				</li>
			{/each}
		</ol>

		<p class="lede">
			Ammoura is named after a man who has been dead for about three thousand
			seven hundred and seventy years.
		</p>

		<p>
			Hammurabi was the sixth king of Babylon and reigned from around 1792 to
			1750 BC. He was an Amorite, and in his own language his name was
			<em>ʻAmmurāpi</em>. It is built out of two ordinary words.
		</p>

		<!-- The reason the page exists. Everything above is setting, this is the
		     point, so it gets to be the one framed thing on the page. -->
		<figure class="etymology">
			<div class="parts">
				<div class="part">
					<span class="word">ʻAmmu</span>
					<span class="gloss">paternal kinsman</span>
				</div>
				<span class="plus" aria-hidden="true">+</span>
				<div class="part">
					<span class="word">Rāpi</span>
					<span class="gloss">healer</span>
				</div>
			</div>
			<figcaption>the kinsman is a healer</figcaption>
		</figure>

		<h2>Why him</h2>

		<p>
			Not for the conquests, though there were plenty — Larsa, Eshnunna, Mari,
			nearly all of Mesopotamia under one rule by the end. Those are the part
			of him the centuries quietly dropped.
		</p>

		<p>
			What they kept is a block of basalt taller than a man, carved with two
			hundred and eighty-two laws, and <strong>set up in public</strong>. That
			last part is the whole of it. Before, the rules lived with the people who
			enforced them, and you found out what they were by breaking one. Cutting
			them into stone in the open changed who was allowed to know.
		</p>

		<p>
			That is the idea this company is named after. The tools for building a
			business have mostly belonged to people who could already afford them.
			We would rather put them where you can reach them.
		</p>

		<h2>What happened to the stone</h2>

		<div class="monument">
			<!-- The stele, at roughly the proportions of the real one: two and a
			     quarter metres of basalt and only sixty-odd centimetres across, with
			     the relief panel at its head and the laws filling everything below.
			     Drawn rather than photographed — a photograph of the object would be
			     the Louvre's, not ours. -->
			<svg class="stele" viewBox="0 0 120 380" aria-hidden="true">
				<defs>
					<linearGradient id="basalt" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0" stop-color="#4a3543" />
						<stop offset="0.4" stop-color="#2a1c2b" />
						<stop offset="1" stop-color="#160e1a" />
					</linearGradient>
				</defs>
				<path
					d="M26 376 L26 76 Q26 20 60 8 Q94 20 94 76 L94 376 Z"
					fill="url(#basalt)" stroke="rgba(255,178,92,0.3)" stroke-width="1.2" />
				<!-- The relief: the king standing before the seated sun god, reduced to
				     the two figures and the line they stand on. -->
				<g opacity="0.5">
					<rect x="44" y="44" width="7" height="26" rx="2" fill="rgba(255,210,150,0.75)" />
					<rect x="64" y="52" width="9" height="18" rx="2" fill="rgba(255,210,150,0.6)" />
					<line x1="36" y1="72" x2="84" y2="72" stroke="rgba(255,178,92,0.65)" stroke-width="1.4" />
				</g>
				<line x1="32" y1="96" x2="88" y2="96" stroke="rgba(255,178,92,0.35)" stroke-width="1" />
				<!-- The laws, as the bands they are, fading as the shaft recedes. -->
				{#each Array(30) as _, i}
					<line
						x1="35" y1={108 + i * 8.7} x2="85" y2={108 + i * 8.7}
						stroke="rgba(232,213,188,{0.26 - i * 0.006})" stroke-width="2.4" />
				{/each}
			</svg>

			<div class="monument-text">
				<p>
					It was looted. The Elamites carried it off to Susa, in what is now
					Iran, and there it stayed, face-down in the dirt, for something like
					twenty-six centuries. It was dug up in 1901. It stands in the Louvre
					today, and the laws on it are still legible.
				</p>
				<p class="caption">
					Two and a quarter metres of basalt. Two hundred and eighty-two laws,
					and a relief at the head of it showing the king receiving them.
				</p>
			</div>
		</div>

		<dl class="facts">
			{#each FACTS as f (f.k)}
				<div>
					<dt>{f.k}</dt>
					<dd>{f.v}</dd>
				</div>
			{/each}
		</dl>

		<p class="close">
			<span class="mark" lang="akk">𒈗</span>
			The name kept the middle of his and let the rest go.
			<em>ʻAmm<strong>ura</strong>pi.</em> Ammoura.
		</p>

		<footer class="colophon">
			<a href="https://en.wikipedia.org/wiki/Hammurabi" target="_blank" rel="noopener noreferrer">
				Hammurabi on Wikipedia
			</a>
			<span aria-hidden="true">·</span>
			<a href="/">Back to Ammoura</a>
		</footer>
	</main>
</div>

<style>
	/* The home page's reset is scoped to the home page, so this one has to say so
	   itself — without it, padding is added outside every declared width here. */
	.tablet,
	.tablet :global(*),
	.tablet :global(*::before),
	.tablet :global(*::after) {
		box-sizing: border-box;
	}

	/* The root layout turns selection off for the whole site, which is wrong for
	   a page of prose. People should be able to take a quote out of it. */
	.tablet,
	.tablet :global(*) {
		-webkit-user-select: text;
		-moz-user-select: text;
		user-select: text;
	}

	/* Its own ground, painted over whichever theme the visitor arrived in. The
	   two site themes are a joke with two halves; this page is not part of it. */
	.tablet {
		--clay: #e8d5bc;
		--clay-dim: rgba(232, 213, 188, 0.62);
		--clay-faint: rgba(232, 213, 188, 0.34);
		--amber: #ffb25c;
		--ember: #ff6a3d;
		position: relative;
		min-height: 100vh;
		min-height: 100dvh;
		color: var(--clay);
		font-family: 'Georgia', 'Liberation Serif', serif;
		/* Lamplight from above and to the left, falling off into bitumen. */
		background:
			radial-gradient(120% 70% at 30% -10%, rgba(255, 178, 92, 0.16), transparent 60%),
			radial-gradient(90% 60% at 85% 8%, rgba(255, 106, 61, 0.09), transparent 55%),
			linear-gradient(180deg, #1a1018 0%, #140c16 45%, #0d080f 100%);
	}

	/* Stone is not smooth. One turbulence tile, held very low — enough that the
	   flat colour above stops reading as a screen. */
	.grain {
		position: absolute;
		inset: 0;
		pointer-events: none;
		opacity: 0.32;
		mix-blend-mode: overlay;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E");
	}

	.chamber {
		position: relative;
		max-width: 44rem;
		margin: 0 auto;
		padding: 3rem 1.5rem 6rem;
		font-size: 1.02rem;
		line-height: 1.85;
	}

	.back {
		display: inline-block;
		margin-bottom: 4rem;
		font-size: 0.68rem;
		letter-spacing: 0.26em;
		text-transform: uppercase;
		color: var(--clay-faint);
		text-decoration: none;
		transition: color 0.2s ease;
	}
	.back:hover,
	.back:focus-visible {
		color: var(--amber);
	}

	/* ── The head ── */
	.stone {
		text-align: center;
		padding: 2.5rem 0 3rem;
		margin-bottom: 2.5rem;
	}

	/* ── The monument ──
	   Beside the paragraph that is about it, not behind the title. At its real
	   proportions it is a narrow thing, and a narrow thing behind a wide line of
	   text reads as a blade rather than a stone. */
	.monument {
		display: grid;
		grid-template-columns: 116px 1fr;
		gap: 2.4rem;
		align-items: start;
		margin: 0 0 1.5rem;
	}

	.stele {
		width: 116px;
		height: 368px;
		filter: drop-shadow(0 18px 30px rgba(0, 0, 0, 0.55));
	}

	.caption {
		font-size: 0.82rem;
		line-height: 1.7;
		color: var(--clay-faint) !important;
		border-left: 1px solid rgba(255, 178, 92, 0.25);
		padding-left: 1rem;
	}

	.eyebrow {
		font-family: 'DejaVu Sans', 'Liberation Sans', sans-serif;
		font-size: 0.62rem;
		letter-spacing: 0.34em;
		text-transform: uppercase;
		color: var(--clay-faint);
		margin-bottom: 2.4rem;
	}

	/* The name, cut rather than printed: a hairline of lamplight on the top edge
	   of each stroke and shadow below it, which is what an incised character
	   does under a light that is above it. */
	@font-face {
		font-family: 'Ammoura Cuneiform';
		src: url('/fonts/cuneiform-subset.woff2') format('woff2');
		font-display: swap;
		unicode-range: U+12000-123FF;
	}

	.name {
		font-family: 'Ammoura Cuneiform', 'Noto Sans Cuneiform', serif;
		font-size: clamp(2.6rem, 11vw, 5rem);
		font-weight: 400;
		line-height: 1.25;
		color: #f0ddc4;
		letter-spacing: 0.06em;
		margin: 0 0 1.2rem;
		text-shadow:
			0 -1px 0 rgba(255, 210, 150, 0.5),
			0 2px 3px rgba(0, 0, 0, 0.85),
			0 0 34px rgba(255, 178, 92, 0.24);
	}

	.roman {
		font-size: 1.05rem;
		font-style: italic;
		letter-spacing: 0.16em;
		color: var(--amber);
	}

	/* ── The five signs ── */
	.signs {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 0.6rem;
		max-width: 26rem;
		list-style: none;
		padding: 0;
		margin: 0 auto 3.5rem;
	}

	.signs li {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 0.85rem 0.4rem 0.7rem;
		border: 1px solid rgba(232, 213, 188, 0.14);
		border-radius: 2px;
		background: rgba(255, 178, 92, 0.03);
	}

	.glyph {
		font-family: 'Ammoura Cuneiform', 'Noto Sans Cuneiform', serif;
		font-size: 1.7rem;
		line-height: 1;
		color: #f0ddc4;
		text-shadow: 0 -1px 0 rgba(255, 210, 150, 0.35), 0 1px 2px rgba(0, 0, 0, 0.8);
	}

	.value {
		font-family: 'DejaVu Sans', 'Liberation Sans', sans-serif;
		font-size: 0.66rem;
		letter-spacing: 0.16em;
		color: var(--clay-faint);
	}

	/* ── Prose ── */
	.chamber :global(p) {
		margin-bottom: 1.5rem;
		color: var(--clay-dim);
	}

	.lede {
		font-size: 1.22rem;
		line-height: 1.7;
		color: var(--clay) !important;
	}

	.chamber :global(strong) {
		color: #f3e4cf;
		font-weight: 400;
		padding: 0.08em 0.28em;
		margin: 0 -0.08em;
		border-radius: 2px;
		background: rgba(255, 178, 92, 0.12);
		box-shadow: inset 0 0 0 1px rgba(255, 178, 92, 0.16);
	}

	.chamber :global(em) {
		color: var(--amber);
		font-style: italic;
	}

	h2 {
		margin: 3rem 0 1.2rem;
		font-size: 0.68rem;
		font-family: 'DejaVu Sans', 'Liberation Sans', sans-serif;
		font-weight: 400;
		letter-spacing: 0.3em;
		text-transform: uppercase;
		color: var(--amber);
	}
	h2::after {
		content: '';
		display: block;
		width: 2.4rem;
		height: 1px;
		margin-top: 0.9rem;
		background: linear-gradient(90deg, rgba(255, 178, 92, 0.55), transparent);
	}

	/* ── The etymology ── */
	.etymology {
		margin: 3rem 0;
		padding: 2.2rem 1.5rem 1.8rem;
		border: 1px solid rgba(255, 178, 92, 0.2);
		border-radius: 2px;
		background:
			radial-gradient(120% 140% at 50% 0%, rgba(255, 178, 92, 0.07), transparent 70%);
		text-align: center;
	}

	.parts {
		display: flex;
		align-items: flex-start;
		justify-content: center;
		gap: 1.6rem;
	}

	.part {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.word {
		font-size: 1.5rem;
		font-style: italic;
		color: var(--clay);
	}

	.gloss {
		font-family: 'DejaVu Sans', 'Liberation Sans', sans-serif;
		font-size: 0.62rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--clay-faint);
	}

	.plus {
		font-size: 1.1rem;
		line-height: 2.2;
		color: rgba(255, 178, 92, 0.5);
	}

	.etymology figcaption {
		margin-top: 1.8rem;
		padding-top: 1.4rem;
		border-top: 1px solid rgba(232, 213, 188, 0.1);
		font-size: 1.15rem;
		font-style: italic;
		color: var(--amber);
	}

	/* ── Facts ── */
	.facts {
		margin: 2.5rem 0 3rem;
		border-top: 1px solid rgba(232, 213, 188, 0.1);
	}

	.facts div {
		display: flex;
		justify-content: space-between;
		gap: 1.5rem;
		padding: 0.75rem 0;
		border-bottom: 1px solid rgba(232, 213, 188, 0.07);
	}

	.facts dt {
		font-family: 'DejaVu Sans', 'Liberation Sans', sans-serif;
		font-size: 0.62rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--clay-faint);
		padding-top: 0.32rem;
	}

	.facts dd {
		margin: 0;
		text-align: right;
		color: var(--clay-dim);
	}

	/* ── The last line ── */
	.close {
		margin-top: 3.5rem;
		padding-top: 2rem;
		border-top: 1px solid rgba(232, 213, 188, 0.1);
		font-size: 1.1rem;
		color: var(--clay) !important;
	}

	.mark {
		font-family: 'Ammoura Cuneiform', 'Noto Sans Cuneiform', serif;
		font-size: 1.5rem;
		margin-right: 0.5rem;
		color: rgba(255, 178, 92, 0.6);
		vertical-align: -0.15em;
	}

	.colophon {
		display: flex;
		flex-wrap: wrap;
		gap: 0.7rem;
		margin-top: 3.5rem;
		font-family: 'DejaVu Sans', 'Liberation Sans', sans-serif;
		font-size: 0.64rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
	}

	.colophon a {
		color: var(--clay-faint);
		text-decoration: none;
		transition: color 0.2s ease;
	}
	.colophon a:hover,
	.colophon a:focus-visible {
		color: var(--amber);
	}
	.colophon span {
		color: rgba(232, 213, 188, 0.2);
	}

	@media (max-width: 560px) {
		.chamber {
			padding: 2.2rem 1.25rem 4.5rem;
		}
		.back {
			margin-bottom: 2.5rem;
		}
		.stele {
			width: 150px;
			height: 300px;
			opacity: 0.4;
		}
		.signs {
			gap: 0.4rem;
			margin-bottom: 2.5rem;
		}
		.signs li {
			padding: 0.7rem 0.25rem 0.55rem;
		}
		.glyph {
			font-size: 1.45rem;
		}
		.monument {
			grid-template-columns: 1fr;
			gap: 1.6rem;
			justify-items: center;
		}
		.monument-text {
			width: 100%;
		}
		.parts {
			flex-direction: column;
			gap: 0.9rem;
			align-items: center;
		}
		.plus {
			line-height: 1;
		}
		.facts div {
			flex-direction: column;
			gap: 0.2rem;
		}
		.facts dd {
			text-align: left;
		}
	}

	@media (prefers-reduced-motion: no-preference) {
		.name {
			animation: kindle 1.4s ease-out both;
		}
	}

	/* Light coming up on the stone, once, as the page settles. */
	@keyframes kindle {
		from {
			opacity: 0;
			text-shadow: 0 -1px 0 rgba(255, 210, 150, 0), 0 2px 3px rgba(0, 0, 0, 0), 0 0 0 rgba(255, 178, 92, 0);
		}
		to {
			opacity: 1;
		}
	}
</style>
