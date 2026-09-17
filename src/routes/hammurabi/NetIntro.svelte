<!--
	The cold open.

	A 1995 cyber-thriller decrypting a name: sign storm, scan line, glitch
	bars, a terminal reading out what it thinks it has found, and then the five
	signs locking into place and the whole thing tearing away to leave the page
	behind it.

	Three things it is careful about, because "flashing all over the screen" is
	the one effect that can actually hurt somebody:

	- prefers-reduced-motion skips the entire sequence. Nothing plays, the page
	  is simply there.
	- Full-area luminance flashes are held to two in the whole run. WCAG's
	  threshold is three per second for a large part of the viewport, and a
	  seizure is not worth an intro. The fast movement lives in small elements —
	  text cells, thin bars, a line — which is where it is safe.
	- It is skippable from the first frame by a click, a tap, Escape or any key,
	  and it always ends on its own.

	It renders server-side too, so it covers the page from the first paint
	rather than flashing the page and then hiding it. The <noscript> rule is
	what saves anyone without JavaScript from a permanent black box: no script,
	no overlay, straight to the page.
-->
<script>
	import { onMount } from 'svelte';

	let { signs = [], pool = [], done = () => {} } = $props();

	// The readout. Real content, delivered as a decrypt — the corpus size, the
	// five phonetic signs and the reign are all things the page goes on to say.
	const LINES = [
		'> LINK ESTABLISHED',
		'> SCANNING SIGN CORPUS ......... 52 GLYPHS',
		'> SCRIPT: CUNEIFORM / AKKADIAN',
		'> PERIOD: OLD BABYLONIAN',
		'> MATCHING PHONETIC STRING .....',
		'>   ḪA ........ 𒄩',
		'>   AM ........ 𒄠',
		'>   MU ........ 𒈬',
		'>   RA ........ 𒊏',
		'>   BI ........ 𒁉',
		'> STRING RESOLVED: ʻAMMURĀPI',
		'> REIGN 1792-1750 BC ........... VERIFIED',
		'> DECRYPT COMPLETE'
	];

	const CELLS = 72;

	let storm = $state(Array.from({ length: CELLS }, (_, i) => pool[i % pool.length] ?? '𒀭'));
	let shown = $state(0); // readout lines revealed
	let locked = $state(0); // name signs locked in
	let phase = $state('storm'); // storm → lock → tear → gone
	let leaving = $state(false);

	let timers = [];
	const at = (ms, fn) => timers.push(setTimeout(fn, ms));

	function finish() {
		if (phase === 'gone') return;
		phase = 'gone';
		for (const t of timers) clearTimeout(t);
		timers = [];
		done();
	}

	/** Skip: available from the first frame, however it is asked for. */
	function skip() {
		if (leaving) return;
		leaving = true;
		phase = 'tear';
		for (const t of timers) clearTimeout(t);
		timers = [];
		at(420, finish);
	}

	onMount(() => {
		// The whole thing is optional. Anyone who asked for less motion gets the
		// page, immediately, with none of this.
		if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
			finish();
			return;
		}

		// The storm: a slice of the cells turns over every tick rather than all of
		// them, which is both cheaper and closer to how noise actually looks.
		const churn = setInterval(() => {
			if (phase !== 'storm') return;
			const next = [...storm];
			for (let i = 0; i < 22; i++) {
				next[Math.floor(Math.random() * CELLS)] = pool[Math.floor(Math.random() * pool.length)];
			}
			storm = next;
		}, 55);

		// The readout, faster than anyone can read it, which is the point.
		let li = 0;
		const feed = setInterval(() => {
			if (li >= LINES.length) return clearInterval(feed);
			shown = ++li;
		}, 115);

		// The five signs drop in, one at a time.
		at(1500, () => (phase = 'lock'));
		for (let i = 0; i < 5; i++) at(1560 + i * 130, () => (locked = i + 1));

		at(2420, () => {
			leaving = true;
			phase = 'tear';
		});
		at(2900, finish);

		const onKey = () => skip();
		window.addEventListener('keydown', onKey);

		return () => {
			clearInterval(churn);
			clearInterval(feed);
			for (const t of timers) clearTimeout(t);
			window.removeEventListener('keydown', onKey);
		};
	});
</script>

<svelte:head>
	<noscript>{@html '<style>#net-intro{display:none!important}</style>'}</noscript>
</svelte:head>

{#if phase !== 'gone'}
	<div
		id="net-intro"
		class="net"
		class:tear={phase === 'tear'}
		onclick={skip}
		onpointerdown={skip}
		role="presentation"
	>
		<!-- The storm. aria-hidden: it is noise, and a screen reader reading 72
		     cuneiform signs aloud is not an experience anyone asked for. -->
		<div class="storm" aria-hidden="true">
			{#each storm as g, i}
				<span style:--d="{(i % 7) * 40}ms">{g}</span>
			{/each}
		</div>

		<div class="bars" aria-hidden="true">
			<i style:--t="12%" style:--dur="0.7s"></i>
			<i style:--t="31%" style:--dur="0.43s"></i>
			<i style:--t="58%" style:--dur="0.9s"></i>
			<i style:--t="74%" style:--dur="0.55s"></i>
			<i style:--t="88%" style:--dur="0.33s"></i>
		</div>

		<div class="scan" aria-hidden="true"></div>
		<div class="lines" aria-hidden="true"></div>

		<pre class="readout" aria-hidden="true">{LINES.slice(0, shown).join('\n')}</pre>

		<div class="lock" aria-hidden="true" class:on={phase !== 'storm'}>
			{#each signs as s, i}
				<span class:in={i < locked}>{s.sign}</span>
			{/each}
		</div>

		<button class="skip" type="button" onclick={skip}>Skip</button>
	</div>
{/if}

<style>
	@font-face {
		font-family: 'Ammoura Cuneiform';
		src: url('/fonts/cuneiform-subset.woff2') format('woff2');
		font-display: block;
		unicode-range: U+12000-123FF;
	}

	.net {
		position: fixed;
		inset: 0;
		z-index: 9999;
		overflow: hidden;
		background: #000;
		cursor: pointer;
		/* One of the two full-area flashes in the whole sequence. */
		animation: strike 0.16s steps(2, end) 1 both;
	}

	.net.tear {
		animation: tear 0.46s cubic-bezier(0.7, 0, 0.3, 1) forwards;
	}

	@keyframes strike {
		0% {
			background: #cfeee0;
		}
		100% {
			background: #000;
		}
	}

	/* The second and last flash, then it is gone. */
	@keyframes tear {
		0% {
			opacity: 1;
			background: #000;
			clip-path: inset(0 0 0 0);
		}
		22% {
			background: #dff3e8;
		}
		45% {
			background: #000;
			clip-path: inset(0 0 0 0);
		}
		100% {
			opacity: 0;
			clip-path: inset(50% 0 50% 0);
		}
	}

	/* ── The sign storm ── */
	.storm {
		position: absolute;
		inset: -4%;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(clamp(3.2rem, 7vw, 6rem), 1fr));
		align-content: center;
		gap: clamp(0.4rem, 1.4vw, 1.4rem);
		font-family: 'Ammoura Cuneiform', 'Noto Sans Cuneiform', serif;
		font-size: clamp(1.4rem, 3.4vw, 3rem);
		line-height: 1;
		text-align: center;
		color: #6cf3b0;
		opacity: 0.4;
		text-shadow: 0 0 14px rgba(108, 243, 176, 0.55);
	}

	.storm span {
		animation: blink 0.42s steps(2, end) infinite;
		animation-delay: var(--d);
	}

	@keyframes blink {
		0%,
		60% {
			opacity: 1;
		}
		61%,
		100% {
			opacity: 0.16;
		}
	}

	/* ── Glitch bars ──
	   Thin, so the flicker never covers enough of the screen to count as a
	   flash. */
	.bars i {
		position: absolute;
		left: -10%;
		top: var(--t);
		width: 120%;
		height: clamp(6px, 1.2vh, 14px);
		background: linear-gradient(90deg, transparent, rgba(108, 243, 176, 0.5), transparent);
		mix-blend-mode: screen;
		animation: shear var(--dur) steps(3, end) infinite;
	}

	@keyframes shear {
		0% {
			transform: translate3d(-14%, 0, 0) scaleY(1);
			opacity: 0.85;
		}
		50% {
			transform: translate3d(9%, 0, 0) scaleY(2.1);
			opacity: 0.35;
		}
		100% {
			transform: translate3d(-3%, 0, 0) scaleY(1);
			opacity: 0.9;
		}
	}

	/* ── Scan line and CRT ruling ── */
	.scan {
		position: absolute;
		left: 0;
		right: 0;
		height: 26vh;
		background: linear-gradient(180deg, transparent, rgba(150, 255, 205, 0.12), transparent);
		animation: sweep 1.15s linear infinite;
	}

	@keyframes sweep {
		from {
			transform: translate3d(0, -30vh, 0);
		}
		to {
			transform: translate3d(0, 110vh, 0);
		}
	}

	.lines {
		position: absolute;
		inset: 0;
		background: repeating-linear-gradient(
			180deg,
			rgba(0, 0, 0, 0.5) 0 1px,
			transparent 1px 3px
		);
		opacity: 0.55;
	}

	/* ── The readout ── */
	.readout {
		position: absolute;
		left: clamp(1rem, 4vw, 4rem);
		bottom: clamp(1rem, 5vh, 4rem);
		margin: 0;
		max-width: min(46rem, 88vw);
		font-family: 'DejaVu Sans Mono', 'Liberation Mono', ui-monospace, monospace;
		font-size: clamp(0.62rem, 1.15vw, 0.92rem);
		line-height: 1.75;
		white-space: pre-wrap;
		color: #7dffc0;
		text-shadow: 0 0 12px rgba(108, 243, 176, 0.5);
	}

	/* ── The name locking in ── */
	.lock {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: clamp(0.2rem, 1.2vw, 1rem);
		font-family: 'Ammoura Cuneiform', 'Noto Sans Cuneiform', serif;
		font-size: clamp(2.4rem, 11vw, 9rem);
		line-height: 1;
		opacity: 0;
		transition: opacity 0.25s ease;
	}
	.lock.on {
		opacity: 1;
	}

	.lock span {
		opacity: 0;
		transform: scale(1.5);
		color: #f4e3cb;
		filter: drop-shadow(0 0 30px rgba(255, 178, 92, 0.6));
		transition: opacity 0.14s steps(2, end), transform 0.14s cubic-bezier(0.2, 1.4, 0.4, 1);
	}
	.lock span.in {
		opacity: 1;
		transform: none;
	}

	/* ── Skip ── */
	.skip {
		position: absolute;
		right: clamp(1rem, 3vw, 2.5rem);
		top: clamp(1rem, 3vh, 2.5rem);
		padding: 0.5rem 0.9rem;
		min-height: 0;
		border: 1px solid rgba(125, 255, 192, 0.35);
		border-radius: 0;
		background: rgba(0, 0, 0, 0.4);
		color: rgba(125, 255, 192, 0.85);
		font-family: 'DejaVu Sans Mono', 'Liberation Mono', ui-monospace, monospace;
		font-size: 0.64rem;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		cursor: pointer;
	}
	.skip:hover,
	.skip:focus-visible {
		color: #000;
		background: rgba(125, 255, 192, 0.85);
	}

	@media (max-width: 560px) {
		.readout {
			max-width: 92vw;
		}
	}

	/* Belt and braces: if the media query is honoured but the script never ran,
	   nothing here moves either. */
	@media (prefers-reduced-motion: reduce) {
		.net,
		.net.tear,
		.storm span,
		.bars i,
		.scan {
			animation: none;
		}
		.net {
			display: none;
		}
	}
</style>
