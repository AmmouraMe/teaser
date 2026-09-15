<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { replaceState } from '$app/navigation';
	import { onMount } from 'svelte';
	import Seo from '$lib/components/Seo.svelte';
	import {
		SITE_NAME,
		SITE_URL,
		SITE_DESCRIPTION,
		PRODUCT_DESCRIPTION,
		CAPABILITIES,
		LAUNCH_ISO,
		DISCORD_URL,
		SOCIAL_LINKS,
		OG_IMAGE_PATH,
		OG_IMAGE_UNICORN_PATH,
		OG_IMAGE_ALT,
		OG_IMAGE_UNICORN_ALT,
		UNICORN_PARAM,
		unicornRequested
	} from '$lib/seo.js';

	// The countdown target is LAUNCH_ISO itself. It used to be a second copy of
	// the same instant written out here, which is one edit away from a page that
	// counts down to one date and tells crawlers another.
	const TARGET = new Date(LAUNCH_ISO).getTime();
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

	// While the track is playing, the arc IS the track: the number takes off on
	// the first note and lands on the last. Read straight off the audio element
	// so pausing and seeking stay in sync for free.
	// The Ammoura Discord server.
	const AMMOURA_DISCORD = 'https://discord.gg/dPRvKFS9dq';

	let trackStarted = $state(false);

	/** Where the arc puts the creature when nothing is playing: the real
	    countdown, March 22 → launch. This is its post. */
	function countdownProgress() {
		return Math.max(0, Math.min(1, (Date.now() - FLIGHT_START) / (TARGET - FLIGHT_START)));
	}

	// How much of the arc the track owns: 1 while it plays, 0 when the countdown
	// has it back. Eased rather than switched, because the two positions are a
	// long way apart — pressing play used to teleport the glyph to the start of
	// the arc, and stopping used to teleport it back. Now it flies.
	let flightMix = 0;
	// Where the track last had it. Once the track is no longer being read, this
	// is the point the return flight leaves from.
	let flightHeld = 0;
	const FLIGHT_TAKE = 0.05;
	const FLIGHT_RETURN = 0.022;

	function getFlightProgress() {
		const countdown = countdownProgress();
		const d = audioEl?.duration;
		if (trackStarted && Number.isFinite(d) && d > 0) {
			flightHeld = Math.max(0, Math.min(1, audioEl.currentTime / d));
		}
		const want = playing ? 1 : 0;
		flightMix += (want - flightMix) * (want > flightMix ? FLIGHT_TAKE : FLIGHT_RETURN);
		return countdown + (flightHeld - countdown) * flightMix;
	}

	onMount(() => {
		if (!flightCanvas) return;

		// Honoured for the rig only. Someone who has asked for less motion still
		// gets the planet, the weather and the pulse; what they do not get is
		// sweeping beams and a strobe.
		const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
		if (motionQuery) {
			reduceMotion = motionQuery.matches;
			motionQuery.addEventListener?.('change', (e) => { reduceMotion = e.matches; });
		}
		const ctx = flightCanvas.getContext('2d');
		if (!ctx) return;

		// 3D wireframe "21" — launch day, swept as tubes along digit centerlines.
		//
		// It used to be a hand-built "9": a torus for the bowl and a cylinder for
		// the tail. Two digits do not decompose that neatly, so the shape is now
		// described the way a sign-writer would describe it — a centerline path
		// per stroke — and one sweep turns each path into the same round tube.
		// Moving launch day again means editing DIGITS, not the geometry.
		const TWO_PI = Math.PI * 2;
		const V3 = [];
		const E3 = [];

		const tubR = 0.075;     // tube cross-section radius, before GLYPH_SCALE
		const minSegs = 6;      // segments per tube cross-section
		const arcSegs = 5;      // segments per quarter-turn of a curved stroke
		const MAX_STEP = 0.15;  // longest gap between rings, so straights get rungs too

		// Two digits are wider than one, so the pair is scaled to keep roughly the
		// ink area the old single digit had. Uniform, so the tube thins with it.
		const GLYPH_SCALE = 0.78;

		// Digit space: z is across, y is up, baseline at -0.65 and cap at 0.85.
		// The model is flat in x — the view yaw turns z into screen-width — so a
		// stroke is a polyline in the zy plane and the sweep gives it thickness.
		const BASE_Y = -0.65;
		const CAP_Y = 0.85;

		/** Sample a circular arc in the zy plane. Angles in radians, y up. */
		function arcPts(cz, cy, r, a0, a1) {
			const steps = Math.max(2, Math.round((Math.abs(a1 - a0) / (Math.PI / 2)) * arcSegs));
			const pts = [];
			for (let i = 0; i <= steps; i++) {
				const a = a0 + (a1 - a0) * (i / steps);
				pts.push([cz + r * Math.cos(a), cy + r * Math.sin(a)]);
			}
			return pts;
		}

		/** Subdivide so no gap between rings is longer than `step`. */
		function resample(path, step = MAX_STEP) {
			const out = [path[0]];
			for (let i = 1; i < path.length; i++) {
				const [z0, y0] = path[i - 1];
				const [z1, y1] = path[i];
				const n = Math.max(1, Math.ceil(Math.hypot(z1 - z0, y1 - y0) / step));
				for (let k = 1; k <= n; k++) out.push([z0 + (z1 - z0) * (k / n), y0 + (y1 - y0) * (k / n)]);
			}
			return out;
		}

		const D = Math.PI / 180;

		// "2": a bowl over the top, a diagonal down to the baseline, a flat foot.
		// One continuous stroke — a 2 is drawn without lifting the pen. The bowl's
		// own exit point at -40 degrees is where the diagonal starts.
		const twoBowl = arcPts(0, 0.47, 0.38, 195 * D, -40 * D);
		const two = [[...twoBowl, [-0.38, BASE_Y], [0.38, BASE_Y]]];

		// "1": flag, stem, and a foot. The foot is a separate stroke — it crosses
		// the stem rather than continuing it, so sweeping them as one path would
		// put a kink at the join.
		const one = [
			[[-0.24, 0.56], [0, CAP_Y], [0, BASE_Y]],
			[[-0.25, BASE_Y], [0.25, BASE_Y]],
		];

		// Laid out left to right by box width, then centred on z = 0.
		const DIGITS = [
			{ strokes: two, halfW: 0.38 },
			{ strokes: one, halfW: 0.25 },
		];
		const DIGIT_GAP = 0.12;

		/**
		 * Sweep a round tube along a centerline and append it to V3/E3.
		 *
		 * The path lies in the zy plane, so the cross-section plane is spanned by
		 * model x (always perpendicular to it) and the in-plane normal of the
		 * local tangent. Rings are stitched to their predecessor; an open path is
		 * simply left open at both ends.
		 */
		function sweep(path, dz, V3, E3, r = tubR) {
			let firstRing = -1;
			let prevRing = -1;
			for (let i = 0; i < path.length; i++) {
				// Central difference, so a corner gets the average of both edges
				// and the tube turns through it instead of pinching.
				const a = path[Math.max(0, i - 1)];
				const b = path[Math.min(path.length - 1, i + 1)];
				let tz = b[0] - a[0];
				let ty = b[1] - a[1];
				const tl = Math.hypot(tz, ty) || 1;
				tz /= tl; ty /= tl;
				// In-plane normal: the tangent turned a quarter turn.
				const nz = -ty, ny = tz;

				const baseIdx = V3.length;
				for (let j = 0; j < minSegs; j++) {
					const c = (j / minSegs) * TWO_PI;
					V3.push([
						r * Math.cos(c),
						path[i][1] + r * Math.sin(c) * ny,
						path[i][0] + dz + r * Math.sin(c) * nz,
					]);
					E3.push([baseIdx + j, baseIdx + (j + 1) % minSegs]);
				}
				if (prevRing >= 0) {
					for (let j = 0; j < minSegs; j++) E3.push([prevRing + j, baseIdx + j]);
				} else {
					firstRing = baseIdx;
				}
				prevRing = baseIdx;
			}
			return firstRing;
		}

		// Lay the digits out and sweep every stroke.
		{
			let totalW = 0;
			for (const d of DIGITS) totalW += d.halfW * 2;
			totalW += DIGIT_GAP * (DIGITS.length - 1);

			let cursor = -totalW / 2;
			for (const d of DIGITS) {
				const centerZ = cursor + d.halfW;
				for (const stroke of d.strokes) sweep(resample(stroke), centerZ, V3, E3);
				cursor += d.halfW * 2 + DIGIT_GAP;
			}

			for (const v of V3) { v[0] *= GLYPH_SCALE; v[1] *= GLYPH_SCALE; v[2] *= GLYPH_SCALE; }
		}

		// The unicorn — what flies the arc in the light theme, where the launch
		// date flies it in the dark one.
		//
		// It is described exactly the way the digits are: centreline strokes in
		// the same zy plane, through the same tube sweep. That is the whole reason
		// the "21" was rebuilt as paths rather than hand-assembled solids — a
		// sign-writer's description of a shape does not care whether the shape is
		// a numeral. Facing +z, which the view yaw turns into screen-right, so the
		// unicorn faces along its own direction of travel down the arc.
		//
		// The drawing is a horse first and a unicorn second: an arched crest, a
		// dished face, a deep girth over a tucked belly, and legs that break at
		// the elbow, knee and fetlock rather than bending in one arc. A unicorn
		// that is a horse with a horn reads as a unicorn; one built out of
		// sausages reads as a toy.
		// What the solid regions are filled with, before their outlines go on top.
		// A white coat on this theme's near-white sky needs the pink contour to
		// hold its edge, so the fill is barely off-white and the contour does the
		// drawing — the fill's job is only to stop the sky showing through.
		const COAT_FILL = 'rgba(255,252,253,0.95)';
		const COAT_FAR_FILL = 'rgba(253,238,245,0.95)';
		const HORN_FILL = 'rgba(255,188,222,0.97)';

		// How many poses of the stride are baked. The legs are swept tubes, so
		// re-posing them every frame would mean re-sweeping every frame; baking a
		// dozen and choosing one costs a little memory and nothing per frame.
		// Twelve reads as continuous at the stride rates below.
		const GALLOP_FRAMES = 12;

		const UNICORN_V3 = [];
		const UNICORN_E3 = [];
		// Every stroke lands in a named part, and each part is painted in its own
		// colour. The order they are added is the order they are drawn, so this
		// list runs back to front: tail and off-side legs, the body, then the
		// near legs, the mane over the neck, and the horn in front of everything.
		const UNICORN_PARTS = [];
		// Bigger than the digits it replaces. A unicorn carrying a jowl, a fetlock
		// and five mane strands needs more room than a numeral does, and at the
		// glyph's size every one of them collapsed into the outline.
		const UNICORN_SCALE = 1.15;
		// Finer than the digits get, and finer than the first pass used. The
		// features that make this a horse — a jowl, a fetlock, six mane strands
		// lying beside each other — are small next to a numeral's strokes, and at
		// the digits' thickness they close up into one blob.
		const UNICORN_TUB = tubR * 0.20;
		// Rings closer together than the digits', because these paths curve where
		// a numeral's mostly do not.
		const UNI_STEP = 0.032;
		{
			/** Sweep every stroke of one part, and remember the edges as that part. */
			function part(tag, strokes, r = UNICORN_TUB, frame) {
				const from = UNICORN_E3.length;
				const vFrom = UNICORN_V3.length;
				for (const stroke of strokes) {
					sweep(resample(stroke, UNI_STEP), 0, UNICORN_V3, UNICORN_E3, r);
				}
				UNICORN_PARTS.push({
					kind: 'stroke', tag, frame,
					from, to: UNICORN_E3.length,
					vFrom, vTo: UNICORN_V3.length,
				});
			}

			/**
			 * A solid region under the outlines.
			 *
			 * The outlines alone left the unicorn hollow — sky, globe and whatever
			 * else is behind it read straight through the barrel, which is what kept
			 * it looking like a sign of a horse rather than a horse. The centreline
			 * points go into the same vertex list the tubes use, so the fill rides
			 * the same projection and cannot drift from its own outline.
			 *
			 * Indexes into UNICORN_V3, where a stroke part indexes into UNICORN_E3;
			 * `kind` is how the draw loop tells the two apart.
			 */
			function fill(colour, path) {
				const from = UNICORN_V3.length;
				for (const [z, y] of path) UNICORN_V3.push([0, y, z]);
				UNICORN_PARTS.push({
					kind: 'fill', colour,
					from, to: UNICORN_V3.length,
					vFrom: from, vTo: UNICORN_V3.length,
				});
			}

			/** A hoof: a small box squared onto the end of a leg, along its last
			    segment, so it sits at whatever angle that leg happens to land. */
			function hoof(leg, size = 0.042) {
				const p1 = leg[leg.length - 1], p0 = leg[leg.length - 2];
				let dz = p1[0] - p0[0], dy = p1[1] - p0[1];
				const l = Math.hypot(dz, dy) || 1;
				dz /= l; dy /= l;
				const nz = -dy, ny = dz;
				const a = [p1[0] - nz * size, p1[1] - ny * size];
				const b = [p1[0] + nz * size, p1[1] + ny * size];
				const c = [b[0] + dz * size * 1.25, b[1] + dy * size * 1.25];
				const d = [a[0] + dz * size * 1.25, a[1] + dy * size * 1.25];
				return [a, b, c, d, a];
			}

			// ── Silhouette ──
			// Two open paths that meet end to end: the barrel runs chest → belly →
			// hindquarter → back → withers, and the neck picks the withers up and
			// carries on over the crest, round the head and back down the throat to
			// the chest. Open rather than closed, so neither one has to cut a chord
			// across the body to shut itself.
			//
			// Proportion is the whole job here. A barrel much deeper than half its
			// length reads as a box with legs; the topline has to dip behind the
			// withers and rise again over the croup, and the underline has to run
			// deep at the girth and tuck up at the flank, or none of it is a horse.
			const barrel = [
				[0.355, 0.150], [0.372, 0.055], [0.360, -0.045], [0.310, -0.140],
				[0.195, -0.200], [0.040, -0.218], [-0.125, -0.196], [-0.258, -0.140],
				[-0.362, -0.048], [-0.452, 0.068], [-0.492, 0.188], [-0.458, 0.282],
				[-0.352, 0.334], [-0.212, 0.332], [-0.060, 0.315], [0.080, 0.328],
				[0.195, 0.355],
			];
			const neckHead = [
				[0.195, 0.355], [0.265, 0.450], [0.345, 0.545], [0.430, 0.630],
				[0.510, 0.695], [0.575, 0.730], [0.645, 0.735], [0.715, 0.710],
				// The dish: these three sit below the straight line from brow to
				// muzzle, so the face curves inward. It is the difference between a
				// pretty head and a plain one, and it is worth three decimals.
				[0.780, 0.608], [0.845, 0.556], [0.895, 0.515],
				[0.932, 0.492], [0.948, 0.448], [0.930, 0.412], [0.880, 0.400],
				[0.838, 0.418], [0.790, 0.448], [0.730, 0.478], [0.662, 0.498],
				[0.594, 0.486], [0.524, 0.462], [0.452, 0.414], [0.386, 0.345],
				[0.334, 0.258], [0.312, 0.178], [0.355, 0.150],
			];


			// ── Legs ──
			// Not four fixed paths any more: a leg is an origin, five segment
			// lengths and an angle per segment, so the same leg can be posed
			// anywhere in a stride. The lengths are measured off the hand-drawn
			// canter this replaces, which is what keeps it the same leg.
			//
			// Angles are degrees from straight down, positive forward — the
			// direction the unicorn faces — so a reaching leg is positive
			// throughout and a trailing one negative.
			const FORE_SEG = [0.109, 0.156, 0.135, 0.103, 0.068];
			const HIND_SEG = [0.151, 0.212, 0.142, 0.108, 0.073];
			// The off pair hangs from slightly further back, which is the only
			// depth cue a strict profile allows.
			const FORE_ORIGIN = [0.330, -0.150];
			const FORE_ORIGIN_FAR = [0.296, -0.164];
			const HIND_ORIGIN = [-0.372, -0.068];
			const HIND_ORIGIN_FAR = [-0.338, -0.082];

			// One stride, as four poses a leg passes through in order: reach out,
			// plant under the body, push away behind, then fold up and carry the
			// foot forward again.
			const FORE_KEYS = [
				[54, 62, 40, 24, 12],      // reach — right out in front
				[5, 6, 2, 0, -2],          // plant
				[-34, -42, -28, -16, -6],  // push
				[-14, -26, 62, 104, 120],  // fold — the knee shuts and the cannon
			];                             //        swings up under the chest
			const HIND_KEYS = [
				[58, -6, 30, 30, 18],
				[14, -32, -6, 0, -2],
				[-20, -60, -46, -30, -18],
				[40, -30, 58, 74, 46],
			];

			// Where each leg sits in the stride. A gallop is four separate beats,
			// not two pairs moving together: both hinds land, then both fores,
			// then the whole animal is off the ground.
			const GALLOP_OFFSET = { hindFar: 0, hindNear: 0.13, foreFar: 0.46, foreNear: 0.59 };

			const D2R = Math.PI / 180;

			/** Pose one leg at a point in the stride, as a path the sweep can take. */
			function legAt(origin, seg, keys, phase) {
				const n = keys.length;
				const f = (((phase % 1) + 1) % 1) * n;
				const i = Math.floor(f);
				const t = f - i;
				// Smoothstep between keys, so a joint eases into its next angle
				// rather than changing speed at every key.
				const e = t * t * (3 - 2 * t);
				const a = keys[i];
				const b = keys[(i + 1) % n];
				const pts = [origin.slice()];
				for (let k = 0; k < seg.length; k++) {
					const ang = (a[k] + (b[k] - a[k]) * e) * D2R;
					const prev = pts[pts.length - 1];
					pts.push([prev[0] + seg[k] * Math.sin(ang), prev[1] - seg[k] * Math.cos(ang)]);
				}
				return pts;
			}

			const legs = (f) => {
				const ph = f / GALLOP_FRAMES;
				return {
					foreNear: legAt(FORE_ORIGIN, FORE_SEG, FORE_KEYS, ph + GALLOP_OFFSET.foreNear),
					foreFar: legAt(FORE_ORIGIN_FAR, FORE_SEG, FORE_KEYS, ph + GALLOP_OFFSET.foreFar),
					hindNear: legAt(HIND_ORIGIN, HIND_SEG, HIND_KEYS, ph + GALLOP_OFFSET.hindNear),
					hindFar: legAt(HIND_ORIGIN_FAR, HIND_SEG, HIND_KEYS, ph + GALLOP_OFFSET.hindFar),
				};
			};
			const POSES = Array.from({ length: GALLOP_FRAMES }, (_, f) => legs(f));

			// ── Mane ──
			// Five strands off the crest, streaming back over the withers. Separate
			// paths rather than one shape, because hair reads as hair only when the
			// strands can cross and leave sky between them.
			const mane = [
				[[0.568, 0.730], [0.500, 0.808], [0.408, 0.848], [0.315, 0.828], [0.248, 0.765], [0.216, 0.690]],
				[[0.492, 0.685], [0.416, 0.760], [0.324, 0.796], [0.230, 0.776], [0.160, 0.712], [0.128, 0.635]],
				[[0.412, 0.622], [0.328, 0.690], [0.236, 0.722], [0.144, 0.698], [0.076, 0.632], [0.046, 0.558]],
				[[0.330, 0.535], [0.246, 0.596], [0.154, 0.624], [0.066, 0.600], [-0.002, 0.540], [-0.030, 0.470]],
				[[0.252, 0.440], [0.172, 0.492], [0.084, 0.514], [0.000, 0.490], [-0.060, 0.434]],
			];
			// Forelock, falling forward off the poll between the ears.
			const forelock = [
				[[0.582, 0.732], [0.636, 0.726], [0.688, 0.688], [0.712, 0.634], [0.716, 0.582]],
				[[0.566, 0.720], [0.614, 0.708], [0.658, 0.670], [0.676, 0.618]],
			];

			// ── Tail ──
			// Five strands off the dock, carried high the way a horse carries it at
			// speed, then falling away behind.
			const tail = [
				[[-0.430, 0.280], [-0.548, 0.330], [-0.672, 0.320], [-0.788, 0.242], [-0.862, 0.118]],
				[[-0.440, 0.245], [-0.566, 0.276], [-0.696, 0.250], [-0.808, 0.150], [-0.872, 0.008]],
				[[-0.448, 0.212], [-0.578, 0.218], [-0.708, 0.170], [-0.810, 0.046], [-0.860, -0.106]],
				[[-0.452, 0.178], [-0.578, 0.160], [-0.700, 0.086], [-0.788, -0.052], [-0.822, -0.208]],
				[[-0.450, 0.145], [-0.566, 0.100], [-0.672, 0.006], [-0.740, -0.142], [-0.756, -0.298]],
			];
			const dock = [[-0.432, 0.292], [-0.485, 0.276], [-0.522, 0.245]];

			// ── Head furniture ──
			const earNear = [
				[0.540, 0.728], [0.526, 0.818], [0.556, 0.860], [0.580, 0.795],
				[0.576, 0.726], [0.540, 0.728],
			];
			const earFar = [
				[0.502, 0.714], [0.482, 0.792], [0.508, 0.828], [0.534, 0.770],
				[0.534, 0.710], [0.502, 0.714],
			];
			// Small enough to be a mark rather than a feature. At the size this
			// finally renders, an eye drawn to scale is a dot, and a dot is right.
			const eye = [
				[0.691, 0.648], [0.700, 0.657], [0.710, 0.648], [0.700, 0.639], [0.691, 0.648],
			];
			const nostril = [
				[0.897, 0.498], [0.905, 0.506], [0.914, 0.499], [0.905, 0.492], [0.897, 0.498],
			];
			const mouth = [[0.935, 0.448], [0.900, 0.430], [0.870, 0.425]];
			const jowl = [[0.730, 0.478], [0.706, 0.545], [0.722, 0.608]];
			// Two interior lines doing the work a shaded drawing would: the
			// shoulder blade, and the line off the point of the hip.
			const shoulder = [[0.245, 0.330], [0.300, 0.205], [0.322, 0.080]];
			const haunch = [[-0.440, 0.225], [-0.392, 0.078], [-0.352, -0.036]];

			// ── Horn ──
			// A cone leaning forward off the brow, about as long as the head, with
			// three ridges banded across it. A drawn spiral needs the tube to leave
			// the zy plane, which this sweep cannot do; banding it is how a
			// sign-writer fakes the twist, and at this size it is the same picture.
			const horn = [
				[0.641, 0.747], [0.667, 0.862], [0.690, 0.964], [0.706, 1.035],
				[0.696, 0.962], [0.681, 0.860], [0.663, 0.743], [0.641, 0.747],
			];
			const ridges = [
				[[0.657, 0.814], [0.674, 0.821]],
				[[0.677, 0.901], [0.687, 0.909]],
			];

			// The silhouette as one closed loop. The barrel runs chest to withers and
			// the neck carries on from the withers back round to the chest, so laid
			// end to end they already close — which is why neither had to cut a
			// chord across the body to shut itself.
			const silhouette = [...barrel, ...neckHead];

			// Back to front.
			//
			// All four legs go down before the body does, not just the off pair. In
			// profile every leg leaves the barrel behind its own silhouette, so the
			// fill covering their tops is what the animal actually looks like; the
			// near pair is told apart by its paint, not by its order.
			part('tail', [...tail, dock], UNICORN_TUB * 0.7);
			for (let f = 0; f < GALLOP_FRAMES; f++) {
				part('coatFar', [POSES[f].hindFar, POSES[f].foreFar], UNICORN_TUB, f);
			}
			for (let f = 0; f < GALLOP_FRAMES; f++) {
				part('hoofFar', [hoof(POSES[f].hindFar), hoof(POSES[f].foreFar)], UNICORN_TUB, f);
			}
			for (let f = 0; f < GALLOP_FRAMES; f++) {
				part('coat', [POSES[f].hindNear, POSES[f].foreNear], UNICORN_TUB, f);
			}
			for (let f = 0; f < GALLOP_FRAMES; f++) {
				part('hoof', [hoof(POSES[f].hindNear), hoof(POSES[f].foreNear)], UNICORN_TUB, f);
			}
			fill(COAT_FAR_FILL, earFar);
			part('coatFar', [earFar]);
			fill(COAT_FILL, silhouette);
			part('coat', [barrel, neckHead]);
			fill(COAT_FILL, earNear);
			part('coat', [earNear]);
			part('detail', [shoulder, haunch, jowl]);
			part('mane', [...mane, ...forelock], UNICORN_TUB * 0.7);
			part('detail', [nostril, mouth]);
			part('eye', [eye]);
			fill(HORN_FILL, horn);
			part('horn', [horn]);
			part('ridge', ridges);

			for (const v of UNICORN_V3) {
				v[0] *= UNICORN_SCALE; v[1] *= UNICORN_SCALE; v[2] *= UNICORN_SCALE;
			}
		}

		// What each part is painted in. Passes run in order, so a wide soft pass
		// followed by a narrow bright one draws a coloured contour with a lit core
		// down the middle — which is the only way a white coat survives this
		// theme's sky. #fff7fb through mint is very nearly white already, and a
		// white line on it is an invisible line; the pink edge is what holds the
		// shape, and the white is what makes the shape read as white.
		//
		// Light theme only: the dark theme flies the "21" and never asks for these.
		const UNICORN_PAINT = {
			tail:    [['rgba(226,74,150,0.40)', 1.5], ['rgba(255,152,201,0.95)', 0.68]],
			mane:    [['rgba(226,74,150,0.44)', 1.5], ['rgba(255,158,205,0.98)', 0.68]],
			// The off side is the same coat seen past the body: less contrast, more
			// pink, so it falls behind without needing a depth buffer.
			coatFar: [['rgba(232,148,190,0.70)', 1.3], ['rgba(253,232,243,0.95)', 0.62]],
			coat:    [['rgba(236,124,178,0.88)', 1.6], ['rgba(255,255,255,0.98)', 0.7]],
			hoofFar: [['rgba(206,120,170,0.65)', 1.0]],
			hoof:    [['rgba(190,70,140,0.88)', 1.2]],
			detail:  [['rgba(224,128,178,0.42)', 0.55]],
			eye:     [['rgba(96,46,92,0.85)', 0.9]],
			horn:    [['rgba(206,44,128,0.82)', 1.3]],
			ridge:   [['rgba(214,52,134,0.72)', 0.8]],
		};


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

		// How far the equator ellipse is squashed: the one number that decides how
		// far above the dome we appear to be standing.
		const DOME_TILT = 0.32;

		// Ocean for the graticule, land for the coastlines — each a ramp rather
		// than one colour. The far side of the sphere sits at the dark end and
		// the near side at the bright end, so the body has real colour range
		// across its own width instead of one flat tint fading out.

		// One revolution, in milliseconds. Slow on purpose: the countdown is what
		// the eye is meant to land on, and a fast globe steals it.
		const GLOBE_SPIN_MS = 90000;

		// Which longitude faces the viewer. -30 is mid-Atlantic, which puts the
		// Americas on the left of the globe and Europe and Africa on the right —
		// the view that reads as "Earth" fastest at this size.
		const GLOBE_LON0 = -30;

		// Northern-hemisphere coastlines, flat [lat, lon, lat, lon, …] rings.
		// Coarse on purpose — every vertex is a stroke on every frame, and these
		// read as continents at a glance, which is the job. The draw walks each
		// leg in lat/lon so the line lies on the sphere however big it gets; what
		// it cannot add is detail that is not in the data, so at viewport width
		// the shapes stay angular. Only the north is here because a hemisphere
		// cuts at the equator anyway.
		const COASTLINES = [
			// North America
			[70,-160, 70,-130, 69,-100, 73,-80, 60,-64, 47,-52, 45,-67, 35,-76,
			 25,-80, 30,-94, 20,-97, 16,-95, 20,-105, 32,-117, 48,-125, 60,-140,
			 60,-165, 70,-160],
			// Greenland
			[83,-30, 76,-20, 70,-22, 60,-43, 65,-53, 76,-68, 82,-60, 83,-30],
			// Northern South America, down to the cut
			[12,-72, 11,-62, 8,-50, 0,-50, 0,-79, 12,-72],
			// Eurasia
			[36,-6, 43,-9, 48,-5, 52,4, 58,5, 62,5, 71,25, 69,60, 73,80, 75,100,
			 73,140, 69,170, 62,179, 60,162, 54,160, 53,141, 45,135, 39,122,
			 31,122, 22,114, 21,107, 13,100, 16,95, 21,89, 15,80, 8,77, 23,68,
			 25,57, 12,44, 30,33, 36,36, 40,26, 41,29, 45,14, 43,5, 36,-6],
			// Africa, north of the equator
			[37,10, 32,22, 31,32, 12,43, 0,42, 0,9, 5,-5, 15,-17, 28,-13, 35,-6, 37,10],
			// British Isles
			[58,-5, 54,-2, 51,1, 50,-5, 55,-6, 58,-5],
		];

		// ── Weather and the light show ──
		// Both belong to the track. Nothing here draws while the page is silent:
		// the planet the visitor lands on is the bare wireframe, and pressing
		// play is what gives it an atmosphere.

		// Clouds arrive over about two seconds and clear a little faster. Slower
		// than the EQ fade on purpose — weather should roll in, not switch on.
		const CLOUD_FADE_IN = 0.012;
		const CLOUD_FADE_OUT = 0.02;
		// Clouds turn faster than the ground beneath them, so the two layers
		// separate as the globe spins.
		const CLOUD_DRIFT = 1.35;
		// Cloud tops sit just off the surface. Enough to read as a layer at the
		// limb, not enough to float.
		const CLOUD_ALT = 1.015;

		/** Small deterministic PRNG, so the sky is the same sky on every load. */
		function mulberry32(a) {
			return function () {
				a = (a + 0x6d2b79f5) | 0;
				let t = Math.imul(a ^ (a >>> 15), 1 | a);
				t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
				return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
			};
		}

		// Cloud banks, in lat/lon on the same sphere as everything else. A bank is
		// a dozen small puffs packed tightly enough to overlap: drawn additively
		// they build one soft mass, where a few big puffs only ever read as a few
		// big circles. Banks are stretched along longitude, the way weather
		// actually bands, and the spread is divided by cos(lat) so a bank stays
		// about as wide as it is tall as it approaches the pole.
		const CLOUD_CELLS = (() => {
			const rnd = mulberry32(0x5eed);
			const cells = [];
			for (let i = 0; i < 34; i++) {
				// Biased to the tropics and mid-latitudes: rnd² leaves the pole
				// comparatively clear, which is what the real thing looks like
				// from above and stops the apex silting up.
				const lat = 2 + rnd() * rnd() * 84;
				const puffs = [];
				const n = 9 + Math.floor(rnd() * 6);
				const spread = 0.7 + rnd() * 0.8;
				for (let p = 0; p < n; p++) {
					puffs.push({
						dLat: (rnd() - 0.5) * 5 * spread,
						dLon: (rnd() - 0.5) * 9 * spread,
						r: 0.4 + rnd() * 0.55,
					});
				}
				cells.push({ lat, lon: rnd() * 360 - 180, puffs });
			}
			return cells;
		})();

		// One soft puff, drawn once and stamped with drawImage. A radial gradient
		// built per puff per frame is the obvious way to do this and is far too
		// expensive at three hundred of them. The falloff is deliberately gradual
		// — any hard stop in the ramp shows up as a visible disc edge once a few
		// hundred of these are stacked.
		let puffSprite = null;
		function getPuffSprite() {
			if (puffSprite) return puffSprite;
			const S = 128;
			const c = document.createElement('canvas');
			c.width = c.height = S;
			const g = c.getContext('2d');
			const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
			grad.addColorStop(0, 'rgba(255,255,255,0.62)');
			grad.addColorStop(0.30, 'rgba(240,248,255,0.30)');
			grad.addColorStop(0.62, 'rgba(214,234,255,0.09)');
			grad.addColorStop(1, 'rgba(200,226,255,0)');
			g.fillStyle = grad;
			g.fillRect(0, 0, S, S);
			puffSprite = c;
			return puffSprite;
		}

		// Tower and dome dimensions (responsive). The planet is deliberately far
		// bigger than the towers now: its apex is their base, and the body of it
		// hangs down behind the tagline and the headline. The canvas sits under
		// the copy in the stacking order, so no room is reserved for it — the
		// text is meant to read over the planet, the way a title card sits over
		// a photograph.
		function getTowerDims(w) {
			return {
				towerW: w < 480 ? 8 : 12,
				towerH: w < 480 ? 45 : 65,
				towerGap: w < 480 ? 6 : 10,
				// The planet spans the viewport: radius is half the canvas width,
				// so the equator meets both edges exactly. The apex still sits on
				// the towers, so the body hangs down behind the whole hero.
				domeR: w / 2,
			};
		}

		// A fixture: where it idles, how fast it swings, how wide the cone, and
		// which band drives it. Randomised per beam so the rig has a shape —
		// sixteen identical beams sweeping in lockstep is a windscreen wiper.
		function makeBeams(seed, count, from, arc) {
			const rnd = mulberry32(seed);
			return Array.from({ length: count }, (_, i) => ({
				base: from + (i / count) * arc + (rnd() - 0.5) * 0.12,
				speed: 0.55 + rnd() * 1.5,
				phase: rnd() * TWO_PI,
				swing: 0.2 + rnd() * 0.5,    // radians either side of base
				width: 0.009 + rnd() * 0.017, // tip half-width, in beam lengths
				band: i % 3,
			}));
		}

		// Three trusses. The main one hangs off the towers and throws in every
		// direction; the two wings sit off the bottom corners and rake upward and
		// inward, so their beams cross the main rig's rather than running beside
		// them. Crossing beams are most of what makes a rig read as a rig.
		const RIGS = [
			{ beams: makeBeams(0xb3a, BEAM_COUNT, 0, TWO_PI), wash: true, at: 'towers' },
			{ beams: makeBeams(0x51d, 5, -1.5, 1.15), wash: false, at: 'left' },
			{ beams: makeBeams(0x7c2, 5, -1.95, 1.15), wash: false, at: 'right' },
		];

		// Gradients are built once per colour in a canonical space — origin at 0,0,
		// running one unit along +x — and painted under a transform. A gradient's
		// coordinates are read in user space at paint time, so one object serves
		// every beam of that colour at every angle and length.
		//
		// Worth stating what was measured, because two obvious optimisations are
		// both wrong here. Rebuilding the gradients per beam per frame: 24fps against
		// 60 with the rig off. Caching them as below: 41. Rendering the whole rig
		// into a half-resolution layer on top of that: 41 again — so it was never
		// fill rate. Stamping each beam as a pre-rendered bitmap instead: 32, because
		// a rotated non-uniform upscale is worse than shading the gradient. The cache
		// is the win; the rest is paid for by drawing fewer beams, which is what the
		// quality guard below does.
		const beamGradCache = new Map();
		function beamGrads(ci) {
			// Keyed by theme as well as index: the two palettes put different
			// colours at the same slot, so an index alone would serve bubblegum
			// out of the dark theme's cache.
			const key = `${theme}:${ci}`;
			let g = beamGradCache.get(key);
			if (g) return g;
			const c = pal().rig[ci];
			const rgb = `${c[0]},${c[1]},${c[2]}`;
			const cone = ctx.createLinearGradient(0, 0, 1, 0);
			cone.addColorStop(0, `rgba(${rgb},1)`);
			cone.addColorStop(0.35, `rgba(${rgb},0.42)`);
			cone.addColorStop(1, `rgba(${rgb},0)`);
			const core = ctx.createLinearGradient(0, 0, 1, 0);
			core.addColorStop(0, `rgba(${rgb},1)`);
			core.addColorStop(0.5, `rgba(${rgb},0.32)`);
			core.addColorStop(1, `rgba(${rgb},0)`);
			const haze = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
			haze.addColorStop(0, `rgba(${rgb},1)`);
			haze.addColorStop(0.5, `rgba(${rgb},0.34)`);
			haze.addColorStop(1, `rgba(${rgb},0)`);
			g = { cone, core, haze };
			beamGradCache.set(key, g);
			return g;
		}

		/**
		 * One truss, drawn from its own origin outward.
		 *
		 * Beams are flat cones under a linear gradient, composited additively —
		 * which is what light in haze actually does, and why two crossing beams
		 * brighten where they meet instead of one covering the other. Each cone
		 * carries a thin bright core down its axis: without it a beam is a soft
		 * wedge of glow, and with it the eye reads a shaft of light.
		 *
		 * Drawn before the planet, so the wireframe reads on top of the beams the
		 * way a stage truss reads against its own.
		 */
		function drawRig(w, h, ox, oy, beams, wash) {
			const gain = eqMix * (reduceMotion ? 0 : 1);
			if (gain < 0.01) return;
			const len = Math.hypot(w, h) * 1.15;
			const coreW = w < 480 ? 1.2 : 2.2;
			// The guard hangs beams, not brightness: a thinner rig is still a rig,
			// where a dimmer one just looks broken.
			const hung = Math.max(2, Math.round(beams.length * rigQuality));

			ctx.save();
			ctx.globalCompositeOperation = pal().blend;
			ctx.lineCap = 'round';

			// Haze in the colour of the moment. This is what stops the beams reading
			// as loose triangles on black. Filled as a disc rather than a full-canvas
			// rect: the gradient is transparent past its own radius anyway, so the
			// rect was paying for pixels it could not change.
			const washA = gain * (0.06 + 0.22 * bandHit[0] + 0.07 * bandEnergy[0]);
			if (wash && washA > 0.004) {
				ctx.save();
				ctx.translate(ox, oy);
				ctx.scale(len * 0.55, len * 0.55);
				ctx.globalAlpha = washA;
				ctx.fillStyle = beamGrads(rigColour).haze;
				ctx.beginPath();
				ctx.arc(0, 0, 1, 0, TWO_PI);
				ctx.fill();
				ctx.restore();
			}

			for (let i = 0; i < hung; i++) {
				const b = beams[i];
				const g = beamGrads(i % 2 ? (rigColour + 2) % pal().rig.length : rigColour);
				// Idle sweep, plus a throw on the kick that moves the whole truss to a
				// new spread at once. rigSnap decays, so the beams ease back into their
				// sweep rather than staying thrown.
				const ang = b.base
					+ Math.sin(rigPhase * b.speed + b.phase) * b.swing
					+ rigSnap * b.swing * 1.9 * (i % 2 ? 1 : -1);
				const drive = 0.3 + 0.7 * bandEnergy[b.band] + 0.7 * bandHit[b.band];
				const a = gain * drive * 0.22;
				if (a < 0.004) continue;
				const halfW = b.width * (0.55 + 0.8 * drive);

				ctx.save();
				ctx.translate(ox, oy);
				ctx.rotate(ang);
				ctx.scale(len, len);
				ctx.globalAlpha = a;
				ctx.fillStyle = g.cone;
				ctx.beginPath();
				ctx.moveTo(0, 0);
				ctx.lineTo(1, halfW);
				ctx.lineTo(1, -halfW);
				ctx.closePath();
				ctx.fill();

				// The core. Same axis, far brighter, a couple of pixels wide — the
				// width is divided back out of the scale that made the beam.
				ctx.globalAlpha = Math.min(0.95, a * 2.8);
				ctx.strokeStyle = g.core;
				ctx.lineWidth = (coreW * (0.6 + 0.9 * drive)) / len;
				ctx.beginPath();
				ctx.moveTo(0, 0);
				ctx.lineTo(1, 0);
				ctx.stroke();
				ctx.restore();
			}
			ctx.restore();
		}

		/**
		 * The candy mountain: what the towers become in the light theme.
		 *
		 * It stands on the same point of the planet the towers stand on, which is
		 * the apex, and its height is clamped the same way theirs is — the apex
		 * tracks the tagline, and on a short window that sits close to the top of
		 * the canvas, so an unclamped peak simply leaves the frame.
		 *
		 * Striped by clipping to the silhouette and running bands across it. A
		 * candy stripe is a helix in life and a set of parallel diagonals in any
		 * drawing of one, so parallel diagonals is what this does.
		 */
		function drawCandyMountain(w, bx, by, towerW, towerH, towerGap) {
			const height = Math.max(towerH * 0.7, Math.min(towerH * 1.7, by - 14));
			const halfBase = height * 0.92;
			const peakY = by - height;
			// A shoulder on one side, so it is a mountain and not a traffic cone.
			const outline = [
				[bx - halfBase, by],
				[bx - halfBase * 0.46, by - height * 0.46],
				[bx - halfBase * 0.26, by - height * 0.37],
				[bx, peakY],
				[bx + halfBase * 0.38, by - height * 0.33],
				[bx + halfBase, by],
			];
			const trace = () => {
				ctx.beginPath();
				ctx.moveTo(outline[0][0], outline[0][1]);
				for (let i = 1; i < outline.length; i++) ctx.lineTo(outline[i][0], outline[i][1]);
				ctx.closePath();
			};

			ctx.save();
			trace();
			// Strawberry body, so the white bands read as stripes rather than as
			// gaps in nothing.
			ctx.fillStyle = 'rgba(255,170,203,0.95)';
			ctx.fill();

			ctx.save();
			ctx.clip();
			// The stripes, spaced off the mountain's own size so they hold the
			// same rhythm on a phone as on a desktop.
			const band = halfBase * 0.34;
			ctx.strokeStyle = 'rgba(255,255,255,0.95)';
			ctx.lineWidth = band * 0.52;
			ctx.beginPath();
			for (let k = -4; k < 12; k++) {
				const x0 = bx - halfBase * 2 + k * band;
				ctx.moveTo(x0, by + 4);
				ctx.lineTo(x0 + height * 0.95, peakY - 4);
			}
			ctx.stroke();

			// Icing over the top, inside the same clip — which is what keeps it on
			// the mountain instead of hanging in the sky, and lets the drips be a
			// plain wave rather than a shape fitted to the slopes.
			const icingY = peakY + height * 0.3;
			ctx.beginPath();
			ctx.moveTo(bx - halfBase, peakY - height * 0.1);
			ctx.lineTo(bx + halfBase, peakY - height * 0.1);
			ctx.lineTo(bx + halfBase, icingY);
			const dips = 5;
			for (let k = dips; k >= 0; k--) {
				const x0 = bx - halfBase + (k / dips) * halfBase * 2;
				const xm = x0 - (halfBase / dips);
				ctx.quadraticCurveTo(xm, icingY + height * 0.16, xm - halfBase / dips, icingY);
			}
			ctx.closePath();
			ctx.fillStyle = 'rgba(255,255,255,0.97)';
			ctx.fill();
			ctx.restore();

			// Edge, over the stripes, so the silhouette stays crisp. The outline
			// has to be laid down again: restore() puts back the clip and the
			// styles, but the current path is not part of that state, and without
			// this the edge pass strokes the stripes across the open sky.
			trace();
			ctx.strokeStyle = 'rgba(214,86,144,0.9)';
			ctx.lineWidth = w < 480 ? 1.1 : 1.6;
			ctx.stroke();

			// And a cherry, because a candy mountain without one is just a hill.
			const cherryR = Math.max(2.5, height * 0.075);
			ctx.beginPath();
			ctx.arc(bx, peakY - cherryR * 0.8, cherryR, 0, TWO_PI);
			ctx.fillStyle = 'rgba(226,48,88,0.96)';
			ctx.fill();
			ctx.restore();
		}

		function getArcPoints(w, h) {
			const { towerW, towerH, towerGap } = getTowerDims(w);

			// Tower base — which is also the planet's apex: centered horizontally,
			// and just above the tagline. The planet's body falls from here down
			// behind the words rather than being kept clear of them.
			let baseX = w * 0.5;
			let baseY = h * 0.38;
			if (taglineEl) {
				const rect = taglineEl.getBoundingClientRect();
				const canvasRect = flightCanvas.getBoundingClientRect();
				baseX = rect.left + rect.width / 2 - canvasRect.left;
				baseY = rect.top - canvasRect.top - (w < 480 ? 14 : 22);
			}

			// Everything here is drawn *upward* from baseY, and baseY tracks the
			// tagline. On a phone the tagline sits close to the top — Georgia is
			// wider than the fallback we develop against, so the headline wraps to
			// three lines and pushes the block up — which put the towers at a
			// negative y, off the top of the canvas. The hero no longer clips, so
			// that is no longer a hard cut, but the glyph still belongs on screen:
			// keep it there whatever the text above it does.
			baseY = Math.max(baseY, towerH + 12);

			// Arc endpoint = the bottom-right corner of the tower pair, where the
			// two towers stand on the planet. It used to be a third of the way
			// down the right tower, which left the 21 landing in mid-air against
			// the side of the "11"; the foot of the pair is where a flight path
			// actually terminates.
			const endX = baseX + towerGap / 2 + towerW; // right edge of right tower
			const endY = baseY;                          // the towers' base

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
			const startY = Math.max(8, baseY - rise * 0.75);

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

		// One flat x,y buffer per model, kept for as long as the model is. Both
		// models are built once in this scope, so a WeakMap would buy nothing a
		// pair of slots does not.
		const projBuffers = new WeakMap();
		function projectionBuffer(V) {
			let buf = projBuffers.get(V);
			if (!buf || buf.length < V.length * 2) {
				buf = new Float64Array(V.length * 2);
				projBuffers.set(V, buf);
			}
			return buf;
		}

		/** The theme's ink at an alpha — every white the draw loop used to hardcode. */
		const inkA = (a) => `rgba(${pal().ink.join(',')},${Math.min(1, a * pal().lineBoost)})`;

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
			const N = 120;

			// Plane scale: responsive
			const planeSize = w < 480 ? Math.min(w, h) * 0.045 : Math.min(w, h) * 0.04;

			// Audio, once per frame, before anything that reacts to it is drawn.
			// The number swings perpendicular to its own track and the arc becomes a
			// spectrum; both read the same sample, so they stay in step.
			const nowMs = Date.now();
			const dt = lastFrameAt ? Math.min(0.05, (nowMs - lastFrameAt) / 1000) : 0.016;
			lastFrameAt = nowMs;
			const target = playing ? readLevel() : 0;
			level += (target - level) * (target > level ? DANCE_ATTACK : DANCE_RELEASE);
			dancePhase += dt * DANCE_SPEED;

			// The stride. Advanced every frame whatever the theme, so switching to
			// the unicorn mid-track does not drop it into a standing pose.
			const running = playing ? 1 : 0;
			gallopMix +=
				(running - gallopMix) * (running > gallopMix ? GALLOP_SPIN_UP : GALLOP_WIND_DOWN);
			gallopPhase += dt * gallopMix * (GALLOP_RATE + GALLOP_RATE_DRIVE * level);

			// Where along the arc it is. Read here rather than at the top of the
			// frame because it advances an easing of its own, and it should do that
			// once per frame alongside the others.
			const t = getFlightProgress();

			// readLevel() has just refreshed freqData, so the bars are free.
			updateEqBars(playing);
			const eqTarget = playing ? 1 : 0;
			eqMix += (eqTarget - eqMix) * (eqTarget > eqMix ? EQ_FADE_IN : EQ_FADE_OUT);
			// The weather has its own, slower fade than the arc's spectrum.
			cloudMix += (eqTarget - cloudMix) * (eqTarget > cloudMix ? CLOUD_FADE_IN : CLOUD_FADE_OUT);

			// The lighting desk, then the beams — before everything else, so the
			// arc, the planet and the glyph all read against them.
			adaptRig(dt);
			updateRig(nowMs, dt, playing);
			{
				const { towerH } = getTowerDims(w);
				for (const rig of RIGS) {
					const ox = rig.at === 'towers' ? towerBaseX : rig.at === 'left' ? w * 0.06 : w * 0.94;
					const oy = rig.at === 'towers' ? towerBaseY - towerH : h * 1.04;
					drawRig(w, h, ox, oy, rig.beams, rig.wash);
				}
			}

			// Past path (dotted)
			ctx.save();
			ctx.strokeStyle = inkA(0.18);
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
			ctx.strokeStyle = inkA(0.3);
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

			// Equaliser. Ticks perpendicular to the arc, mirrored either side of it,
			// so the line itself looks like it is opening and closing rather than
			// having bars stuck to it. Faint, and it fades out with eqMix when the
			// track stops rather than vanishing on the pause frame.
			if (eqMix > 0.003) {
				ctx.save();
				ctx.lineCap = 'round';
				ctx.lineWidth = w < 480 ? 0.9 : 1.1;
				const maxHalf = Math.min(Math.min(w, h) * EQ_MAX, EQ_MAX_PX);
				for (let i = 0; i < EQ_BARS; i++) {
					const s = (i + 0.5) / EQ_BARS;
					const bp = bz(s, P0, P1, P2);
					const bd = bzd(s, P0, P1, P2);
					const bl = Math.hypot(bd[0], bd[1]) || 1;
					// Normal to the arc at this point.
					const enx = -bd[1] / bl;
					const eny = bd[0] / bl;
					const amp = eqBars[i] * eqMix;
					const half = amp * maxHalf;
					// Below about a third of a pixel it is just noise on the line.
					if (half < 0.35) continue;
					ctx.strokeStyle = inkA(0.1 + 0.26 * amp);
					ctx.beginPath();
					ctx.moveTo(bp[0] - enx * half, bp[1] - eny * half);
					ctx.lineTo(bp[0] + enx * half, bp[1] + eny * half);
					ctx.stroke();
				}
				ctx.restore();
			}

			// Endpoint marker
			const pEnd = bz(1, P0, P1, P2);
			ctx.beginPath();
			ctx.arc(pEnd[0], pEnd[1], 2, 0, Math.PI * 2);
			ctx.fillStyle = inkA(0.15);
			ctx.fill();

			const { towerW, towerH, towerGap, domeR } = getTowerDims(w);
			const P = pal();

			// The hemisphere the towers stand on. Its apex is exactly towerBaseY,
			// so the towers meet it instead of floating over it, and it is drawn
			// first so their bases cover the join.
			//
			// Orthographic, with the equator squashed by DOME_TILT — the one
			// number that decides how far above the dome we appear to be. A point
			// at polar angle f (0 at the apex) and longitude a projects to
			// (cx + R sin f cos a, cy - R cos f + tilt R sin f sin a), so sin a is
			// also the depth: +1 is the near rim, -1 the far one. Segments are
			// faded by it, which is what makes a flat web of lines read as a ball.
			const domeCX = towerBaseX;
			const domeCY = towerBaseY + domeR;
			const domePt = (f, a) => [
				domeCX + domeR * Math.sin(f) * Math.cos(a),
				domeCY - domeR * Math.cos(f) + DOME_TILT * domeR * Math.sin(f) * Math.sin(a),
			];
			// Depth 1 is the nearest point of the sphere, 0 the furthest.
			const depthAt = (f, a) => (Math.sin(f) * Math.sin(a) + 1) / 2;
			/**
			 * Walk a colour ramp and set an alpha, both from the same depth.
			 *
			 * The clamp is not defensive tidying. An alpha over 1 makes the whole
			 * rgba() string invalid, and an invalid strokeStyle is *ignored* — the
			 * previous colour stays set, silently. The light theme presses its
			 * lines harder than the dark one, went over 1, and drew the entire
			 * globe in whatever colour happened to be loaded: black.
			 */
			const shade = (far, near, d, a0, a1) =>
				`rgba(${Math.round(far[0] + (near[0] - far[0]) * d)},` +
				`${Math.round(far[1] + (near[1] - far[1]) * d)},` +
				`${Math.round(far[2] + (near[2] - far[2]) * d)},` +
				`${Math.min(1, a0 + a1 * d).toFixed(3)})`;

			// One turn per GLOBE_SPIN_MS, off the wall clock, so the loop is
			// seamless and does not drift with frame rate.
			const spin = ((nowMs % GLOBE_SPIN_MS) / GLOBE_SPIN_MS) * TWO_PI;

			/** Stroke a sampled curve one segment at a time, shaded by depth. */
			function domeCurve(sample, steps, far, near, a0, a1) {
				let prev = sample(0);
				for (let i = 1; i <= steps; i++) {
					const [pt, f, a] = sample(i / steps);
					ctx.strokeStyle = shade(far, near, depthAt(f, a), a0, a1);
					ctx.beginPath();
					ctx.moveTo(prev[0][0], prev[0][1]);
					ctx.lineTo(pt[0], pt[1]);
					ctx.stroke();
					prev = [pt, f, a];
				}
			}

			ctx.lineWidth = (w < 480 ? 0.6 : 0.8) * (1 + 0.5 * eqMix);

			// Tessellation scales with the radius. A fixed 36 segments was smooth
			// on a 150px ball and visibly polygonal once the globe spans the
			// viewport, so the step count follows domeR — one segment per ~8px of
			// radius keeps the flat-to-arc error under a pixel at any width.
			const latSteps = Math.max(36, Math.round(domeR / 8));
			const merSteps = Math.max(14, Math.round(latSteps / 4));

			// The light show. While the track plays the graticule stops being a
			// grid and becomes the instrument: the twelve meridians each take a
			// slice of the spectrum, and the latitudes ride the kick. eqMix gates
			// all of it, so a silent page draws exactly what it drew before.
			//
			// Mixing toward the hot colour rather than adding a second pass keeps this
			// to the same stroke count — the lines get hotter, nothing new is
			// drawn over them.
			const mix3 = (base, hot, u) => [
				base[0] + (hot[0] - base[0]) * u,
				base[1] + (hot[1] - base[1]) * u,
				base[2] + (hot[2] - base[2]) * u,
			];

			// The wireframe is a fixture too: the grid takes the colour the desk is
			// on, so the planet changes with the room rather than staying blue
			// while everything around it turns magenta.
			const rigHot = reduceMotion ? pal().beat : pal().rig[rigColour];

			// Latitudes, apex to equator. Circles of constant f, so the spin does
			// not move them — only the meridians and the coastlines turn. The
			// kick is what they ride, so they flare as one on the beat.
			const kick = eqMix * Math.max(level, bandHit[0]);
			const latNear = mix3(P.oceanNear, rigHot, Math.min(1, kick * 1.1));
			for (const deg of [15, 31, 47, 63, 79, 90]) {
				const f = deg * Math.PI / 180;
				domeCurve((u) => { const a = u * TWO_PI; return [domePt(f, a), f, a]; },
					latSteps, P.oceanFar, latNear, (0.12 + 0.10 * eqMix + 0.12 * kick) * P.lineBoost,
					(0.40 + 0.22 * eqMix + 0.34 * kick) * P.lineBoost);
			}
			// Meridians, apex to rim. Twelve half-arcs close the sphere's top —
			// and, with the track running, twelve bands of the spectrum. The
			// mapping is to the meridian index, not to a fixed screen position,
			// so the lit bands ride the planet as it turns.
			for (let k = 0; k < 12; k++) {
				const a = (k / 12) * TWO_PI + spin;
				// Each meridian takes its own slice of the spectrum, and a chase
				// runs around the twelve of them in time with the sweep — so the
				// grid has movement of its own even through a flat bar.
				const chase = 0.5 + 0.5 * Math.cos(rigPhase * 1.4 - (k / 12) * TWO_PI);
				const band = eqMix
					* eqBars[Math.min(EQ_BARS - 1, Math.round((k / 12) * (EQ_BARS - 1)))]
					* (reduceMotion ? 1 : 0.35 + 0.9 * chase);
				const near = mix3(P.oceanNear, rigHot, Math.min(1, band * 2.2));
				domeCurve((u) => { const f = u * (Math.PI / 2); return [domePt(f, a), f, a]; },
					merSteps, P.oceanFar, near, (0.12 + 0.10 * eqMix + 0.26 * band) * P.lineBoost,
					(0.40 + 0.22 * eqMix + 0.5 * band) * P.lineBoost);
			}

			// The limb: where the sphere turns away from us, which in this
			// projection is exactly the two meridians at a = 0 and a = PI. They
			// are drawn explicitly rather than left to the spinning grid, so the
			// globe keeps a lit edge no matter where the rotation has got to.
			// On the beat the limb is also the atmosphere lighting up: the one
			// edge that reads at a glance, so the kick lands there hardest.
			ctx.lineWidth = (w < 480 ? 0.8 : 1.1) * (1 + 1.6 * kick);
			{
				const atmo = mix3(P.atmo, rigHot, Math.min(1, kick * 1.3));
				ctx.strokeStyle = `rgba(${Math.round(atmo[0])},${Math.round(atmo[1])},` +
					`${Math.round(atmo[2])},${Math.min(1, (0.5 + 0.5 * kick) * P.lineBoost).toFixed(3)})`;
			}
			ctx.beginPath();
			for (const a of [0, Math.PI]) {
				for (let i = 0; i <= merSteps; i++) {
					const pt = domePt((i / merSteps) * (Math.PI / 2), a);
					if (i === 0) ctx.moveTo(pt[0], pt[1]); else ctx.lineTo(pt[0], pt[1]);
				}
			}
			ctx.stroke();

			// Coastlines, on the same sphere as the graticule. Latitude is the
			// polar angle measured from the pole, so f = 90 - lat, and longitude
			// is offset so GLOBE_LON0 faces the viewer at a = 90 degrees.
			//
			// They ride the same depth fade as the grid, so land on the far side
			// shows through faintly rather than being hidden — which is what sells
			// a wireframe globe as a globe rather than a printed disc.
			//
			// Each leg is walked in lat/lon and projected per step rather than
			// drawn as one screen-space line. On a small globe the difference was
			// sub-pixel; at viewport width a straight chord between two coarse
			// vertices visibly cuts through the ball instead of lying on it.
			ctx.lineWidth = w < 480 ? 0.8 : 1.1;
			const coastStep = Math.max(1, Math.round(domeR / 60));
			/** Polar angle and screen-space longitude for a lat/lon pair. */
			const coastFA = (lat, lon) => [
				(90 - lat) * Math.PI / 180,
				(lon - GLOBE_LON0) * Math.PI / 180 + Math.PI / 2 + spin,
			];
			for (const ring of COASTLINES) {
				for (let i = 0; i + 3 < ring.length; i += 2) {
					const lat0 = ring[i], lon0 = ring[i + 1];
					const lat1 = ring[i + 2], lon1 = ring[i + 3];
					// Below the equator there is no dome to draw on; skip the leg
					// rather than letting it cut a chord across the rim.
					if (lat0 < 0 || lat1 < 0) continue;
					let prev = domePt(...coastFA(lat0, lon0));
					for (let s = 1; s <= coastStep; s++) {
						const u = s / coastStep;
						const [f, a] = coastFA(lat0 + (lat1 - lat0) * u, lon0 + (lon1 - lon0) * u);
						const pt = domePt(f, a);
						ctx.strokeStyle = shade(P.landFar, P.landNear, depthAt(f, a),
							(0.18 + 0.16 * eqMix) * P.lineBoost, (0.55 + 0.3 * eqMix) * P.lineBoost);
						ctx.beginPath();
						ctx.moveTo(prev[0], prev[1]);
						ctx.lineTo(pt[0], pt[1]);
						ctx.stroke();
						prev = pt;
					}
				}
			}

			// The cloud layer. Drawn after the surface because it sits above it,
			// on a shell a little wider than the globe so it shows past the limb.
			//
			// Unlike the graticule, clouds on the far side are not drawn through:
			// a wireframe reads as a sphere *because* you see its back, and an
			// opaque cloud seen through the planet reads as a smudge. The depth
			// fade here is steep and cuts to nothing before the terminator.
			if (cloudMix > 0.004) {
				const sprite = getPuffSprite();
				const cloudR = domeR * CLOUD_ALT;
				const cloudSpin = spin * CLOUD_DRIFT;
				const puffR = domeR * 0.105;
				ctx.save();
				// Additive on black, so puffs that overlap build into a bank instead
				// of stacking into a flat grey disc. On the pastel sky they are
				// simply painted on, which is what a white cloud does to paper.
				ctx.globalCompositeOperation = P.blend;
				for (const cell of CLOUD_CELLS) {
					const cosLat = Math.max(0.25, Math.cos(cell.lat * Math.PI / 180));
					for (const puff of cell.puffs) {
						const lat = cell.lat + puff.dLat;
						if (lat < 0 || lat > 89) continue;
						const f = (90 - lat) * Math.PI / 180;
						const a = (cell.lon + puff.dLon / cosLat - GLOBE_LON0) * Math.PI / 180
							+ Math.PI / 2 + cloudSpin;
						// Steep near-side falloff: 0 at the terminator, 1 face on.
						const d = depthAt(f, a);
						if (d < 0.52) continue;
						const face = Math.min(1, (d - 0.52) / 0.30);
						// The beat lights the tops, the same way it lights the limb.
						const alpha = cloudMix * face * face * (0.15 + 0.18 * kick) * P.cloudAlpha;
						if (alpha < 0.004) continue;
						const x = domeCX + cloudR * Math.sin(f) * Math.cos(a);
						const y = domeCY - cloudR * Math.cos(f)
							+ DOME_TILT * cloudR * Math.sin(f) * Math.sin(a);
						// Foreshortened toward the limb, so a puff flattens as the
						// surface it sits on turns away.
						const rx = puffR * puff.r * (0.45 + 0.55 * face);
						const ry = rx * (0.55 + 0.45 * DOME_TILT);
						ctx.globalAlpha = alpha;
						ctx.drawImage(sprite, x - rx, y - ry, rx * 2, ry * 2);
					}
				}
				ctx.restore();
			}

			// The strobe, over the planet and its weather but under the towers and
			// the glyph, so the two white shapes stay readable through it. Gated
			// by the kick detector, which caps it under three a second, and held
			// to FLASH_PEAK — over a black hero that is already a hard flash.
			if (flash > 0.01 && !reduceMotion) {
				const c = pal().rig[rigColour];
				ctx.save();
				ctx.globalCompositeOperation = P.blend;
				ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${(flash * FLASH_PEAK * eqMix).toFixed(3)})`;
				ctx.fillRect(0, 0, w, h);
				ctx.restore();
			}

			// What stands on the apex. Two tall wireframe rectangles in the dark
			// theme; in the light one, the candy mountain they are the joke about.
			const tx1 = towerBaseX - towerGap / 2 - towerW;
			const tx2 = towerBaseX + towerGap / 2;

			if (isLight()) {
				drawCandyMountain(w, towerBaseX, towerBaseY, towerW, towerH, towerGap);
			} else {
				ctx.strokeStyle = inkA(0.25);
				ctx.lineWidth = w < 480 ? 0.7 : 1;
				// Left tower
				ctx.strokeRect(tx1, towerBaseY - towerH, towerW, towerH);
				// Right tower
				ctx.strokeRect(tx2, towerBaseY - towerH, towerW, towerH);
			}

			// 3D "21" orientation: aligns with path tangent
			const tan = bzd(t, P0, P1, P2);
			const tangentAngle = Math.atan2(tan[1], tan[0]);
			const bob = Math.sin(Date.now() * 0.0015) * 0.04;

			const tlen = Math.hypot(tan[0], tan[1]) || 1;
			// Left-hand normal to the tangent — "up and down" relative to the arc.
			const nx = -tan[1] / tlen;
			const ny = tan[0] / tlen;
			const danceOffset = Math.sin(dancePhase) * level * planeSize * DANCE_HEIGHT;
			// Only the number moves; the drawn arc stays put as the track it flies.
			const px = pAt[0] + nx * danceOffset;
			const py = pAt[1] + ny * danceOffset;

			// View angle: how we look at the number in its local frame
			// viewYaw rotates around model Y (up), turning model z into screen-width
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

			// Which creature is on the wing.
			const MODEL_V3 = isLight() ? UNICORN_V3 : V3;
			const MODEL_E3 = isLight() ? UNICORN_E3 : E3;

			// Project into a buffer held for the life of the model rather than a
			// fresh array of points every frame. The unicorn carries a dozen baked
			// stride frames, and building 12,000 little arrays sixty times a second
			// is a lot of garbage for a page that otherwise makes almost none.
			// Flat x,y pairs: vertex i is at [i * 2] and [i * 2 + 1].
			const projected = projectionBuffer(MODEL_V3);

			/** Project one run of vertices. Only what is about to be drawn. */
			function projectRange(from, to) {
				for (let i = from; i < to; i++) {
					const v = MODEL_V3[i];
					if (!v) continue;
					const mx = v[0], my = v[1], mz = v[2];
					// Yaw: rotate around Y axis
					const x1 = mx * cyaw + mz * syaw;
					const z1 = -mx * syaw + mz * cyaw;
					// Pitch: rotate around X axis. z2 is depth, and this is an
					// orthographic view, so it is never needed.
					const y2 = my * cpitch - z1 * spitch;
					// Rotate to align the model with the arc's tangent.
					const sx = x1 * cfa - -y2 * sfa;
					const sy = x1 * sfa + -y2 * cfa;
					projected[i * 2] = px + sx * planeSize;
					projected[i * 2 + 1] = py + sy * planeSize;
				}
			}

			// Wireframe edges. The digits are one ink; the unicorn is painted a
			// part at a time, back to front, each part's passes batched into a
			// single path so a few thousand segments cost a handful of strokes
			// rather than one stroke each.
			const lineBase = w < 480 ? 0.7 : 1;
			if (isLight()) {
				const stride = (((gallopPhase % 1) + 1) % 1) * GALLOP_FRAMES;
				const gallopFrame = Math.min(GALLOP_FRAMES - 1, Math.floor(stride));
				ctx.save();
				ctx.lineCap = 'round';
				ctx.lineJoin = 'round';
				for (const p of UNICORN_PARTS) {
					// Legs are baked one set per stride frame; everything else carries
					// no frame and is drawn every time. Skipping here is also what
					// keeps the eleven unused strides out of the projection.
					if (p.frame !== undefined && p.frame !== gallopFrame) continue;
					projectRange(p.vFrom, p.vTo);
					// A filled region: its indices are vertices, not edges, and it
					// goes down before the outline that shares its path.
					if (p.kind === 'fill') {
						ctx.fillStyle = p.colour;
						ctx.beginPath();
						ctx.moveTo(projected[p.from * 2], projected[p.from * 2 + 1]);
						for (let i = p.from + 1; i < p.to; i++) {
							ctx.lineTo(projected[i * 2], projected[i * 2 + 1]);
						}
						ctx.closePath();
						ctx.fill();
						continue;
					}
					for (const [color, width] of UNICORN_PAINT[p.tag]) {
						ctx.strokeStyle = color;
						ctx.lineWidth = lineBase * width;
						ctx.beginPath();
						for (let i = p.from; i < p.to; i++) {
							const e = MODEL_E3[i];
							const a = e[0] * 2, b = e[1] * 2;
							ctx.moveTo(projected[a], projected[a + 1]);
							ctx.lineTo(projected[b], projected[b + 1]);
						}
						ctx.stroke();
					}
				}
				ctx.restore();
			} else {
				projectRange(0, MODEL_V3.length);
				ctx.strokeStyle = inkA(0.65);
				ctx.lineWidth = lineBase;
				for (const [a, b] of MODEL_E3) {
					ctx.beginPath();
					ctx.moveTo(projected[a * 2], projected[a * 2 + 1]);
					ctx.lineTo(projected[b * 2], projected[b * 2 + 1]);
					ctx.stroke();
				}
			}

			// Glow at the model's position on the arc. The unicorn is drawn centred
			// on this same point and is big enough to cover it, so in the light
			// theme the dot only ever showed as a blemish in the middle of the
			// barrel — and a unicorn on the arc marks its own place well enough.
			if (!isLight()) {
				ctx.beginPath();
				ctx.arc(pAt[0], pAt[1], w < 480 ? 2 : 3, 0, Math.PI * 2);
				ctx.fillStyle = inkA(0.5);
				ctx.fill();
			}

			frame = requestAnimationFrame(draw);
		}

		draw();
		return () => { if (frame) cancelAnimationFrame(frame); };
	});

	// Which face of the page a link opens on, decided from the request URL so a
	// crawler — which runs no JavaScript and carries no stored theme — is handed
	// the card that matches what a person following the link will actually see.
	// Read from $page rather than window, because the decision has to survive
	// server rendering; by the time the browser has stripped the parameter the
	// <head> has already been written.
	const shareLight = $derived(unicornRequested($page.url.searchParams) === 'light');

	// Title leads with what this is rather than the slogan. "Build Your Empire"
	// alone told a search result nothing, and the slogan already owns the page.
	const siteTitle = 'Ammoura — Website and Online Store Builder';

	// The launch is a real dated event and the page counts down to it, so it is
	// worth describing to a crawler rather than leaving as decoration.
	const launchSchema = [
		{
			'@type': 'Organization',
			'@id': SITE_URL + '/#organization',
			name: SITE_NAME,
			url: SITE_URL + '/',
			description: PRODUCT_DESCRIPTION,
			logo: {
				'@type': 'ImageObject',
				url: SITE_URL + '/favicon.png'
			},
			sameAs: SOCIAL_LINKS.map((l) => l.href)
		},
		{
			'@type': 'SoftwareApplication',
			'@id': SITE_URL + '/#software',
			name: SITE_NAME,
			applicationCategory: 'BusinessApplication',
			operatingSystem: 'Web',
			description: PRODUCT_DESCRIPTION,
			url: SITE_URL + '/',
			image: SITE_URL + OG_IMAGE_PATH,
			featureList: CAPABILITIES,
			publisher: { '@id': SITE_URL + '/#organization' },
			datePublished: LAUNCH_ISO
		}
	];

	/** @type {{ form: import('./$types').ActionData; data: import('./$types').PageData }} */
	let { form, data } = $props();

	// ── Album track ──
	// BIRTH is track 1 of Ammoura.me, and its album route is "/" — this page.
	// ── Theme ──
	// Dark is the teaser. Light is the other side of the joke: a pastel sky, a
	// unicorn flying the arc the launch date flew, and a candy mountain standing
	// where the towers stood.
	//
	// It does NOT follow prefers-color-scheme. Swapping a launch teaser's hero
	// for a unicorn because someone's laptop is in light mode is a surprise
	// nobody asked for; this is a thing a visitor chooses, and the choice sticks.
	let theme = $state('dark');
	const isLight = () => theme === 'light';

	function applyTheme(next) {
		theme = next;
		if (typeof document !== 'undefined') {
			document.documentElement.dataset.theme = next;
			// The two bits of chrome outside the page: the browser UI tint, and
			// the hint that decides how form controls and scrollbars are drawn.
			// Left on "dark" they render dark widgets on a pastel page.
			const light = next === 'light';
			document.querySelector('meta[name="theme-color"]')
				?.setAttribute('content', light ? '#fff7fb' : '#000000');
			document.querySelector('meta[name="color-scheme"]')
				?.setAttribute('content', next);
		}
		try {
			localStorage.setItem('ammoura-theme', next);
		} catch {
			/* private window, or storage refused — the theme just will not stick */
		}
	}

	function toggleTheme() {
		applyTheme(isLight() ? 'dark' : 'light');
	}

	// ammoura.me/?unicorn=true — a link that lands on the light theme whatever
	// the visitor chose before, so the joke can be shown to someone rather than
	// only found. It wins over the stored choice once, then the parameter is
	// stripped from the URL: a reload, a bookmark or a shared copy of the link
	// goes back to being an ordinary visit, and the override stops overriding.
	//
	// The parameter's name and its parsing live in seo.js, because the <head>
	// reads it too — to pick which social card the link shows — and a link that
	// previews a unicorn then opens on the dark theme is worse than no override.

	/** 'light' | 'dark' from the URL, or null when the link says nothing. */
	function unicornFromUrl() {
		if (typeof window === 'undefined') return null;
		let url;
		try {
			url = new URL(window.location.href);
		} catch {
			return null;
		}
		const want = unicornRequested(url.searchParams);
		if (want === null) return null;
		url.searchParams.delete(UNICORN_PARAM);
		const rest = url.searchParams.toString();
		const clean = `${url.pathname}${rest ? `?${rest}` : ''}${url.hash}`;
		// Stripping the parameter is the nicety; landing on the unicorn is the
		// job. replaceState throws if the router is not up yet, and an
		// unhandled throw here would take the whole theme restore with it — so
		// the failure costs a parameter left in the address bar, nothing more.
		try {
			replaceState(clean, {});
		} catch {
			try {
				history.replaceState(history.state, '', clean);
			} catch {
				/* the URL keeps the parameter — the theme is still right */
			}
		}
		return want;
	}

	onMount(() => {
		let saved = null;
		try {
			saved = localStorage.getItem('ammoura-theme');
		} catch {
			/* nothing stored, or storage refused */
		}
		// The link beats the stored choice, and applyTheme stores it in turn —
		// so someone sent here on a unicorn keeps the unicorn until they switch.
		const fromLink = unicornFromUrl();
		if (fromLink) applyTheme(fromLink);
		else if (saved === 'light' || saved === 'dark') applyTheme(saved);
	});

	let audioEl = $state();
	let playing = $state(false);

	// ── Audio-reactive motion ──
	// A tap on the audio element so the number moves to what is actually playing.
	// Plain `let`, not $state: the draw loop reads these every frame and none of
	// it belongs in the reactive graph.
	// Dance feel — the four numbers worth turning.
	const DANCE_HEIGHT = 0.55; // swing, in multiples of the glyph size
	const DANCE_SPEED = 17; // radians per second of the swing
	const DANCE_ATTACK = 0.8; // how fast the swing grows on a hit (0..1 per frame)
	const DANCE_RELEASE = 0.28; // how fast it settles again

	// Equaliser feel. The trail the 9 leaves is a line; while the track plays it
	// becomes a spectrum. Deliberately small and faint — it should read as the
	// line breathing, not a visualiser bolted onto the page.
	const EQ_BARS = 56; // ticks along the arc
	// Tick half-length: a fraction of the smaller edge, then capped. Uncapped at
	// 0.03 it was ~30px a side on a tall window — a visualiser, not a line that
	// breathes. The cap keeps it the same restrained size on any display.
	const EQ_MAX = 0.014;
	const EQ_MAX_PX = 13;
	const EQ_ATTACK = 0.45; // per-frame rise toward a new magnitude
	const EQ_RELEASE = 0.13; // and the fall, slower so it settles rather than flickers
	const EQ_FADE_IN = 0.05; // how fast the whole effect appears on play
	const EQ_FADE_OUT = 0.03; // and clears on pause

	// ── Palettes ──
	// Every colour the canvas draws lives here, twice. The dark theme's values
	// are exactly what they have always been.
	//
	// `blend` is the part that is not a colour and matters most. Additive
	// compositing is how light behaves on black, and it is useless on a pale
	// sky: adding to near-white is white, so beams and clouds would vanish.
	// The light theme draws the same shapes over the top instead, which is
	// how paint behaves on paper.
	const PALETTES = {
		dark: {
			oceanFar: [34, 62, 132],
			oceanNear: [96, 184, 250],
			landFar: [44, 110, 76],
			landNear: [132, 226, 136],
			atmo: [128, 206, 255],
			ink: [255, 255, 255],
			cloud: [255, 255, 255],
			cloudAlpha: 1,
			blend: 'lighter',
			// How hard the wireframe is pressed. One on black, where a faint line
			// still glows; more on paper, where it does not.
			lineBoost: 1,
			// The gentler pulse the reduced-motion path falls back to.
			beat: [186, 244, 255],
			rig: [
				[255, 46, 124],  // magenta
				[64, 208, 255],  // cyan
				[255, 176, 48],  // amber
				[126, 255, 138], // green
				[158, 96, 255],  // violet
				[236, 248, 255], // white
			],
		},
		light: {
			// Candy: a raspberry sea, mint land, and a sherbet limb. Darker
			// than the dark theme's colours, because here they have to hold
			// against paper rather than glow against black.
			oceanFar: [216, 176, 230],
			oceanNear: [172, 74, 156],
			landFar: [158, 214, 186],
			landNear: [34, 158, 118],
			atmo: [236, 96, 168],
			ink: [58, 30, 66],
			cloud: [255, 255, 255],
			// Clouds on a pink sky are white and nearly opaque — the one place the
			// light theme is simpler than the dark one. Not fully opaque, though:
			// at 2.6 the banks piled up and bleached the lower half of the sky.
			cloudAlpha: 1.55,
			blend: 'source-over',
			lineBoost: 1.35,
			beat: [232, 92, 168],
			rig: [
				[255, 92, 164],  // bubblegum
				[124, 196, 255], // sky
				[255, 196, 64],  // lemon sherbet
				[108, 224, 168], // spearmint
				[178, 130, 255], // grape
				[255, 148, 196], // candy floss
			],
		},
	};
	const pal = () => PALETTES[isLight() ? 'light' : 'dark'];

	// ── The rig ──
	// Concert lighting, hung off the towers and pointed at everything. A single
	// smoothed loudness was enough to make the 21 bob; it is nowhere near enough
	// to run a light show, because a show is made of *events* — a kick lands, the
	// colour changes, the beams snap somewhere new. So the rig runs its own onset
	// detection, per band, and the fixtures are driven by hits rather than by a
	// level.
	//
	// Three bands, three detectors: a kick, a snare and a hat should not all move
	// the same fixture. Ranges are analyser bins, 128 of them over ~22kHz.
	const RIG_BANDS = [
		{ lo: 1, hi: 6 },   // kick and low bass
		{ lo: 6, hi: 26 },  // body, snare, the front of the mix
		{ lo: 26, hi: 78 }, // hats and air
	];
	// How far above its own rolling average a band has to jump to count as a hit,
	// and the minimum gap between hits. The low band is gated hardest: it drives
	// the colour changes and the flash, and nothing ruins a show like a strobe
	// with no rhythm. The gate is also the safety limit — 340ms is under three
	// flashes a second.
	const RIG_SENS = [1.32, 1.22, 1.16];
	const RIG_GATE = [340, 190, 110];
	// The desk's colours live in the palettes: saturated, few, and swapped on the
	// beat rather than cycled continuously through a hue wheel, which always reads
	// as a screensaver.
	const BEAM_COUNT = 13;
	// Peak alpha of the strobe wash. Deliberately low: over a black hero even a
	// gentle wash reads as a flash, and this sits behind the copy at a rate the
	// gate keeps under three a second.
	const FLASH_PEAK = 0.1;

	let audioCtx = null;
	let analyser = null;
	let freqData = null;
	let level = 0; // smoothed 0..1
	let eqMix = 0; // 0 silent, 1 playing — smoothed, so it fades rather than snaps
	let cloudMix = 0; // the same idea for the cloud layer, on a slower curve
	const eqBars = new Float32Array(EQ_BARS);
	let dancePhase = 0;

	// ── The gallop ──
	// Standing is the unicorn's resting state; the track is what sets it running.
	// `gallopMix` eases between the two so the stride spins up and winds down
	// rather than snapping into motion, and the phase always advances at whatever
	// rate the mix allows — which means stopping the track leaves the legs
	// wherever the last stride put them, the way a still of a running horse
	// looks, instead of jumping back to a pose.
	let gallopPhase = 0;
	let gallopMix = 0;
	// Strides per second. A hand gallop is a little over two; the louder it gets,
	// the harder it runs.
	const GALLOP_RATE = 2.1;
	const GALLOP_RATE_DRIVE = 1.2;
	const GALLOP_SPIN_UP = 0.045;
	const GALLOP_WIND_DOWN = 0.022;
	let lastFrameAt = 0;

	// Rig state. Energy now, energy on average, and a decaying impulse per band.
	const bandEnergy = [0, 0, 0];
	const bandAvg = [0, 0, 0];
	const bandHit = [0, 0, 0];
	const lastHitAt = [0, 0, 0];
	let rigPhase = 0;   // drives the sweep; runs faster when the track is busy
	let rigColour = 0;  // index into the palette's rig colours, advanced on the kick
	let rigSnap = 0;    // 0..1, how recently the beams were thrown somewhere new
	let flash = 0;      // strobe envelope
	// A show that flashes and sweeps is exactly what this setting is for. The
	// globe keeps its weather and its gentle pulse; the rig does not come on.
	let reduceMotion = false;

	// How much of the rig is hung, 0..1. A full truss over a full-width canvas is
	// a lot of additive drawing, and how much a machine can take is not something
	// this page can know in advance — a phone, a software rasteriser and a
	// desktop GPU are three different budgets. So it measures instead: frame time
	// is smoothed, and beams come down when frames run long and go back up when
	// they do not. The floor keeps a recognisable rig on the slowest device.
	let frameMs = 16;
	let rigQuality = 1;
	const RIG_Q_FLOOR = 0.35;
	function adaptRig(dt) {
		frameMs += (dt * 1000 - frameMs) * 0.05;
		if (frameMs > 21 && rigQuality > RIG_Q_FLOOR) rigQuality = Math.max(RIG_Q_FLOOR, rigQuality - 0.02);
		else if (frameMs < 15 && rigQuality < 1) rigQuality = Math.min(1, rigQuality + 0.004);
	}

	/**
	 * Run the lighting desk for one frame.
	 *
	 * Reads whatever readLevel() last pulled into freqData, so the rig costs no
	 * extra analyser call. Everything decays by dt rather than per frame, so the
	 * show runs at the same speed on a 60Hz and a 144Hz display.
	 */
	function updateRig(nowMs, dt, active) {
		const decay = (v, per) => v * Math.pow(per, dt);
		if (!active || !freqData || reduceMotion) {
			for (let b = 0; b < 3; b++) { bandHit[b] = decay(bandHit[b], 0.02); bandEnergy[b] *= 0.9; }
			flash = decay(flash, 0.0005);
			return;
		}
		for (let b = 0; b < 3; b++) {
			const { lo, hi } = RIG_BANDS[b];
			const top = Math.min(hi, freqData.length);
			let sum = 0;
			for (let i = lo; i < top; i++) sum += freqData[i];
			const e = top > lo ? sum / ((top - lo) * 255) : 0;
			bandEnergy[b] = e;
			// The threshold follows the mix. A fixed one fires every frame in a
			// loud passage and never fires in a quiet one; this fires on the
			// transient either way, which is what a beat is.
			bandAvg[b] += (e - bandAvg[b]) * 0.05;
			if (e > bandAvg[b] * RIG_SENS[b] + 0.03 && nowMs - lastHitAt[b] > RIG_GATE[b]) {
				lastHitAt[b] = nowMs;
				bandHit[b] = 1;
				if (b === 0) {
					// The kick runs the desk: new colour, new beam positions, and
					// the wash behind the planet.
					rigColour = (rigColour + 1 + (Math.random() * 2 | 0)) % pal().rig.length;
					rigSnap = 1;
					flash = Math.min(1, flash + 0.55 + 0.45 * e);
				}
			} else {
				bandHit[b] = decay(bandHit[b], 0.02);
			}
		}
		// The sweep speeds up with the front of the mix, so the beams idle through
		// a quiet bar and race through a loud one.
		rigPhase += dt * (0.9 + 4.2 * bandEnergy[1] + 2.2 * bandHit[1]);
		rigSnap = decay(rigSnap, 0.004);
		flash = decay(flash, 0.0006);
	}

	function initAudioGraph() {
		if (analyser || !audioEl) return;
		const AC = window.AudioContext || window.webkitAudioContext;
		if (!AC) return; // no Web Audio: the number rides the track without dancing

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
			// straight to the destination — a number that does not dance is a much
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

	/**
	 * Fold the analyser's bins down to EQ_BARS magnitudes.
	 *
	 * Reads whatever readLevel() last pulled, so the spectrum costs no extra
	 * getByteFrequencyData call. When nothing is playing the bars decay to zero
	 * instead of freezing mid-shape.
	 */
	function updateEqBars(active) {
		if (!active || !freqData) {
			for (let i = 0; i < EQ_BARS; i++) eqBars[i] *= 1 - EQ_RELEASE;
			return;
		}
		// Skip bin 0 (DC), and stop before the top of the range, which is empty
		// on this mix and would leave a third of the arc permanently flat.
		const lo = 1;
		const hi = Math.floor(freqData.length * 0.7);
		for (let i = 0; i < EQ_BARS; i++) {
			const f = i / (EQ_BARS - 1);
			// Weighted toward the low end, where the music actually is.
			const bin = Math.min(freqData.length - 1, Math.round(lo + Math.pow(f, 1.7) * (hi - lo)));
			const v = freqData[bin] / 255;
			// Squared: quiet bins stay quiet and the peaks still carry.
			const target = v * v;
			eqBars[i] += (target - eqBars[i]) * (target > eqBars[i] ? EQ_ATTACK : EQ_RELEASE);
		}
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

	// Paused mid-track. The arc goes back to the countdown either way — stopping
	// the music puts the creature back on its post — and getFlightProgress eases
	// the handover, so this only has to say the track is no longer playing.
	function onPause() {
		playing = false;
	}

	// Track finished: it has landed. Clearing trackStarted stops the audio
	// position being read at all, so the return flies from where it landed.
	function onEnded() {
		playing = false;
		trackStarted = false;
	}

	// Brand marks for the join buttons, keyed by provider id.
	// Marks for the social row, keyed the same way SOCIAL_LINKS is. Kept apart
	// from PROVIDER_ICON on purpose: those are sign-in buttons and only exist
	// when a provider is configured, while these are the accounts themselves and
	// should be there whatever the auth setup is doing.
	const SOCIAL_ICON = {
		x: '<svg viewBox="0 0 24 24" fill="currentColor" width="17" height="17" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
		youtube: '<svg viewBox="0 0 24 24" fill="currentColor" width="19" height="19" aria-hidden="true"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12z"/></svg>',
		discord: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true"><path d="M20.317 4.369a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .078-.01c3.927 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .079.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>',
		github: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true"><path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2 0-.4-.5-1.6.2-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.4 5.5 18.4 5.8 18.4 5.8c.7 1.6.2 2.8.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3z"/></svg>'
	};

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

<Seo
	title={siteTitle}
	description={SITE_DESCRIPTION}
	path="/"
	schema={launchSchema}
	image={shareLight ? OG_IMAGE_UNICORN_PATH : OG_IMAGE_PATH}
	imageAlt={shareLight ? OG_IMAGE_UNICORN_ALT : OG_IMAGE_ALT}
	ogUrl={shareLight ? `${SITE_URL}/?${UNICORN_PARAM}=true` : null}
/>

<!-- The theme switch. Small and quiet, but it sits in the top right where a
     site control is looked for — the light theme should be findable without
     being the first decision the page asks a visitor to make. -->
<button class="theme-toggle" type="button" onclick={toggleTheme}
	aria-pressed={theme === 'light'}
	title={theme === 'light' ? 'Back to the dark side' : 'Somewhere over the rainbow'}>
	<span aria-hidden="true">{theme === 'light' ? '\u{1F319}' : '\u{1F984}'}</span>
	<span class="theme-toggle-label">
		{theme === 'light' ? 'Switch to the dark theme' : 'Switch to the light theme'}
	</span>
</button>

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
				<!-- The punch is the joke, and the unicorn theme is the gentle side of
				     it: the dark page hands you the tools to crush a dream, the light
				     one hands you the same tools to realize it. Same sentence, same
				     shape, opposite temperature. -->
				<span class="punch">We give you the tools to
					<em>{theme === 'light' ? 'realize' : 'crush'}</em> them.</span>
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

			{@render socials()}
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
			{@render socials()}
		</section>
	{/if}
</main>

<!-- Where to find Ammoura. Two accounts, because two is what exists — an icon
     pointing at an account nobody is running is worse than no icon. The list
     lives in seo.js, which also feeds the JSON-LD `sameAs`, so the page and the
     structured data cannot disagree about where the brand is. -->
{#snippet socials()}
	<nav class="socials" aria-label="Ammoura elsewhere">
		<!-- Captioned, because the sign-in buttons directly above can include a
		     Discord one, and two Discord marks a few centimetres apart with no
		     label between them is a puzzle. "Join with Discord" and "Ammoura on
		     Discord" are different things and should look like it. -->
		<span class="socials-label">Find us</span>
		{#each SOCIAL_LINKS as link (link.id)}
			<a class="social" href={link.href} target="_blank" rel="noopener noreferrer"
				aria-label="Ammoura on {link.label}" title="Ammoura on {link.label}">
				{@html SOCIAL_ICON[link.id]}
			</a>
		{/each}
	</nav>
{/snippet}

<!-- Mirrors the legal links in the opposite corner. Outside <main> on purpose:
     it should survive the switch to the confirmation view, because who is
     building this is true either way. The brand is written "*Space", asterisk
     and all, so the label is uppercased and the name is left alone. -->
<a class="built-at" href="https://starspace.group" target="_blank" rel="noopener">
	<span class="built-dot" aria-hidden="true"></span>
	<span class="built-label built-label-full">Currently being built at</span>
	<span class="built-label built-label-short">Building at</span>
	<!-- The mark and the wordmark are one lockup, so they sit together at the
	     end. The image is the published *Space artifact copied verbatim — the
	     mark is a photograph of carved wood and the brand rules forbid redrawing
	     it, so this is never an SVG approximation. It carries no alt text: the
	     wordmark beside it already names the brand, and a second "*Space" would
	     just be read out twice. -->
	<img class="built-mark" src="/brand/starspace-mark.webp" alt="" width="16" height="16"
		loading="lazy" decoding="async" />
	<span class="built-brand">*Space</span>
</a>

<footer class="site-footer">
	<a href="/privacy">Privacy Policy</a>
	<span aria-hidden="true">&middot;</span>
	<a href="/terms">Terms of Service</a>
</footer>


<style>
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

	main {
		min-height: 100vh;
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
	}


	/* ── Theme switch ──
	   Top right, the corner a site control is looked for. It keeps the shape of
	   the "built at" pill so it reads as the same family of small chrome. The
	   safe-area insets matter here: on a notched phone in landscape the right
	   inset is real, and 1rem alone puts the button under the cutout. */
	.theme-toggle {
		position: fixed;
		right: calc(1rem + env(safe-area-inset-right, 0px));
		top: calc(1rem + env(safe-area-inset-top, 0px));
		z-index: 5;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 38px;
		height: 38px;
		/* The global button rule sets a wide padding and a 48px min-height for
		   the page's real buttons. Left undeclared here they beat the width and
		   height above — a class is more specific than the element, but only for
		   what the class actually says — and the circle came out a 98x48 pill.
		   Both are reset, not overridden, so the box is exactly 38 square. */
		padding: 0;
		min-height: 0;
		flex: 0 0 auto;
		font-size: 1rem;
		line-height: 1;
		border: 1px solid rgb(var(--ink-rgb) / 0.18);
		border-radius: 999px;
		background: rgb(var(--panel-rgb) / 0.55);
		color: var(--ink);
		cursor: pointer;
		opacity: 0.6;
		transition: opacity 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
	}

	/* The same global rule inverts a button to solid ink on hover, which turned
	   this one into a dark plum lozenge under the cursor. Small chrome should
	   brighten, not invert, so the two colours are restated here. */
	.theme-toggle:hover,
	.theme-toggle:focus-visible {
		opacity: 1;
		background: rgb(var(--panel-rgb) / 0.9);
		color: var(--ink);
		border-color: rgb(var(--ink-rgb) / 0.4);
		transform: translateY(-1px);
	}

	/* The label is for screen readers; the emoji carries it for everyone else. */
	.theme-toggle-label {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	/* The light theme's copy sits over a pale sky, so the glow that keeps it
	   readable has to become a light one rather than a dark one. The rule is the
	   same either way; only --halo-rgb changed. */
	@media (max-width: 560px) {
		.theme-toggle {
			right: calc(0.75rem + env(safe-area-inset-right, 0px));
			top: calc(0.75rem + env(safe-area-inset-top, 0px));
		}
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
		/* Was overflow:hidden, which is why the number came off the top of the page on
		   a phone: the hero centres its content, so anything taller than the
		   viewport overflows in *both* directions and the top half is cut and
		   unreachable. The canvas is absolutely positioned and sized to this box,
		   so it cannot paint outside it anyway — the clip was buying nothing and
		   costing the logo. Without it, content that does not fit scrolls, which
		   is a failure anyone can recover from. */
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

	/* The planet now passes behind the whole hero block, so the copy needs its
	   own ground rather than relying on the page being black — the same trick
	   the footer links already use, applied to everything the globe crosses. */
	.tagline,
	h1,
	.hint,
	.countdown {
		text-shadow:
			0 0 6px rgb(var(--halo-rgb) / 0.92),
			0 1px 3px rgb(var(--halo-rgb) / 0.8);
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
	   rgb(var(--ink-rgb) / 0.55) on black is 6.2:1 — AA at this size. */
	h1 .setup {
		color: rgb(var(--ink-rgb) / 0.55);
	}

	h1 .punch {
		color: var(--ink);
	}

	/* The one word the sentence is built around. Georgia's italic earns its
	   keep here; the glow is set on the base rule so it survives
	   prefers-reduced-motion, and `ignite` only animates up to it. */
	h1 .punch em {
		font-style: italic;
		text-shadow: 0 0 38px rgb(var(--ink-rgb) / 0.28);
	}

	/* Says what this actually is, quietly. 0.5 white on black is 5.3:1. */
	.hint {
		font-size: 0.85rem;
		line-height: 1.6;
		letter-spacing: 0.04em;
		color: rgb(var(--ink-rgb) / 0.5);
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
			text-shadow: 0 0 0 rgb(var(--ink-rgb) / 0);
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
		border: 1px solid var(--ink);
		color: var(--ink);
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
		background: var(--ink);
		color: var(--ground);
	}

	@media (hover: none) {
		button:active {
			background: var(--ink);
			color: var(--ground);
		}
		button:hover {
			background: none;
			color: var(--ink);
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

	/* ── Where to find us ──
	   A quiet row under the sign-up, in the same register as the legal links:
	   this is a footnote, not a call to action. The circles echo the theme
	   switch so the page's small chrome all reads as one family. */
	.socials {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		margin-top: 2.2rem;
	}

	/* The same quiet caption the "or" between sign-up routes uses. */
	.socials-label {
		margin-right: 0.35rem;
		font-size: 0.65rem;
		letter-spacing: 0.3em;
		text-transform: uppercase;
		opacity: 0.4;
	}

	.social {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		/* Matches the theme switch, so the page's small round chrome is one size. */
		width: 38px;
		height: 38px;
		border: 1px solid rgb(var(--ink-rgb) / 0.18);
		border-radius: 999px;
		color: var(--ink);
		opacity: 0.55;
		transition: opacity 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
	}

	.social:hover,
	.social:focus-visible {
		opacity: 1;
		border-color: rgb(var(--ink-rgb) / 0.4);
		transform: translateY(-1px);
	}

	@media (max-width: 560px) {
		.socials {
			margin-top: 1.6rem;
			gap: 0.75rem;
		}
		/* Up to a comfortable thumb on a phone. Quiet is a matter of contrast
		   here, not of being small enough to miss. */
		.social {
			width: 44px;
			height: 44px;
		}
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
		color: rgb(var(--ink-rgb) / 0.72);
		text-decoration: none;
		/* The arc and the number can pass behind this, so give the text its own
		   ground rather than relying on the page being black. */
		text-shadow: 0 1px 3px rgb(var(--halo-rgb) / 0.9);
	}
	.site-footer a:hover,
	.site-footer a:focus-visible {
		color: var(--ink);
	}
	.site-footer span {
		color: rgb(var(--ink-rgb) / 0.35);
	}

	/* ── "Currently being built at *Space" ── */

	/* Bottom-left, mirroring the legal links bottom-right. A pill rather than
	   bare text: the planet now turns behind this corner, and a grid line
	   crossing loose words is much harder to read than one crossing a panel. */
	.built-at {
		position: fixed;
		left: calc(1.25rem + env(safe-area-inset-left, 0px));
		bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
		z-index: 10;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.4rem 0.75rem;
		border: 1px solid rgb(var(--ink-rgb) / 0.14);
		border-radius: 999px;
		background: rgb(var(--panel-rgb) / 0.55);
		backdrop-filter: blur(6px);
		-webkit-backdrop-filter: blur(6px);
		font-size: 0.66rem;
		text-decoration: none;
		color: rgb(var(--ink-rgb) / 0.6);
		transition: color 0.2s, border-color 0.2s, background 0.2s;
	}
	.built-at:hover,
	.built-at:focus-visible {
		color: rgb(var(--ink-rgb) / 0.9);
		border-color: rgb(var(--ink-rgb) / 0.3);
		background: rgb(var(--panel-rgb) / 0.75);
	}

	/* Uppercase stops at the label: "*Space" is a name, not a shouted word. */
	.built-label {
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	/* Two labels, one shown at a time. `display: none` rather than a visual
	   hide, so a screen reader gets the one sentence and not both. */
	.built-label-short {
		display: none;
	}

	/* The mark and the wordmark are a pair: tighten the gap between just those
	   two so they read as one lockup rather than two more items in the row. */
	.built-mark {
		width: 16px;
		height: 16px;
		flex: none;
		margin-left: 0.1rem;
		margin-right: -0.15rem;
		object-fit: contain;
		/* The mark is warm wood on a dark pill. A touch of lift keeps it from
		   going muddy at 16px without altering the artwork itself. */
		filter: brightness(1.12) saturate(1.05);
	}

	.built-brand {
		letter-spacing: 0.04em;
		font-size: 0.78rem;
		color: rgb(var(--ink-rgb) / 0.92);
	}

	/* Still building. The colour is the globe's near-side green, so the one
	   spot of colour down here belongs to something already on the page. */
	.built-dot {
		width: 5px;
		height: 5px;
		flex: none;
		border-radius: 50%;
		background: rgb(var(--accent-rgb));
		box-shadow: 0 0 6px rgb(var(--accent-rgb) / 0.8);
		animation: built-pulse 2.4s ease-in-out infinite;
	}

	@keyframes built-pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.35; }
	}

	@media (prefers-reduced-motion: reduce) {
		.built-dot {
			animation: none;
		}
	}

	/* Narrow screens: the legal links stack into the opposite corner here, so
	   this one gets tight too. The sentence shortens rather than disappearing —
	   "*Space" on its own would name the builder but drop the news. */
	@media (max-width: 560px) {
		.built-at {
			left: calc(0.9rem + env(safe-area-inset-left, 0px));
			bottom: calc(0.7rem + env(safe-area-inset-bottom, 0px));
			padding: 0.35rem 0.6rem;
			gap: 0.4rem;
			font-size: 0.62rem;
		}
		.built-label-full {
			display: none;
		}
		.built-label-short {
			display: inline;
		}
	}

	/* ── Play button: track 1 of the album ── */
	.play-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		margin: 0 auto 2rem;
		padding: 0.7rem 1.4rem;
		border: 1px solid rgb(var(--ink-rgb) / 0.4);
		border-radius: 999px;
		min-height: 44px;
		font-size: 0.7rem;
	}
	.play-btn:hover,
	.play-btn:focus-visible {
		background: var(--ink);
		color: var(--ground);
		border-color: var(--ink);
	}
	.play-btn[aria-pressed='true'] {
		border-color: var(--ink);
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
		border-bottom: 1px solid rgb(var(--ink-rgb) / 0.4);
		color: var(--ink);
		font-family: inherit;
		font-size: 1rem;
		padding: 0.6rem 0;
		border-radius: 0;
	}
	.join-row input::placeholder {
		color: rgb(var(--ink-rgb) / 0.3);
	}
	.join-row input:focus {
		outline: none;
		border-bottom-color: var(--ink);
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
		border: 1px solid rgb(var(--ink-rgb) / 0.25);
		border-radius: 4px;
		color: var(--ink);
		text-decoration: none;
		font-size: 0.7rem;
		letter-spacing: 0.15em;
		text-transform: uppercase;
		transition: border-color 0.2s, background 0.2s;
		-webkit-tap-highlight-color: transparent;
	}
	.provider:hover,
	.provider:focus-visible {
		border-color: var(--ink);
		background: rgb(var(--ink-rgb) / 0.07);
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

	/* Phones. Georgia is wider than the serif we fall back to in development, so
	   the headline wraps to three lines here and the hint to two — trim the type
	   and the gaps so the block still clears the flight animation above it. */
	@media (max-width: 480px) {
		h1 {
			font-size: 1.2rem;
			line-height: 1.45;
		}
		.hint {
			font-size: 0.8rem;
			margin-bottom: 1.75rem;
		}
		.tagline {
			margin-bottom: 1.25rem;
		}
		.countdown {
			margin-bottom: 1.75rem;
		}
	}

	/* Short viewports, phone or windowed desktop. */
	@media (max-height: 720px) {
		.tagline {
			margin-bottom: 1rem;
		}
		.hint {
			margin-bottom: 1.5rem;
		}
		.countdown {
			margin-bottom: 1.5rem;
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
		color: var(--ink);
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
		color: var(--ink);
	}

	@media (hover: none) {
		.discord-btn:active {
			background: #5865f2;
			color: var(--ink);
		}
		.discord-btn:hover {
			background: none;
			color: var(--ink);
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

