<!--
	Where the name came from.

	Reached from one small cuneiform mark in the corner of the home page and
	from nowhere else — a thing to find, not a thing to be sold. It gets its own
	look rather than either of the site's two themes: a dark room, one warm
	light, and a wall of writing nobody in it can read.

	Two kinds of cuneiform here, and the difference matters:

	- The signs that are LABELLED are real, and the readings given for them are
	  the standard ones. The five in the name spell ḫa-am-mu-ra-bi.
	- The wall behind everything is TEXTURE — the same real signs, shuffled. It
	  is the look of an inscription, not a sentence. It is aria-hidden, it says
	  nothing, and nothing on the page claims otherwise.

	All of it renders from a 52-sign subset of Noto Sans Cuneiform served out of
	/fonts. Without a webfont these characters are empty boxes on most machines
	— Linux ships a cuneiform font, Windows and macOS do not.
-->
<script>
	import { onMount } from 'svelte';
	import Seo from '$lib/components/Seo.svelte';
	import NetIntro from './NetIntro.svelte';

	// ── The name ──
	const NAME = [
		{ sign: '𒄩', value: 'ḫa' },
		{ sign: '𒄠', value: 'am' },
		{ sign: '𒈬', value: 'mu' },
		{ sign: '𒊏', value: 'ra' },
		{ sign: '𒁉', value: 'bi' }
	];

	// ── The lexicon ──
	// Real signs with their standard readings. Deliberately the ordinary ones —
	// sky, water, house, city, child — because that is what most of a writing
	// system is for, and because it makes the point that this was a language
	// people used to run a life, not an ornament.
	const LEXICON = [
		{ sign: '𒀭', read: 'AN · DINGIR', mean: 'sky, god' },
		{ sign: '𒌓', read: 'UD · UTU', mean: 'sun, day' },
		{ sign: '𒈗', read: 'LUGAL', mean: 'king' },
		{ sign: '𒂗', read: 'EN', mean: 'lord' },
		{ sign: '𒂍', read: 'E₂', mean: 'house, temple' },
		{ sign: '𒆠', read: 'KI', mean: 'earth, place' },
		{ sign: '𒌷', read: 'URU', mean: 'city' },
		{ sign: '𒆳', read: 'KUR', mean: 'mountain, land' },
		{ sign: '𒀀', read: 'A', mean: 'water' },
		{ sign: '𒅆', read: 'IGI', mean: 'eye, to see' },
		{ sign: '𒌉', read: 'DUMU', mean: 'child' },
		{ sign: '𒅗', read: 'KA', mean: 'mouth, to speak' },
		{ sign: '𒁲', read: 'DI', mean: 'case, judgement' },
		{ sign: '𒃻', read: 'NIG₂', mean: 'thing' },
		{ sign: '𒁹', read: 'DIŠ', mean: 'one' },
		{ sign: '𒈾', read: 'NA', mean: 'stone' }
	];

	const FACTS = [
		{ k: 'Reigned', v: 'c. 1792 – 1750 BC' },
		{ k: 'Sixth king of', v: 'Babylon' },
		{ k: 'Dynasty', v: 'First Babylonian, Amorite' },
		{ k: 'Laws', v: '282' },
		{ k: 'Buried for', v: '≈ 2,600 years' },
		{ k: 'The stone now', v: 'Louvre, Paris' }
	];

	// ── The wall ──
	// Every sign in the subset, shuffled into courses. Seeded rather than
	// random: the server renders this too, and a wall that comes out different
	// on the client is a hydration mismatch Svelte would rebuild the lot over.
	// Same seed, same wall, both sides.
	const POOL = [
		'𒀭', '𒌓', '𒈗', '𒂗', '𒂍', '𒆠', '𒌷', '𒆳', '𒀀', '𒅆', '𒌉', '𒅗',
		'𒁲', '𒃻', '𒁹', '𒈾', '𒄩', '𒄠', '𒈬', '𒊏', '𒁉', '𒀸', '𒁀', '𒁕',
		'𒂀', '𒂅', '𒃲', '𒄀', '𒄑', '𒄖', '𒅅', '𒆍', '𒆪', '𒇻', '𒈠', '𒈦',
		'𒉆', '𒉌', '𒉡', '𒊒', '𒊭', '𒋛', '𒋞', '𒌅', '𒌨', '𒍝', '𒍢', '𒐊',
		'𒄭', '𒁾', '𒀊', '𒂆'
	];

	/** Mulberry32 — small, fast, and identical on both sides of hydration. */
	function seeded(seed) {
		return function () {
			seed |= 0;
			seed = (seed + 0x6d2b79f5) | 0;
			let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
			t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
	}

	const pool = POOL;

	const rand = seeded(1792);
	const wall = Array.from({ length: 11 }, () =>
		Array.from({ length: 34 }, () => POOL[Math.floor(rand() * POOL.length)]).join('')
	);

	// Which lexicon sign is open. Hover and focus both set it, so it works from
	// a keyboard and never needs a click.
	let lit = $state(-1);

	// Sections rise as they come into view — an observer rather than a scroll
	// handler, so it costs nothing while nothing is happening. Skipped whole for
	// anyone who asked for less motion, which is why the class is set in JS: no
	// script, no hidden content.
	// The cold open runs over the top of the page. While it is up the page
	// underneath does not scroll, so the sequence cannot be scrolled out from
	// behind — see `.held` below.
	let intro = $state(true);
	function introDone() {
		intro = false;
	}

	let reveal = $state(false);
	onMount(() => {
		if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
		reveal = true;
		const io = new IntersectionObserver(
			(entries) => {
				for (const e of entries) {
					if (e.isIntersecting) {
						e.target.classList.add('seen');
						io.unobserve(e.target);
					}
				}
			},
			{ rootMargin: '0px 0px -12% 0px' }
		);
		for (const el of document.querySelectorAll('[data-rise]')) io.observe(el);
		return () => io.disconnect();
	});
</script>

<Seo
	title="Where the name came from | Ammoura"
	description="Ammoura is named after Hammurabi — ʻAmmurāpi in his own language, from ʻAmmu, paternal kinsman, and Rāpi, healer. The kinsman is a healer."
	path="/hammurabi"
/>

<NetIntro signs={NAME} {pool} done={introDone} />

<div class="room" class:reveal class:held={intro}>
	<!-- The wall. Texture, not text. -->
	<div class="wall" aria-hidden="true">
		{#each wall as row, i}
			<div class="course" class:rtl={i % 2 === 1} style:--dur="{150 + i * 11}s">
				<span>{row}</span><span>{row}</span>
			</div>
		{/each}
	</div>
	<div class="grain" aria-hidden="true"></div>
	<div class="vignette" aria-hidden="true"></div>

	<a class="back" href="/">&larr; Ammoura</a>

	<header class="hero">
		<p class="eyebrow">Where the name came from</p>
		<h1 class="name" lang="akk">𒄩𒄠𒈬𒊏𒁉</h1>
		<p class="roman">ʻAmmurāpi</p>
		<span class="cue" aria-hidden="true"></span>
	</header>

	<main>
		<section class="band" data-rise>
			<ol class="name-signs" aria-label="The name, sign by sign">
				{#each NAME as s (s.value)}
					<li>
						<span class="glyph" lang="akk" aria-hidden="true">{s.sign}</span>
						<span class="value">{s.value}</span>
					</li>
				{/each}
			</ol>
		</section>

		<section class="band prose" data-rise>
			<p class="lede">
				Ammoura is named after a man who has been dead for about three thousand
				seven hundred and seventy years.
			</p>
			<p>
				Hammurabi was the sixth king of Babylon and reigned from around 1792 to
				1750 BC. He was an Amorite, and in his own language his name was
				<em>ʻAmmurāpi</em>. It is built out of two ordinary words.
			</p>
		</section>

		<!-- The point of the page, given the whole width. -->
		<section class="band etymology" data-rise>
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
			<p class="verdict">the kinsman is a healer</p>
		</section>

		<section class="band prose" data-rise>
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
		</section>

		<!-- ── The lexicon ──
		     The signs drifting behind everything else, brought forward and given
		     their readings. -->
		<section class="band lexicon-band" data-rise>
			<h2 class="centred">What the marks say</h2>
			<p class="note">
				Sixteen of the signs moving behind this page. The rest are the same ones
				shuffled — a wall of writing, not a sentence.
			</p>
			<ul class="lexicon">
				{#each LEXICON as l, i (l.sign)}
					<li>
						<button
							type="button"
							class="cell"
							class:lit={lit === i}
							onmouseenter={() => (lit = i)}
							onmouseleave={() => (lit = -1)}
							onfocus={() => (lit = i)}
							onblur={() => (lit = -1)}
						>
							<span class="cell-glyph" lang="akk" aria-hidden="true">{l.sign}</span>
							<span class="cell-read">{l.read}</span>
							<span class="cell-mean">{l.mean}</span>
						</button>
					</li>
				{/each}
			</ul>
		</section>

		<section class="band monument-band" data-rise>
			<div class="monument">
				<!-- At roughly the proportions of the real one: two and a quarter metres
				     of basalt, sixty-odd centimetres across, the relief at its head and
				     the laws filling everything below. Drawn rather than photographed —
				     a photograph of the object would be the Louvre's, not ours. -->
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
						fill="url(#basalt)" stroke="rgba(255,178,92,0.32)" stroke-width="1.2" />
					<g opacity="0.55">
						<rect x="44" y="44" width="7" height="26" rx="2" fill="rgba(255,210,150,0.8)" />
						<rect x="64" y="52" width="9" height="18" rx="2" fill="rgba(255,210,150,0.62)" />
						<line x1="36" y1="72" x2="84" y2="72" stroke="rgba(255,178,92,0.7)" stroke-width="1.4" />
					</g>
					<line x1="32" y1="96" x2="88" y2="96" stroke="rgba(255,178,92,0.35)" stroke-width="1" />
					{#each Array(30) as _, i}
						<line
							x1="35" y1={108 + i * 8.7} x2="85" y2={108 + i * 8.7}
							stroke="rgba(232,213,188,{0.26 - i * 0.006})" stroke-width="2.4" />
					{/each}
				</svg>

				<div class="monument-text">
					<h2>What happened to the stone</h2>
					<p>
						It was looted. The Elamites carried it off to Susa, in what is now
						Iran, and there it stayed, face-down in the dirt, for something like
						twenty-six centuries. It was dug up in 1901. It stands in the Louvre
						today, and the laws on it are still legible.
					</p>
					<p class="caption">
						Two and a quarter metres of basalt. Two hundred and eighty-two laws,
						and a relief at the head of it showing the king receiving them from
						Shamash — <span lang="akk">𒌓</span>, the sun.
					</p>
				</div>
			</div>
		</section>

		<section class="band" data-rise>
			<dl class="facts">
				{#each FACTS as f (f.k)}
					<div>
						<dt>{f.k}</dt>
						<dd>{f.v}</dd>
					</div>
				{/each}
			</dl>
		</section>

		<section class="band close-band" data-rise>
			<p class="close">
				<span class="mark" lang="akk" aria-hidden="true">𒈗</span>
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
		</section>
	</main>
</div>

<style>
	@font-face {
		font-family: 'Ammoura Cuneiform';
		src: url('/fonts/cuneiform-subset.woff2') format('woff2');
		font-display: swap;
		unicode-range: U+12000-123FF;
	}

	/* The home page's reset is scoped to the home page, so this one says it
	   itself — without it, padding is added outside every declared width here. */
	.room,
	.room :global(*),
	.room :global(*::before),
	.room :global(*::after) {
		box-sizing: border-box;
	}

	/* The root layout turns selection off site-wide, which is wrong for a page of
	   prose. People should be able to take a quote out of it. */
	.room,
	.room :global(*) {
		-webkit-user-select: text;
		-moz-user-select: text;
		user-select: text;
	}

	/* ── The room ──
	   Its own ground, painted over whichever theme the visitor arrived in: one
	   warm source high and left, everything else falling away to nothing. */
	.room {
		--clay: #e8d5bc;
		--clay-dim: rgba(232, 213, 188, 0.6);
		--clay-faint: rgba(232, 213, 188, 0.3);
		--amber: #ffb25c;

		/* ── Type scale ──
		   One multiplier for everything that is read, so the page can be set at
		   reading size on a phone and at 1.9× that on a desktop, where it has the
		   room and the whole point is that it feels like standing in front of
		   something large. The measure is multiplied with it: doubling the type
		   inside a fixed column would leave twenty characters to the line. */
		--fs: 1;
		--measure: calc(46rem * var(--fs));

		position: relative;
		width: 100%;
		overflow-x: clip;
		color: var(--clay);
		font-family: 'Georgia', 'Liberation Serif', serif;
		background:
			radial-gradient(90% 50% at 22% -6%, rgba(255, 178, 92, 0.15), transparent 62%),
			radial-gradient(70% 45% at 88% 12%, rgba(255, 106, 61, 0.07), transparent 58%),
			#0a060c;
	}

	@media (min-width: 1024px) {
		.room {
			--fs: 1.9;
		}
	}

	/* Held still while the intro is over it. Without this the page can be
	   scrolled behind the overlay, and the sequence tears away to reveal
	   somewhere halfway down. */
	.held {
		max-height: 100vh;
		overflow: hidden;
	}

	/* ── The wall ──
	   Courses of shuffled signs, each drifting at its own pace so the surface
	   never settles into a pattern the eye can lock onto. Fixed, so it sits
	   behind the whole page rather than scrolling with it. */
	.wall {
		position: fixed;
		inset: 0;
		z-index: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 2.4vw;
		pointer-events: none;
		overflow: hidden;
		font-family: 'Ammoura Cuneiform', 'Noto Sans Cuneiform', serif;
		font-size: clamp(1.6rem, 3.2vw, 3.1rem);
		line-height: 1;
		color: #ffb25c;
		opacity: 0.055;
		/* The edge falloff is the vignette's job. A mask over a layer that is
		   moving underneath costs a re-raster of the whole thing every frame,
		   and the vignette sits on top of the wall anyway. */
	}

	.course {
		display: flex;
		flex: none;
		width: max-content;
		white-space: nowrap;
		/* Each course is promoted to its own layer, so drifting it is a transform
		   the compositor applies rather than a repaint of the wall. */
		will-change: transform;
		contain: paint;
	}

	.course span {
		padding-right: 1.4vw;
	}

	/* Two copies per course, translated by half: the loop closes on itself with
	   no gap. Alternate courses run the same keyframes backwards. */
	@media (prefers-reduced-motion: no-preference) {
		.course {
			animation: drift var(--dur) linear infinite;
		}
		.course.rtl {
			animation-direction: reverse;
		}
	}

	@keyframes drift {
		from {
			transform: translate3d(0, 0, 0);
		}
		to {
			transform: translate3d(-50%, 0, 0);
		}
	}

	/* Stone is not smooth. */
	.grain {
		position: fixed;
		inset: 0;
		z-index: 1;
		pointer-events: none;
		opacity: 0.16;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E");
	}

	/* The dark closing in at the corners is most of the mood. */
	.vignette {
		position: fixed;
		inset: 0;
		z-index: 1;
		pointer-events: none;
		background: radial-gradient(105% 70% at 50% 42%, transparent 26%, rgba(6, 3, 7, 0.94) 92%);
	}

	.back,
	main,
	.hero {
		position: relative;
		z-index: 2;
	}

	.back {
		position: absolute;
		top: 2rem;
		left: 2rem;
		z-index: 3;
		font-size: calc(0.66rem * var(--fs));
		letter-spacing: 0.26em;
		text-transform: uppercase;
		color: var(--clay-faint);
		text-decoration: none;
		transition: color 0.25s ease;
	}
	.back:hover,
	.back:focus-visible {
		color: var(--amber);
	}

	/* ── The name ── */
	.hero {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		min-height: 100dvh;
		padding: 7rem 1.5rem 4rem;
		text-align: center;
	}

	.eyebrow {
		font-family: 'DejaVu Sans', 'Liberation Sans', sans-serif;
		font-size: calc(0.6rem * var(--fs));
		letter-spacing: 0.4em;
		text-transform: uppercase;
		color: var(--clay-faint);
		margin-bottom: 3rem;
	}

	/* Cut, not printed: a hairline of light on the top edge of every stroke and
	   shadow under it, which is what an incised character does when the lamp is
	   above it. Sized off the viewport rather than the type scale — five signs
	   at 1.9× the cap below would be wider than the screen they are on. */
	.name {
		font-family: 'Ammoura Cuneiform', 'Noto Sans Cuneiform', serif;
		font-size: clamp(2.8rem, 13vw, 13rem);
		font-weight: 400;
		line-height: 1.1;
		max-width: 100%;
		color: #f4e3cb;
		letter-spacing: 0.04em;
		margin: 0 0 2.2rem;
		text-shadow:
			0 -1px 0 rgba(255, 214, 158, 0.55),
			0 3px 5px rgba(0, 0, 0, 0.9),
			0 0 70px rgba(255, 178, 92, 0.22);
	}

	.roman {
		font-size: calc(0.72rem * var(--fs));
		font-style: italic;
		letter-spacing: 0.22em;
		color: var(--amber);
	}

	/* A thin line down from the name, so it is obvious there is more below. */
	.cue {
		display: block;
		width: 1px;
		height: 5rem;
		margin-top: 4rem;
		background: linear-gradient(180deg, rgba(255, 178, 92, 0.5), transparent);
	}

	/* ── Bands ──
	   Full width by default. Only what has to be read is held to a measure. */
	.band {
		padding: clamp(3.5rem, 7vw, 8rem) 2rem;
	}

	.prose {
		width: min(var(--measure), 100%);
		margin: 0 auto;
	}

	@media (prefers-reduced-motion: no-preference) {
		.reveal [data-rise] {
			opacity: 0;
			transform: translateY(26px);
			transition: opacity 0.9s ease, transform 0.9s cubic-bezier(0.2, 0.7, 0.3, 1);
		}
		.reveal :global([data-rise].seen) {
			opacity: 1;
			transform: none;
		}
	}

	/* ── The five ── */
	.name-signs {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: clamp(0.4rem, 1.2vw, 1.4rem);
		max-width: 92rem;
		margin: 0 auto;
		padding: 0;
		list-style: none;
	}

	.name-signs li {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: clamp(1rem, 3vw, 3rem) 0.3rem;
		border: 1px solid rgba(232, 213, 188, 0.1);
		background: rgba(255, 178, 92, 0.022);
	}

	.glyph {
		font-family: 'Ammoura Cuneiform', 'Noto Sans Cuneiform', serif;
		font-size: clamp(1.5rem, 5vw, 5rem);
		line-height: 1;
		color: #f0ddc4;
		text-shadow: 0 -1px 0 rgba(255, 210, 150, 0.35), 0 2px 3px rgba(0, 0, 0, 0.85);
	}

	.value {
		font-family: 'DejaVu Sans', 'Liberation Sans', sans-serif;
		font-size: calc(0.6rem * var(--fs));
		letter-spacing: 0.2em;
		color: var(--clay-faint);
	}

	/* ── Prose ── */
	.prose :global(p),
	.monument-text :global(p) {
		margin-bottom: calc(1.1rem * var(--fs));
		font-size: calc(1.02rem * var(--fs));
		line-height: 1.85;
		color: var(--clay-dim);
	}

	.lede {
		font-size: calc(1.5rem * var(--fs)) !important;
		line-height: 1.5 !important;
		color: var(--clay) !important;
	}

	.room :global(strong) {
		color: #f5e7d2;
		font-weight: 400;
		padding: 0.08em 0.3em;
		margin: 0 -0.08em;
		background: rgba(255, 178, 92, 0.13);
		box-shadow: inset 0 0 0 1px rgba(255, 178, 92, 0.18);
	}

	.room :global(em) {
		color: var(--amber);
		font-style: italic;
	}

	h2 {
		margin: 0 0 1.8rem;
		font-size: calc(0.64rem * var(--fs));
		font-family: 'DejaVu Sans', 'Liberation Sans', sans-serif;
		font-weight: 400;
		letter-spacing: 0.34em;
		text-transform: uppercase;
		color: var(--amber);
	}
	h2.centred {
		text-align: center;
	}
	h2::after {
		content: '';
		display: block;
		width: 2.6rem;
		height: 1px;
		margin: 1.1rem 0 0;
		background: linear-gradient(90deg, rgba(255, 178, 92, 0.6), transparent);
	}
	h2.centred::after {
		margin: 1.1rem auto 0;
		background: linear-gradient(90deg, transparent, rgba(255, 178, 92, 0.6), transparent);
	}

	/* ── The etymology ── */
	.etymology {
		text-align: center;
		border-block: 1px solid rgba(255, 178, 92, 0.14);
		background: radial-gradient(70% 140% at 50% 50%, rgba(255, 178, 92, 0.06), transparent 70%);
	}

	.parts {
		display: flex;
		align-items: flex-start;
		justify-content: center;
		gap: clamp(1.5rem, 7vw, 7rem);
	}

	.part {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}

	.word {
		font-size: clamp(1.7rem, 5vw, 4.4rem);
		font-style: italic;
		line-height: 1.1;
		color: var(--clay);
	}

	.gloss {
		font-family: 'DejaVu Sans', 'Liberation Sans', sans-serif;
		font-size: calc(0.58rem * var(--fs));
		letter-spacing: 0.24em;
		text-transform: uppercase;
		color: var(--clay-faint);
	}

	.plus {
		font-size: clamp(1rem, 2.4vw, 2rem);
		line-height: 2.4;
		color: rgba(255, 178, 92, 0.45);
	}

	.verdict {
		margin: clamp(2rem, 4.5vw, 4rem) 0 0;
		font-size: clamp(1.15rem, 3vw, 2.8rem);
		font-style: italic;
		color: var(--amber);
	}

	/* ── The lexicon ── */
	.lexicon-band {
		border-top: 1px solid rgba(232, 213, 188, 0.07);
	}

	.note {
		width: min(calc(30rem * var(--fs)), 100%);
		margin: 0 auto clamp(2.5rem, 4vw, 4rem);
		text-align: center;
		font-size: calc(0.82rem * var(--fs));
		line-height: 1.75;
		color: var(--clay-faint);
	}

	.lexicon {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(clamp(7rem, 12vw, 14rem), 1fr));
		gap: 1px;
		max-width: 132rem;
		margin: 0 auto;
		padding: 0;
		list-style: none;
		background: rgba(232, 213, 188, 0.07);
		border: 1px solid rgba(232, 213, 188, 0.07);
	}

	.cell {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.7rem;
		width: 100%;
		min-height: clamp(7rem, 12vw, 13rem);
		padding: 1.2rem 0.6rem;
		border: 0;
		border-radius: 0;
		font: inherit;
		text-transform: none;
		letter-spacing: normal;
		color: inherit;
		background: #0a060c;
		cursor: default;
		transition: background 0.35s ease, box-shadow 0.35s ease;
	}

	.cell-glyph {
		font-family: 'Ammoura Cuneiform', 'Noto Sans Cuneiform', serif;
		font-size: clamp(1.8rem, 3.6vw, 4rem);
		line-height: 1;
		color: #e3cdaf;
		text-shadow: 0 -1px 0 rgba(255, 210, 150, 0.3), 0 2px 3px rgba(0, 0, 0, 0.8);
		transition: color 0.35s ease, text-shadow 0.35s ease, transform 0.35s ease;
	}

	/* Down, not gone. Hiding the readings entirely left a grid of shapes with
	   nothing to read until you happened to point at one — mysterious for a
	   second and annoying after that. Held back instead, so the whole wall can
	   be read and the one being looked at comes up out of it. */
	.cell-read,
	.cell-mean {
		font-family: 'DejaVu Sans', 'Liberation Sans', sans-serif;
		line-height: 1.4;
		opacity: 0.42;
		transition: opacity 0.35s ease, color 0.35s ease;
	}

	.cell-read {
		font-size: calc(0.6rem * var(--fs));
		letter-spacing: 0.2em;
		color: var(--amber);
	}

	.cell-mean {
		font-size: calc(0.62rem * var(--fs));
		letter-spacing: 0.06em;
		color: var(--clay-dim);
	}

	.cell.lit {
		background: rgba(255, 178, 92, 0.05);
		box-shadow: inset 0 0 40px rgba(255, 178, 92, 0.07);
	}
	.cell.lit .cell-glyph {
		color: #fff0da;
		transform: translateY(-2px);
		text-shadow:
			0 -1px 0 rgba(255, 214, 158, 0.6),
			0 2px 4px rgba(0, 0, 0, 0.9),
			0 0 28px rgba(255, 178, 92, 0.45);
	}
	.cell.lit .cell-read,
	.cell.lit .cell-mean {
		opacity: 1;
	}
	.cell:focus-visible {
		outline: 1px solid rgba(255, 178, 92, 0.6);
		outline-offset: -1px;
	}

	/* ── The stone ── */
	.monument-band {
		border-top: 1px solid rgba(232, 213, 188, 0.07);
	}

	.monument {
		display: grid;
		grid-template-columns: clamp(130px, 13vw, 240px) minmax(0, var(--measure));
		gap: clamp(2rem, 5vw, 5rem);
		align-items: center;
		justify-content: center;
		margin: 0 auto;
	}

	.stele {
		width: 100%;
		aspect-ratio: 120 / 380;
		height: auto;
		filter: drop-shadow(0 26px 44px rgba(0, 0, 0, 0.7));
	}

	.caption {
		font-size: calc(0.8rem * var(--fs)) !important;
		line-height: 1.75 !important;
		color: var(--clay-faint) !important;
		border-left: 1px solid rgba(255, 178, 92, 0.3);
		padding-left: 1.2rem;
	}

	.caption span {
		font-family: 'Ammoura Cuneiform', 'Noto Sans Cuneiform', serif;
		font-size: 1.15em;
		color: var(--amber);
		vertical-align: -0.1em;
	}

	/* ── Facts ── */
	.facts {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(clamp(10rem, 15vw, 18rem), 1fr));
		gap: 1px;
		max-width: 132rem;
		margin: 0 auto;
		background: rgba(232, 213, 188, 0.07);
		border: 1px solid rgba(232, 213, 188, 0.07);
	}

	.facts div {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		padding: clamp(1.4rem, 2.4vw, 2.6rem) clamp(1.1rem, 1.8vw, 2rem);
		background: #0a060c;
	}

	.facts dt {
		font-family: 'DejaVu Sans', 'Liberation Sans', sans-serif;
		font-size: calc(0.56rem * var(--fs));
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: var(--clay-faint);
	}

	.facts dd {
		margin: 0;
		font-size: calc(1rem * var(--fs));
		color: var(--clay);
	}

	/* ── The last of it ── */
	.close-band {
		width: min(var(--measure), 100%);
		margin: 0 auto;
		padding-bottom: clamp(5rem, 9vw, 10rem);
	}

	.close {
		padding-top: 2.5rem;
		border-top: 1px solid rgba(232, 213, 188, 0.1);
		font-size: calc(1.1rem * var(--fs));
		line-height: 1.8;
		color: var(--clay);
	}

	.close :global(strong) {
		padding: 0.06em 0;
		margin: 0;
		box-shadow: none;
		background: linear-gradient(180deg, transparent 58%, rgba(255, 178, 92, 0.28) 58%);
	}

	.mark {
		font-family: 'Ammoura Cuneiform', 'Noto Sans Cuneiform', serif;
		font-size: 1.4em;
		margin-right: 0.5rem;
		color: rgba(255, 178, 92, 0.6);
		vertical-align: -0.15em;
	}

	.colophon {
		display: flex;
		flex-wrap: wrap;
		gap: 0.9rem;
		margin-top: clamp(2.5rem, 4vw, 4.5rem);
		font-family: 'DejaVu Sans', 'Liberation Sans', sans-serif;
		font-size: calc(0.6rem * var(--fs));
		letter-spacing: 0.2em;
		text-transform: uppercase;
	}

	.colophon a {
		color: var(--clay-faint);
		text-decoration: none;
		transition: color 0.25s ease;
	}
	.colophon a:hover,
	.colophon a:focus-visible {
		color: var(--amber);
	}
	.colophon span {
		color: rgba(232, 213, 188, 0.18);
	}

	@media (max-width: 1023px) {
		.monument {
			grid-template-columns: 1fr;
			justify-items: center;
			width: min(var(--measure), 100%);
		}
		.stele {
			width: clamp(120px, 26vw, 170px);
		}
	}

	@media (max-width: 560px) {
		.band {
			padding: 3.5rem 1.25rem;
		}
		.back {
			top: 1.25rem;
			left: 1.25rem;
		}
		.hero {
			padding: 5.5rem 1.25rem 3rem;
		}
		.eyebrow {
			margin-bottom: 2rem;
		}
		.cue {
			height: 3rem;
			margin-top: 2.5rem;
		}
		.parts {
			flex-direction: column;
			align-items: center;
			gap: 1rem;
		}
		.plus {
			line-height: 1;
		}
		/* Sixteen signs, so a column count that divides them leaves no ragged
		   last row. auto-fit lands on three at this width and strands one cell
		   beside a gap. */
		.lexicon {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

</style>
