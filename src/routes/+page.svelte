<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	// Countdown target: September 11, 2026 at 20:07 EST (UTC-5)
	const TARGET = new Date('2026-09-11T20:07:00-05:00').getTime();
	let days = $state('--');
	let hours = $state('--');
	let minutes = $state('--');
	let seconds = $state('--');

	function updateCountdown() {
		const diff = TARGET - Date.now();
		if (diff <= 0) {
			days = '00'; hours = '00'; minutes = '00'; seconds = '00';
			return false;
		}
		days = String(Math.floor(diff / 86400000)).padStart(2, '0');
		hours = String(Math.floor((diff % 86400000) / 3600000)).padStart(2, '0');
		minutes = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
		seconds = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
		return true;
	}

	onMount(() => {
		updateCountdown();
		const interval = setInterval(() => {
			if (!updateCountdown()) clearInterval(interval);
		}, 1000);
		return () => clearInterval(interval);
	});

	// ── 3D Wireframe Flight ──
	let flightCanvas = $state();
	let taglineEl = $state();
	const FLIGHT_START = new Date('2026-03-22T00:00:00-05:00').getTime();

	// While the track is playing, the arc IS the track: the 9 takes off on the
	// first note and lands on the last. Read straight off the audio element so
	// pausing and seeking stay in sync for free.
	// The Ammoura Discord server.
	const AMMOURA_DISCORD = 'https://discord.gg/dPRvKFS9dq';

	let trackStarted = $state(false);

	function getFlightProgress() {
		if (trackStarted && audioEl) {
			const d = audioEl.duration;
			if (Number.isFinite(d) && d > 0) {
				return Math.max(0, Math.min(1, audioEl.currentTime / d));
			}
		}
		// Otherwise the arc is the real countdown: March 22 → September 11.
		return Math.max(0, Math.min(1, (Date.now() - FLIGHT_START) / (TARGET - FLIGHT_START)));
	}

	onMount(() => {
		if (!flightCanvas) return;
		const ctx = flightCanvas.getContext('2d');
		if (!ctx) return;

		// 3D wireframe "9" character — torus (bowl) + cylinder (tail)
		const TWO_PI = Math.PI * 2;
		const V3 = [];
		const E3 = [];

		const majR = 0.5;       // bowl major radius
		const tubR = 0.065;     // tube cross-section radius
		const bowlCY = 0.35;    // bowl center Y
		const bowlCZ = 0.0;     // bowl center Z
		const majSegs = 16;     // segments around bowl circle
		const minSegs = 6;      // segments per tube cross-section

		// ── Bowl: torus in YZ plane ──
		for (let i = 0; i < majSegs; i++) {
			const a = (i / majSegs) * TWO_PI;
			const baseIdx = V3.length;
			for (let j = 0; j < minSegs; j++) {
				const b = (j / minSegs) * TWO_PI;
				V3.push([
					tubR * Math.cos(b),
					bowlCY + (majR + tubR * Math.sin(b)) * Math.cos(a),
					bowlCZ + (majR + tubR * Math.sin(b)) * Math.sin(a),
				]);
			}
			for (let j = 0; j < minSegs; j++) {
				E3.push([baseIdx + j, baseIdx + (j + 1) % minSegs]);
			}
			if (i > 0) {
				for (let j = 0; j < minSegs; j++) {
					E3.push([baseIdx - minSegs + j, baseIdx + j]);
				}
			}
		}
		// Close torus ring
		for (let j = 0; j < minSegs; j++) {
			E3.push([(majSegs - 1) * minSegs + j, j]);
		}

		// ── Tail: cylinder from 3-o'clock of bowl, descending ──
		const tailZ = bowlCZ + majR;
		const tailStartY = bowlCY;
		const tailEndY = -0.65;
		const tailSegs = 8;

		for (let i = 0; i <= tailSegs; i++) {
			const t = i / tailSegs;
			const y = tailStartY + (tailEndY - tailStartY) * t;
			const baseIdx = V3.length;
			for (let j = 0; j < minSegs; j++) {
				const b = (j / minSegs) * TWO_PI;
				V3.push([
					tubR * Math.cos(b),
					y,
					tailZ + tubR * Math.sin(b),
				]);
			}
			for (let j = 0; j < minSegs; j++) {
				E3.push([baseIdx + j, baseIdx + (j + 1) % minSegs]);
			}
			if (i > 0) {
				for (let j = 0; j < minSegs; j++) {
					E3.push([baseIdx - minSegs + j, baseIdx + j]);
				}
			}
		}

		// 3D math helpers
		const v3sub = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
		const v3cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
		const v3dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
		const v3len = v => Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
		const v3norm = v => { const l = v3len(v); return l > 1e-8 ? [v[0]/l, v[1]/l, v[2]/l] : [0,1,0]; };
		const v3scale = (v, s) => [v[0]*s, v[1]*s, v[2]*s];
		const v3add = (a, b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];

		function buildRotationMatrix(fwd, up) {
			const f = v3norm(fwd);
			let r = v3norm(v3cross(up, f));
			const u = v3norm(v3cross(f, r));
			return { r, u, f };
		}

		function transformVert(v, mat, pos, scale) {
			return [
				(mat.r[0]*v[0] + mat.u[0]*v[1] + mat.f[0]*v[2]) * scale + pos[0],
				(mat.r[1]*v[0] + mat.u[1]*v[1] + mat.f[1]*v[2]) * scale + pos[1],
				(mat.r[2]*v[0] + mat.u[2]*v[1] + mat.f[2]*v[2]) * scale + pos[2],
			];
		}

		// Quadratic Bézier helpers (2D screen space)
		const bz = (t, a, b, c) => {
			const u = 1 - t;
			return [
				u*u*a[0] + 2*u*t*b[0] + t*t*c[0],
				u*u*a[1] + 2*u*t*b[1] + t*t*c[1],
			];
		};
		const bzd = (t, a, b, c) => {
			const u = 1 - t;
			return [
				2*u*(b[0]-a[0]) + 2*t*(c[0]-b[0]),
				2*u*(b[1]-a[1]) + 2*t*(c[1]-b[1]),
			];
		};

		// Tower dimensions (responsive)
		function getTowerDims(w) {
			return {
				towerW: w < 480 ? 8 : 12,
				towerH: w < 480 ? 45 : 65,
				towerGap: w < 480 ? 6 : 10,
			};
		}

		function getArcPoints(w, h) {
			// Tower base: centered horizontally, just above the tagline
			let baseX = w * 0.5;
			let baseY = h * 0.38;
			if (taglineEl) {
				const rect = taglineEl.getBoundingClientRect();
				const canvasRect = flightCanvas.getBoundingClientRect();
				baseX = rect.left + rect.width / 2 - canvasRect.left;
				baseY = rect.top - canvasRect.top - (w < 480 ? 20 : 35);
			}

			// Arc endpoint = top third of the right (second) tower
			const { towerW, towerH, towerGap } = getTowerDims(w);
			const endX = baseX + towerGap / 2 + towerW / 2; // center of right tower
			const endY = baseY - towerH + towerH / 3;        // top third

			// Anchor the whole arc to the content column, not to the viewport.
			// Previously the start was derived from `w` while the end tracked the
			// centred text, so the two drifted apart as the window got squarer —
			// and `h * -0.02` put the control point above the canvas, where it
			// was clipped. On a tall desktop window that left the arc stranded
			// far above the content, reading as "the animation is missing".
			const narrow = w < 480;
			const reach = Math.min(w * (narrow ? 0.8 : 0.45), 1000);
			const rise = Math.min(h * 0.22, 230);

			const startX = Math.max(w * 0.04, endX - reach);
			const startY = baseY - rise * 0.75;

			const ctrlX = startX + (endX - startX) * 0.35;
			// Clamped so the control point can never leave the canvas.
			const ctrlY = Math.max(8, baseY - rise * 1.35);

			return {
				P0: [startX, startY],
				P1: [ctrlX, ctrlY],
				P2: [endX, endY],
				towerBaseX: baseX,
				towerBaseY: baseY,
			};
		}

		let frame;
		function draw() {
			const dpr = devicePixelRatio || 1;
			const w = flightCanvas.clientWidth;
			const h = flightCanvas.clientHeight;
			if (w === 0 || h === 0) { frame = requestAnimationFrame(draw); return; }
			flightCanvas.width = w * dpr;
			flightCanvas.height = h * dpr;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.clearRect(0, 0, w, h);

			const { P0, P1, P2, towerBaseX, towerBaseY } = getArcPoints(w, h);
			const t = getFlightProgress();
			const N = 120;

			// Plane scale: responsive
			const planeSize = w < 480 ? Math.min(w, h) * 0.045 : Math.min(w, h) * 0.04;

			// Past path (dotted)
			ctx.save();
			ctx.strokeStyle = 'rgba(255,255,255,0.18)';
			ctx.setLineDash([3, 7]);
			ctx.lineWidth = w < 480 ? 0.8 : 1;
			ctx.beginPath();
			let started = false;
			for (let i = 0; i <= N; i++) {
				const s = i / N;
				if (s > t) break;
				const p = bz(s, P0, P1, P2);
				if (!started) { ctx.moveTo(p[0], p[1]); started = true; } else ctx.lineTo(p[0], p[1]);
			}
			const pAt = bz(t, P0, P1, P2);
			if (!started) ctx.moveTo(pAt[0], pAt[1]); else ctx.lineTo(pAt[0], pAt[1]);
			ctx.stroke();
			ctx.restore();

			// Future path (solid)
			ctx.save();
			ctx.strokeStyle = 'rgba(255,255,255,0.3)';
			ctx.lineWidth = w < 480 ? 0.8 : 1;
			ctx.beginPath();
			ctx.moveTo(pAt[0], pAt[1]);
			for (let i = 0; i <= N; i++) {
				const s = i / N;
				if (s <= t) continue;
				const p = bz(s, P0, P1, P2);
				ctx.lineTo(p[0], p[1]);
			}
			ctx.stroke();
			ctx.restore();

			// Endpoint marker
			const pEnd = bz(1, P0, P1, P2);
			ctx.beginPath();
			ctx.arc(pEnd[0], pEnd[1], 2, 0, Math.PI * 2);
			ctx.fillStyle = 'rgba(255,255,255,0.15)';
			ctx.fill();

			// Two tall wireframe rectangles at the tagline center
			const { towerW, towerH, towerGap } = getTowerDims(w);
			const tx1 = towerBaseX - towerGap / 2 - towerW;
			const tx2 = towerBaseX + towerGap / 2;

			ctx.strokeStyle = 'rgba(255,255,255,0.25)';
			ctx.lineWidth = w < 480 ? 0.7 : 1;
			// Left tower
			ctx.strokeRect(tx1, towerBaseY - towerH, towerW, towerH);
			// Right tower
			ctx.strokeRect(tx2, towerBaseY - towerH, towerW, towerH);

			// 3D "9" orientation: aligns with path tangent
			const tan = bzd(t, P0, P1, P2);
			const tangentAngle = Math.atan2(tan[1], tan[0]);
			const bob = Math.sin(Date.now() * 0.0015) * 0.04;

			// Dance: the 9 swings perpendicular to its own track, driven by the
			// music. Tuned short and twitchy — a small swing that reacts on the
			// transient rather than riding a smoothed average.
			const nowMs = Date.now();
			const dt = lastFrameAt ? Math.min(0.05, (nowMs - lastFrameAt) / 1000) : 0.016;
			lastFrameAt = nowMs;
			const target = playing ? readLevel() : 0;
			level += (target - level) * (target > level ? DANCE_ATTACK : DANCE_RELEASE);
			dancePhase += dt * DANCE_SPEED;

			const tlen = Math.hypot(tan[0], tan[1]) || 1;
			// Left-hand normal to the tangent — "up and down" relative to the arc.
			const nx = -tan[1] / tlen;
			const ny = tan[0] / tlen;
			const danceOffset = Math.sin(dancePhase) * level * planeSize * DANCE_HEIGHT;
			// Only the 9 moves; the drawn arc stays put as the track it flies.
			const px = pAt[0] + nx * danceOffset;
			const py = pAt[1] + ny * danceOffset;

			// View angle: how we look at the "9" in its local frame
			// viewYaw rotates around model Y (up)
			// viewPitch rotates around model X
			const viewYaw = 1.35;
			const viewPitch = 0.2;

			const cyaw = Math.cos(viewYaw), syaw = Math.sin(viewYaw);
			const cpitch = Math.cos(viewPitch), spitch = Math.sin(viewPitch);

			// For each 3D model vertex:
			// 1. Apply view rotation (yaw then pitch) to get 2D projection
			// 2. Rotate result to align with arc tangent
			const finalAngle = tangentAngle + bob;
			const cfa = Math.cos(finalAngle), sfa = Math.sin(finalAngle);

			const projected = V3.map(([mx, my, mz]) => {
				// Yaw: rotate around Y axis
				let x1 = mx * cyaw + mz * syaw;
				let z1 = -mx * syaw + mz * cyaw;
				let y1 = my;

				// Pitch: rotate around X axis
				let y2 = y1 * cpitch - z1 * spitch;
				let z2 = y1 * spitch + z1 * cpitch;
				// After view rotation, x1 is screen-right, y2 is screen-up
				// z2 is depth (ignored for orthographic)

				// Rotate 2D coordinates to align fuselage with tangent
				const sx = x1 * cfa - (-y2) * sfa;
				const sy = x1 * sfa + (-y2) * cfa;

				return [
					px + sx * planeSize,
					py + sy * planeSize,
				];
			});

			// Wireframe edges
			ctx.strokeStyle = 'rgba(255,255,255,0.65)';
			ctx.lineWidth = w < 480 ? 0.7 : 1;
			for (const [a, b] of E3) {
				if (!projected[a] || !projected[b]) continue;
				ctx.beginPath();
				ctx.moveTo(projected[a][0], projected[a][1]);
				ctx.lineTo(projected[b][0], projected[b][1]);
				ctx.stroke();
			}

			// Glow at "9" position
			ctx.beginPath();
			ctx.arc(pAt[0], pAt[1], w < 480 ? 2 : 3, 0, Math.PI * 2);
			ctx.fillStyle = 'rgba(255,255,255,0.5)';
			ctx.fill();

			frame = requestAnimationFrame(draw);
		}

		draw();
		return () => { if (frame) cancelAnimationFrame(frame); };
	});

	const siteName = 'Ammoura';
	const siteTitle = 'Build Your Empire | Ammoura';
	const siteDescription = "We don't sell dreams. We give you the tools to crush them. Join the waitlist and start building.";
	const ogImagePath = '/og.png';

	let canonicalUrl = $derived($page.url.origin + $page.url.pathname);
	let ogImageUrl = $derived($page.url.origin + ogImagePath);

	/** @type {{ form: import('./$types').ActionData; data: import('./$types').PageData }} */
	let { form, data } = $props();

	// ── Album track ──
	// BIRTH is track 1 of Ammoura.me, and its album route is "/" — this page.
	let audioEl = $state();
	let playing = $state(false);

	// ── Audio-reactive motion ──
	// A tap on the audio element so the 9 can move to what is actually playing.
	// Plain `let`, not $state: the draw loop reads these every frame and none of
	// it belongs in the reactive graph.
	// Dance feel — the four numbers worth turning.
	const DANCE_HEIGHT = 0.55; // swing, in multiples of the glyph size
	const DANCE_SPEED = 17; // radians per second of the swing
	const DANCE_ATTACK = 0.8; // how fast the swing grows on a hit (0..1 per frame)
	const DANCE_RELEASE = 0.28; // how fast it settles again

	let audioCtx = null;
	let analyser = null;
	let freqData = null;
	let level = 0; // smoothed 0..1
	let dancePhase = 0;
	let lastFrameAt = 0;

	function initAudioGraph() {
		if (analyser || !audioEl) return;
		const AC = window.AudioContext || window.webkitAudioContext;
		if (!AC) return; // no Web Audio: the 9 rides the track without dancing

		let src = null;
		try {
			audioCtx = new AC();
			src = audioCtx.createMediaElementSource(audioEl);
			analyser = audioCtx.createAnalyser();
			analyser.fftSize = 256;
			analyser.smoothingTimeConstant = 0.12; // low: we want the transient, not an average
			src.connect(analyser);
			// Must reach the destination, or routing the element through the
			// graph silences it.
			analyser.connect(audioCtx.destination);
			freqData = new Uint8Array(analyser.frequencyBinCount);
		} catch (err) {
			// Once the element is routed into the graph it stops playing through
			// the normal output. If wiring up failed partway, connect the source
			// straight to the destination — a 9 that does not dance is a much
			// smaller problem than a play button that plays silence.
			console.warn('audio graph unavailable, falling back to direct output', err);
			analyser = null;
			freqData = null;
			try {
				src?.connect(audioCtx.destination);
			} catch {
				/* nothing further to try */
			}
		}
	}

	function readLevel() {
		if (!analyser || !freqData) return 0;
		analyser.getByteFrequencyData(freqData);
		// The low bins carry the kick, which is what reads as a beat.
		let sum = 0;
		const bins = Math.min(16, freqData.length);
		for (let i = 0; i < bins; i++) sum += freqData[i];
		return sum / (bins * 255);
	}

	function togglePlay() {
		if (!audioEl) return;
		if (playing) audioEl.pause();
		else audioEl.play().catch(() => { /* blocked or unsupported — leave it */ });
	}

	function onPlay() {
		playing = true;
		trackStarted = true;
		initAudioGraph();
		// Browsers hand back a suspended context until a gesture; this is one.
		if (audioCtx?.state === 'suspended') audioCtx.resume();
	}

	// Paused mid-track: hold the 9 where it is rather than snapping back.
	function onPause() {
		playing = false;
	}

	// Track finished: the 9 has landed. Hand the arc back to the real countdown.
	function onEnded() {
		playing = false;
		trackStarted = false;
	}

	// Brand marks for the join buttons, keyed by provider id.
	const PROVIDER_ICON = {
		github: '<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true"><path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2 0-.4-.5-1.6.2-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.4 5.5 18.4 5.8 18.4 5.8c.7 1.6.2 2.8.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3z"/></svg>',
		discord: '<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true"><path d="M20.317 4.369a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .078-.01c3.927 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .079.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>',
		google: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z"/><path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3a7.2 7.2 0 0 1-10.7-3.8h-4v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.3 14.3a7.1 7.1 0 0 1 0-4.6v-3.1h-4a12 12 0 0 0 0 10.8l4-3.1z"/><path fill="#EA4335" d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1A7.2 7.2 0 0 1 12 4.8z"/></svg>',
		facebook: '<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true"><path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.96h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z"/></svg>',
		apple: '<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true"><path d="M17.05 12.54c-.03-2.8 2.29-4.15 2.39-4.21-1.3-1.9-3.33-2.17-4.05-2.2-1.72-.17-3.36 1.01-4.23 1.01-.87 0-2.22-.99-3.65-.96-1.88.03-3.61 1.09-4.58 2.77-1.95 3.39-.5 8.4 1.4 11.15.93 1.35 2.04 2.86 3.5 2.8 1.4-.055 1.93-.9 3.63-.9 1.69 0 2.17.9 3.65.87 1.51-.03 2.46-1.37 3.38-2.72 1.07-1.56 1.51-3.07 1.53-3.15-.03-.015-2.94-1.13-2.97-4.46zM14.28 4.2c.77-.93 1.29-2.22 1.14-3.51-1.11.045-2.45.74-3.24 1.67-.71.82-1.33 2.14-1.16 3.4 1.24.095 2.5-.63 3.26-1.56z"/></svg>'
	};

	// Status coming back from an OAuth round-trip.
	const JOIN_MESSAGES = {
		cancelled: 'No problem — use your email instead.',
		failed: "That didn't go through. Try again, or use your email.",
		noemail: "That account didn't share an email. Enter one below."
	};
	let joinMessage = $derived(data.join && data.join !== 'ok' ? (JOIN_MESSAGES[data.join] ?? '') : '');

	// Initialised from the load data, not an $effect, so the server renders
	// the confirmation directly instead of flashing the signup form first.
	let submitted = $state(data.join === 'ok');
	let submitting = $state(false);
	let formError = $state('');
	// Signed in with Discord: already connected, so offer the server instead.
	let discordLinked = $state(data.join === 'ok' && data.via === 'discord');

	let email = $state('');
	let clientData = $state('{}');

	// Collect all available browser/device data
	$effect(() => {
		if (typeof window === 'undefined') return;
		try {
			const nav = navigator;
			const scr = screen;
			const conn = /** @type {any} */ (nav).connection || /** @type {any} */ (nav).mozConnection || /** @type {any} */ (nav).webkitConnection;
			const data = {
				// Screen & viewport
				screenWidth: scr.width,
				screenHeight: scr.height,
				screenAvailWidth: scr.availWidth,
				screenAvailHeight: scr.availHeight,
				colorDepth: scr.colorDepth,
				pixelDepth: scr.pixelDepth,
				devicePixelRatio: window.devicePixelRatio,
				viewportWidth: window.innerWidth,
				viewportHeight: window.innerHeight,
				screenOrientation: scr.orientation?.type || null,
				// Timezone & locale
				timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
				timezoneOffset: new Date().getTimezoneOffset(),
				language: nav.language,
				languages: nav.languages ? [...nav.languages] : [nav.language],
				// Platform & hardware
				platform: nav.platform,
				userAgent: nav.userAgent,
				hardwareConcurrency: nav.hardwareConcurrency || null,
				deviceMemory: /** @type {any} */ (nav).deviceMemory || null,
				maxTouchPoints: nav.maxTouchPoints || 0,
				// Features
				cookieEnabled: nav.cookieEnabled,
				doNotTrack: nav.doNotTrack || /** @type {any} */ (window).doNotTrack || null,
				pdfViewerEnabled: /** @type {any} */ (nav).pdfViewerEnabled ?? null,
				webdriver: nav.webdriver || false,
				onLine: nav.onLine,
				// Connection
				connectionType: conn?.type || null,
				connectionEffectiveType: conn?.effectiveType || null,
				connectionDownlink: conn?.downlink || null,
				connectionRtt: conn?.rtt || null,
				connectionSaveData: conn?.saveData || null,
				// Touch & input
				touchSupport: 'ontouchstart' in window || nav.maxTouchPoints > 0,
				// Media
				prefersDarkMode: window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? null,
				prefersReducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? null,
				// Referrer / source
				referrer: document.referrer || null,
				// UTM parameters
				utmSource: $page.url.searchParams.get('utm_source'),
				utmMedium: $page.url.searchParams.get('utm_medium'),
				utmCampaign: $page.url.searchParams.get('utm_campaign'),
				utmTerm: $page.url.searchParams.get('utm_term'),
				utmContent: $page.url.searchParams.get('utm_content'),
				// Page context
				pageUrl: window.location.href,
				localTime: new Date().toISOString(),
				// Canvas fingerprint hash (lightweight)
				canvasHash: (() => {
					try {
						const c = document.createElement('canvas');
						const ctx = c.getContext('2d');
						if (!ctx) return null;
						ctx.textBaseline = 'top';
						ctx.font = '14px Arial';
						ctx.fillText('fingerprint', 2, 2);
						const data = c.toDataURL();
						let hash = 0;
						for (let i = 0; i < data.length; i++) {
							hash = ((hash << 5) - hash + data.charCodeAt(i)) | 0;
						}
						return hash.toString(16);
					} catch { return null; }
				})(),
				// WebGL renderer
				webglRenderer: (() => {
					try {
						const c = document.createElement('canvas');
						const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
						if (!gl) return null;
						const ext = /** @type {WebGLRenderingContext} */ (gl).getExtension('WEBGL_debug_renderer_info');
						if (!ext) return null;
						return /** @type {WebGLRenderingContext} */ (gl).getParameter(ext.UNMASKED_RENDERER_WEBGL);
					} catch { return null; }
				})(),
				// Installed plugins count
				pluginCount: nav.plugins?.length ?? 0
			};
			clientData = JSON.stringify(data);
		} catch (e) {
			console.warn('Client data collection failed:', e);
		}
	});

	// Check if user just returned from Discord linking
	$effect(() => {
		const linked = $page.url.searchParams.get('linked');
		if (linked === '1') {
			submitted = true;
			discordLinked = true;
		}
	});

	// Force-override iOS Chrome autofill styling via JS
	$effect(() => {
		if (typeof window === 'undefined') return;

		/** @param {HTMLElement} el */
		const forceStyles = (el) => {
			el.style.setProperty('-webkit-text-fill-color', '#fff', 'important');
			el.style.setProperty('-webkit-box-shadow', '0 0 0px 9999px #000 inset', 'important');
			el.style.setProperty('box-shadow', '0 0 0px 9999px #000 inset', 'important');
			el.style.setProperty('background-color', '#000', 'important');
			el.style.setProperty('color', '#fff', 'important');
			el.style.setProperty('caret-color', '#fff', 'important');
		};

		// Apply to all inputs/textareas regardless of autofill state (iOS may not
		// expose :-webkit-autofill to querySelectorAll)
		const fixAll = () => {
			document.querySelectorAll('input, textarea').forEach((el) => {
				const computed = getComputedStyle(el);
				// Detect autofill: background deviates from expected black
				if (
					computed.backgroundColor !== 'rgb(0, 0, 0)' &&
					computed.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
					computed.backgroundColor !== 'transparent'
				) {
					forceStyles(/** @type {HTMLElement} */ (el));
				}
			});
			// Also try the pseudo-class selector (works on desktop Chrome)
			try {
				document.querySelectorAll('input:-webkit-autofill, textarea:-webkit-autofill').forEach((el) => {
					forceStyles(/** @type {HTMLElement} */ (el));
				});
			} catch (_) { /* selector not supported */ }
		};

		// Listen for animationstart (Chrome fires on autofill) and input/change
		document.addEventListener('animationstart', fixAll, true);
		document.addEventListener('input', fixAll, true);
		document.addEventListener('change', fixAll, true);

		// Poll for autofill changes — iOS Chrome doesn't fire events reliably
		const interval = setInterval(fixAll, 200);
		const timeout = setTimeout(() => clearInterval(interval), 10000);

		return () => {
			document.removeEventListener('animationstart', fixAll, true);
			document.removeEventListener('input', fixAll, true);
			document.removeEventListener('change', fixAll, true);
			clearInterval(interval);
			clearTimeout(timeout);
		};
	});

	// Sync server response into local state
	$effect(() => {
		if (form?.success) {
			submitted = true;
			formError = '';
		} else if (form?.error) {
			formError = form.error;
		}
	});

	
	const fakeDomains = [
		'test.com', 'fake.com', 'example.com', 'mailinator.com', 'throwaway.email',
		'guerrillamail.com', 'yopmail.com', 'tempmail.com', 'trashmail.com',
		'disposable.com', 'sharklasers.com', 'guerrillamailblock.com', 'grr.la',
		'spam4.me', 'noemail.com', 'nomail.com', 'nomail.org', 'aol.com.invalid'
	];

	

	let formValid = $derived(
		email.includes('@') &&
		/^[^@]+@[^@]+\.[^@]+$/.test(email) &&
		!fakeDomains.includes((email.split('@')[1] || '').toLowerCase()) &&
		!/^(test|fake|asdf|nope|no|none|null)\+?/.test((email.split('@')[0] || '').toLowerCase())
	);
</script>

<svelte:head>
	<!-- Primary Meta Tags -->
	<title>{siteTitle}</title>
	<meta name="description" content={siteDescription} />
	<meta name="author" content={siteName} />
	<meta name="robots" content="index, follow" />
	<link rel="canonical" href={canonicalUrl} />

	<!-- Open Graph / Facebook -->
	<meta property="og:type" content="website" />
	<meta property="og:url" content={canonicalUrl} />
	<meta property="og:title" content={siteTitle} />
	<meta property="og:description" content={siteDescription} />
	<meta property="og:image" content={ogImageUrl} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content="Ammoura — Build Your Empire" />
	<meta property="og:site_name" content={siteName} />
	<meta property="og:locale" content="en_US" />

	<!-- Twitter Card -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:url" content={canonicalUrl} />
	<meta name="twitter:title" content={siteTitle} />
	<meta name="twitter:description" content={siteDescription} />
	<meta name="twitter:image" content={ogImageUrl} />
	<meta name="twitter:image:alt" content="Ammoura — Build Your Empire" />

	<!-- Structured Data (JSON-LD) -->
	{@html `<script type="application/ld+json">${JSON.stringify({
		"@context": "https://schema.org",
		"@graph": [
			{
				"@type": "WebSite",
				"@id": canonicalUrl + "#website",
				"url": canonicalUrl,
				"name": siteName,
				"description": siteDescription,
				"inLanguage": "en-US"
			},
			{
				"@type": "WebPage",
				"@id": canonicalUrl + "#webpage",
				"url": canonicalUrl,
				"name": siteTitle,
				"description": siteDescription,
				"isPartOf": { "@id": canonicalUrl + "#website" },
				"inLanguage": "en-US"
			},
			{
				"@type": "Organization",
				"@id": canonicalUrl + "#organization",
				"name": siteName,
				"url": canonicalUrl,
				"logo": {
					"@type": "ImageObject",
					"url": $page.url.origin + "/favicon.png"
				},
				"sameAs": [
					"https://discord.gg/dPRvKFS9dq"
				]
			}
		]
	})}</script>`}
</svelte:head>

<main>
	{#if !submitted}
		<section class="hero">
			<canvas class="flight-canvas" bind:this={flightCanvas}></canvas>
			<p class="tagline" bind:this={taglineEl}>Build your empire</p>
			<!-- Two spans, not a <br>: each sentence is its own line, and either one
			     can still wrap on its own on a narrow phone rather than overflowing.
			     The setup line sits back so the second one lands as the punch. -->
			<h1>
				<span class="setup">We don't sell dreams.</span>
				<span class="punch">We give you the tools to <em>crush</em> them.</span>
			</h1>
			<p class="hint">A website, a storefront, and everything behind them.</p>

			<div class="countdown">
				<div class="countdown-segment"><span class="countdown-value">{days}</span><span class="countdown-label">Days</span></div>
				<span class="countdown-sep">:</span>
				<div class="countdown-segment"><span class="countdown-value">{hours}</span><span class="countdown-label">Hrs</span></div>
				<span class="countdown-sep">:</span>
				<div class="countdown-segment"><span class="countdown-value">{minutes}</span><span class="countdown-label">Min</span></div>
				<span class="countdown-sep">:</span>
				<div class="countdown-segment"><span class="countdown-value">{seconds}</span><span class="countdown-label">Sec</span></div>
			</div>

			<!-- Track 1 of Ammoura.me. Playing it re-runs the flight on a loop. -->
			<button class="play-btn" onclick={togglePlay} aria-pressed={playing}
				aria-label={playing ? 'Pause BIRTH' : 'Play BIRTH by davis9001'}>
				{#if playing}
					<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
				{:else}
					<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" aria-hidden="true"><path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z"/></svg>
				{/if}
				<span class="play-label">{playing ? 'Playing' : 'Play'}</span>
				<span class="play-track">BIRTH &middot; davis9001</span>
			</button>
			<audio bind:this={audioEl} src="/audio/01-birth.mp3" preload="metadata"
				onplay={onPlay} onpause={onPause} onended={onEnded}></audio>

			<form
				class="join"
				method="POST"
				use:enhance={() => {
					submitting = true;
					formError = '';
					return async ({ update }) => {
						submitting = false;
						await update();
					};
				}}
				novalidate
			>
				<div class="join-row">
					<input
						name="email"
						type="email"
						bind:value={email}
						placeholder="you@example.com"
						aria-label="Email address"
						autocomplete="email"
						required
					/>
					<input type="hidden" name="_clientData" value={clientData} />
					<button type="submit" disabled={!formValid || submitting}>
						{submitting ? '...' : 'Join'}
					</button>
				</div>
				{#if formError}
					<p class="error">{formError}</p>
				{/if}
				{#if joinMessage}
					<p class="error">{joinMessage}</p>
				{/if}
			</form>

			{#if data.providers?.length}
				<p class="or">or</p>
				<div class="providers">
					{#each data.providers as p (p.id)}
						<a class="provider provider-{p.id}" href="/auth/join/{p.id}"
							aria-label="Join with {p.label}" title="Join with {p.label}">
							{@html PROVIDER_ICON[p.id]}
							<span class="provider-label">{p.label}</span>
						</a>
					{/each}
				</div>
			{/if}
		</section>
	{/if}

	{#if submitted}
		<section class="enter">
			<p class="confirmation">We'll be in touch.</p>
			<p class="discord-prompt">
				{discordLinked
					? 'We have your Discord. Come say hello in the meantime.'
					: 'Come hang out while you wait.'}
			</p>
			<a class="discord-btn" href={AMMOURA_DISCORD} target="_blank" rel="noopener noreferrer">
				<svg class="discord-icon" viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
					<path d="M20.317 4.369a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .078-.01c3.927 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .079.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
				</svg>
				Join the Ammoura Discord
			</a>
		</section>
	{/if}
</main>

<footer class="site-footer">
	<a href="/privacy">Privacy Policy</a>
	<span aria-hidden="true">&middot;</span>
	<a href="/terms">Terms of Service</a>
</footer>

<style>
	:global(*, *::before, *::after) {
		box-sizing: border-box;
		margin: 0;
		padding: 0;
	}

	:global(html, body) {
		background: #000;
		color: #fff;
		font-family: 'Georgia', serif;
		scroll-behavior: smooth;
		-webkit-text-size-adjust: 100%;
	}

	main {
		min-height: 100vh;
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
	}

	/* ── Countdown ── */
	.countdown {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 2.5rem;
	}

	.countdown-segment {
		display: flex;
		flex-direction: column;
		align-items: center;
		min-width: 3.2rem;
	}

	.countdown-value {
		font-size: 1.6rem;
		letter-spacing: 0.1em;
		font-variant-numeric: tabular-nums;
		font-weight: 400;
	}

	.countdown-label {
		font-size: 0.6rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		opacity: 0.4;
		margin-top: 0.15rem;
	}

	.countdown-sep {
		font-size: 1.3rem;
		opacity: 0.3;
		align-self: flex-start;
		margin-top: 0.15rem;
	}

	@media (min-width: 480px) {
		.countdown {
			gap: 0.75rem;
		}
		.countdown-segment {
			min-width: 4rem;
		}
		.countdown-value {
			font-size: 2.2rem;
		}
		.countdown-label {
			font-size: 0.65rem;
		}
		.countdown-sep {
			font-size: 1.6rem;
		}
	}

	@media (min-width: 768px) {
		.countdown {
			gap: 1rem;
		}
		.countdown-segment {
			min-width: 5rem;
		}
		.countdown-value {
			font-size: 2.8rem;
		}
		.countdown-label {
			font-size: 0.7rem;
			letter-spacing: 0.2em;
		}
		.countdown-sep {
			font-size: 2rem;
		}
	}

	/* ── Hero ── */
	.hero {
		position: relative;
		overflow: hidden;
		min-height: 100vh;
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 1.5rem 1.25rem;
		padding-top: env(safe-area-inset-top, 1.5rem);
		padding-bottom: env(safe-area-inset-bottom, 1.5rem);
		text-align: center;
	}

	.flight-canvas {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}

	.tagline {
		font-size: 0.7rem;
		letter-spacing: 0.25em;
		text-transform: uppercase;
		opacity: 0.4;
		margin-bottom: 1.75rem;
	}

	h1 {
		font-size: 1.3rem;
		font-weight: 400;
		line-height: 1.5;
		max-width: 700px;
		letter-spacing: 0.02em;
		margin-bottom: 0.9rem;
		padding: 0 0.25rem;
	}

	h1 span {
		display: block;
	}

	/* Setup sits back, punch comes forward. Dimmed with colour rather than
	   opacity so the reveal below can own opacity outright.
	   rgba(255,255,255,0.55) on black is 6.2:1 — AA at this size. */
	h1 .setup {
		color: rgba(255, 255, 255, 0.55);
	}

	h1 .punch {
		color: #fff;
	}

	/* The one word the sentence is built around. Georgia's italic earns its
	   keep here; the glow is set on the base rule so it survives
	   prefers-reduced-motion, and `ignite` only animates up to it. */
	h1 .punch em {
		font-style: italic;
		text-shadow: 0 0 38px rgba(255, 255, 255, 0.28);
	}

	/* Says what this actually is, quietly. 0.5 white on black is 5.3:1. */
	.hint {
		font-size: 0.85rem;
		line-height: 1.6;
		letter-spacing: 0.04em;
		color: rgba(255, 255, 255, 0.5);
		max-width: 30em;
		margin-top: 0.35rem;
		margin-bottom: 2.25rem;
		padding: 0 0.25rem;
	}

	/* Staged reveal: setup, punch, then the hint. The page's other motion is
	   canvas-driven, so this is the only CSS animation here — kept to one
	   keyframe and a delay per line. */
	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(0.4em);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	@keyframes ignite {
		from {
			text-shadow: 0 0 0 rgba(255, 255, 255, 0);
		}
	}

	h1 .setup,
	h1 .punch,
	.hint {
		animation: rise 900ms cubic-bezier(0.2, 0.65, 0.3, 1) both;
	}

	h1 .setup {
		animation-delay: 120ms;
	}

	h1 .punch {
		animation-delay: 420ms;
	}

	h1 .punch em {
		animation: ignite 1200ms ease-out 900ms both;
	}

	.hint {
		animation-delay: 780ms;
	}

	/* ── Enter / confirmation section ── */
	.enter {
		min-height: 100vh;
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2.5rem 1.25rem;
		padding-bottom: calc(2.5rem + env(safe-area-inset-bottom, 0px));
	}

	/* ── Buttons ── */
	button {
		background: none;
		border: 1px solid #fff;
		color: #fff;
		font-family: inherit;
		font-size: 0.9rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		padding: 0.9rem 2rem;
		min-height: 48px;
		cursor: pointer;
		transition: background 0.2s, color 0.2s;
		-webkit-tap-highlight-color: transparent;
	}

	button:hover {
		background: #fff;
		color: #000;
	}

	@media (hover: none) {
		button:active {
			background: #fff;
			color: #000;
		}
		button:hover {
			background: none;
			color: #fff;
		}
	}

	/* ── Form ── */
	form {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		width: 100%;
		max-width: 480px;
	}

	.warning {
		font-size: 0.7rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		opacity: 0.35;
		margin-top: -0.3rem;
	}

	input,

	input:focus,

	/* Autofill overrides are in app.html to avoid Svelte scoping and beat UA styles on iOS Chrome */

	.error {
		font-size: 0.85rem;
		letter-spacing: 0.1em;
		opacity: 0.8;
		text-align: center;
	}

	form button {
		align-self: center;
		margin-top: 0.75rem;
		width: 100%;
	}

	form button:disabled {
		opacity: 0.25;
		cursor: default;
		pointer-events: none;
	}

	/* Pinned bottom-right. The hero is 100vh with an absolutely positioned
	   canvas, so this needs to sit above both. */
	.site-footer {
		position: fixed;
		right: calc(1.25rem + env(safe-area-inset-right, 0px));
		bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
		z-index: 10;
		display: flex;
		align-items: center;
		gap: 0.7rem;
		font-size: 0.72rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	/* On narrow screens it would sit on top of the provider buttons, so stack
	   it tight into the corner instead. */
	@media (max-width: 560px) {
		.site-footer {
			right: calc(0.9rem + env(safe-area-inset-right, 0px));
			bottom: calc(0.7rem + env(safe-area-inset-bottom, 0px));
			flex-direction: column;
			align-items: flex-end;
			gap: 0.35rem;
			font-size: 0.68rem;
		}
		.site-footer span {
			display: none;
		}
	}
	.site-footer a {
		color: rgba(255, 255, 255, 0.72);
		text-decoration: none;
		/* The arc and the 9 can pass behind this, so give the text its own
		   ground rather than relying on the page being black. */
		text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
	}
	.site-footer a:hover,
	.site-footer a:focus-visible {
		color: #fff;
	}
	.site-footer span {
		color: rgba(255, 255, 255, 0.35);
	}

	/* ── Play button: track 1 of the album ── */
	.play-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		margin: 0 auto 2rem;
		padding: 0.7rem 1.4rem;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 999px;
		min-height: 44px;
		font-size: 0.7rem;
	}
	.play-btn:hover,
	.play-btn:focus-visible {
		background: #fff;
		color: #000;
		border-color: #fff;
	}
	.play-btn[aria-pressed='true'] {
		border-color: #fff;
	}
	.play-label {
		letter-spacing: 0.2em;
	}
	.play-track {
		letter-spacing: 0.12em;
		opacity: 0.55;
		text-transform: none;
	}
	.play-btn:hover .play-track,
	.play-btn:focus-visible .play-track {
		opacity: 0.75;
	}

	/* ── Single-row join form ── */
	.join {
		width: 100%;
		max-width: 30rem;
		margin: 0 auto;
	}
	.join-row {
		display: flex;
		gap: 0.75rem;
		align-items: stretch;
	}
	.join-row input {
		flex: 1 1 auto;
		min-width: 0;
		background: none;
		border: none;
		border-bottom: 1px solid rgba(255, 255, 255, 0.4);
		color: #fff;
		font-family: inherit;
		font-size: 1rem;
		padding: 0.6rem 0;
		border-radius: 0;
	}
	.join-row input::placeholder {
		color: rgba(255, 255, 255, 0.3);
	}
	.join-row input:focus {
		outline: none;
		border-bottom-color: #fff;
	}
	.join-row button {
		flex: 0 0 auto;
		margin-top: 0;
		width: auto;
		align-self: stretch;
		padding: 0.7rem 1.6rem;
	}
	.join-row button:disabled {
		opacity: 0.25;
		cursor: default;
		pointer-events: none;
	}

	/* ── Provider row ── */
	.or {
		margin: 1.75rem 0 1rem;
		font-size: 0.65rem;
		letter-spacing: 0.3em;
		text-transform: uppercase;
		opacity: 0.4;
	}
	.providers {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.6rem;
	}
	.provider {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.65rem 1.1rem;
		min-height: 44px;
		border: 1px solid rgba(255, 255, 255, 0.25);
		border-radius: 4px;
		color: #fff;
		text-decoration: none;
		font-size: 0.7rem;
		letter-spacing: 0.15em;
		text-transform: uppercase;
		transition: border-color 0.2s, background 0.2s;
		-webkit-tap-highlight-color: transparent;
	}
	.provider:hover,
	.provider:focus-visible {
		border-color: #fff;
		background: rgba(255, 255, 255, 0.07);
	}
	.provider :global(svg) {
		flex: 0 0 auto;
	}

	/* On narrow screens the labels crowd out; leave the marks alone. */
	@media (max-width: 560px) {
		.provider-label {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip: rect(0 0 0 0);
			white-space: nowrap;
		}
		.provider {
			padding: 0.65rem 0.9rem;
		}
		.play-track {
			display: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.provider,
		.play-btn {
			transition: none;
		}

		/* Final state only — the glow lives on the base rule, so removing the
		   animations leaves the headline fully styled, just not staged. */
		h1 .setup,
		h1 .punch,
		h1 .punch em,
		.hint {
			animation: none;
		}
	}

	/* ── Confirmation / Discord ── */
	.confirmation {
		font-size: 0.9rem;
		letter-spacing: 0.25em;
		text-transform: uppercase;
		opacity: 0.7;
		text-align: center;
	}

	.discord-prompt {
		font-size: 0.8rem;
		letter-spacing: 0.12em;
		opacity: 0.45;
		margin-top: 1.5rem;
		text-align: center;
	}

	.discord-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		margin-top: 1rem;
		border: 1px solid #5865f2;
		color: #fff;
		background: none;
		font-family: inherit;
		font-size: 0.85rem;
		letter-spacing: 0.15em;
		text-transform: uppercase;
		text-decoration: none;
		padding: 0.85rem 1.75rem;
		min-height: 48px;
		cursor: pointer;
		transition: background 0.2s, color 0.2s;
		-webkit-tap-highlight-color: transparent;
	}

	.discord-btn:hover {
		background: #5865f2;
		color: #fff;
	}

	@media (hover: none) {
		.discord-btn:active {
			background: #5865f2;
			color: #fff;
		}
		.discord-btn:hover {
			background: none;
			color: #fff;
		}
	}

	.discord-icon {
		width: 1.2em;
		height: 1.2em;
	}

	/* ── Tablet and up (>=640px) ── */
	@media (min-width: 640px) {
		.hero {
			padding: 2rem;
		}

		.tagline {
			font-size: 0.85rem;
			letter-spacing: 0.3em;
			margin-bottom: 2.5rem;
		}

		h1 {
			font-size: clamp(1.5rem, 3.5vw, 2.5rem);
			line-height: 1.4;
			margin-bottom: 1.1rem;
			padding: 0;
		}

		.hint {
			font-size: 1rem;
			margin-top: 0.6rem;
			margin-bottom: 3rem;
			padding: 0;
		}

		.enter {
			padding: 4rem 2rem;
		}

		button {
			font-size: 1rem;
			padding: 1rem 3rem;
		}

		form {
			gap: 2rem;
		}

		form button {
			width: auto;
			margin-top: 1rem;
		}
	}

	/* ── Desktop (>=1024px) ── */
	@media (min-width: 1024px) {
		.tagline {
			font-size: 1rem;
		}

		h1 {
			font-size: 2.5rem;
		}
	}
</style>

