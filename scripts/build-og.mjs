#!/usr/bin/env node
/**
 * Regenerate the social cards, `static/og.png` and `static/og-unicorn.png`.
 *
 *   node scripts/build-og.mjs
 *
 * Two cards, because the page has two faces. The dark one is what a bare link
 * to ammoura.me looks like. The light one is what `?unicorn=true` looks like —
 * the same planet and the same words, under a pastel sky, with the unicorn on
 * the wing and a candy mountain where the towers stand. Both are built from the
 * hero's own code, so neither can drift away from the page it portrays.
 *
 * Why this is a script and not a drawing
 * --------------------------------------
 * The card shows the same planet, towers and flying date-glyph the hero draws.
 * A hand-made copy of that artwork drifts the moment the page changes — and it
 * drifts silently, because nothing renders the card and the page side by side.
 *
 * So this does not redraw anything. It lifts the real geometry out of
 * `src/routes/+page.svelte` — the glyph builder and the globe block, verbatim —
 * evaluates them against a tiny recording shim that captures draw calls instead
 * of painting them, and emits what it recorded as SVG. Change the hero and
 * re-run this; the card follows. The wording and the launch date come from
 * `src/lib/seo.js`, which is already the single source of truth for both.
 *
 * The card is the page with the track playing — clouds on the globe and the
 * wireframe lit — because that is the better portrait of it. The shim feeds the
 * hero's own light-show code a fixed spectrum to get one still frame of it.
 *
 * The candy mountain is the one thing the globe's shim cannot record: it fills,
 * clips and curves, where the globe only ever strokes lines. So it gets a
 * second, path-recording shim of its own and is emitted as SVG paths. Same
 * bargain as the lighting rig — geometry from the hero, painting by the card.
 *
 * Needs ImageMagick 7 (`magick`) for the SVG to PNG step. Deliberately NOT part
 * of `bun run build` / `npm run build`: run it when the hero or the date
 * changes, and commit what it produces.
 */

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

// The harness is generated CommonJS so it can be loaded synchronously from a
// throwaway file; ESM has no synchronous import.
const require = createRequire(import.meta.url);

const ROOT = new URL('..', import.meta.url).pathname;
const PAGE = join(ROOT, 'src/routes/+page.svelte');
const SEO = join(ROOT, 'src/lib/seo.js');
// One entry per face of the page. `param` is the query string that serves this
// card, and is what the page's <head> switches on.
const VARIANTS = [
	{ theme: 'dark', out: join(ROOT, 'static/og.png'), verb: 'crush' },
	{ theme: 'light', out: join(ROOT, 'static/og-unicorn.png'), verb: 'realize' },
];

const W = 1200;
const H = 630;

/** Pull the text between two markers out of the page, markers included. */
function slice(src, startMarker, endMarker) {
	const a = src.indexOf(startMarker);
	const b = src.indexOf(endMarker);
	if (a === -1) throw new Error(`build-og: marker not found in +page.svelte: ${startMarker}`);
	if (b === -1) throw new Error(`build-og: marker not found in +page.svelte: ${endMarker}`);
	if (b < a) throw new Error(`build-og: markers out of order: ${startMarker}`);
	return src.slice(a, b);
}

const page = readFileSync(PAGE, 'utf8');
const seo = readFileSync(SEO, 'utf8');

// The launch date, read from the one place that declares it.
const isoMatch = seo.match(/LAUNCH_ISO = '([^']+)'/);
if (!isoMatch) throw new Error('build-og: LAUNCH_ISO not found in src/lib/seo.js');
const launch = new Date(isoMatch[1]);
// Format in the launch's own zone, not the machine's, so a build on any box
// prints the date the countdown actually ends on.
const launchLabel = new Intl.DateTimeFormat('en-GB', {
	day: 'numeric',
	month: 'long',
	year: 'numeric',
	timeZone: 'America/Phoenix'
})
	.format(launch)
	.toUpperCase();

// The three pieces of the hero's drawing code, taken verbatim.
const glyphSrc = slice(page, '// 3D wireframe "21"', '// 3D math helpers');
// The globe's own constants. Starts at the tilt because the palettes moved out
// to component scope when the light theme arrived — they come in separately,
// below, since the rig needs them too.
const domeConstSrc = slice(page, 'const DOME_TILT = 0.32;', '// Tower and dome dimensions');
const domeDrawSrc = slice(
	page,
	'const domeCX = towerBaseX;',
	'// What stands on the apex.'
);
// The lighting rig's fixtures — where each beam idles, how wide its cone is.
// Only the geometry is lifted; the card paints its own beams as SVG, the same
// way it paints the planet's recorded strokes.
const rigSrc = slice(page, '// A fixture: where it idles', '// Gradients are built once per colour');
// The desk's own constants — how many beams are hung, and how hard.
const rigConstSrc = slice(page, '// ── The rig ──', '\tlet audioCtx = null;');
// Both palettes, and the picker between them.
const palSrc = slice(page, '// ── Palettes ──', '\t// ── The rig ──');
// The light theme's apex. Self-contained apart from `ctx` and TWO_PI, which is
// what lets it run against a shim of its own.
const mountainSrc = slice(page, 'function drawCandyMountain(', '\t\tfunction getArcPoints(');

// Composition, following the hero: the towers stand near the top, the planet
// hangs from them across the whole frame, and the words read over it the way a
// title card sits over a photograph. The glyph comes in high from the left.
const CX = W * 0.5;
// The hero's planet now spans the viewport, so the card's spans the card: the
// radius puts the equator exactly on the bottom edge and the body fills the
// frame behind the words. A small globe floating in the lower half was a fair
// portrait of the old hero and is a misleading one of this hero.
const APEX_Y = 120;
const DOME_R = H - APEX_Y;
const TOWER = { towerW: 20, towerH: 92, towerGap: 16 };
const GLYPH_AT = [156, 64];
const GLYPH_SIZE = 42;

// Where the creature flies. The unicorn is a bigger model than the numerals it
// replaces, so it gets its own placement rather than borrowing the glyph's.
// Just under the flight path rather than centred on it: at this size a unicorn
// centred where the glyph sits would have its horn off the top edge.
const UNI_AT = [225, 84];
const UNI_SIZE = 44;
// The live page draws its paint widths at planeSize ~43. Holding the ratio
// keeps the card's unicorn the same drawing as the page's; the extra half is for
// the feed, which shows this at a third of its size and on someone else's
// background.
const UNI_STROKE = (UNI_SIZE / 43) * 1.5;
// The legs are baked one set per stride frame and the card is a still, so it
// picks one. This is the moment mid-suspension with the forelegs reaching —
// the pose that reads as "running" rather than "standing" in a single frame.
const UNI_STRIDE_FRAME = 7;

/** The light theme's sky, the same four stops the page puts on <body>. */
const SKY = [
	['0', '#ffeef7'],
	['0.38', '#f6ecff'],
	['0.68', '#eef6ff'],
	['1', '#ecfbf3'],
];

function buildCard({ theme, out, verb }) {
	const isLightTheme = theme === 'light';
	const harness = `
// The glyph block comes first because it is the one that declares TWO_PI, which
// the globe block then uses. DOME_TILT is declared above the slice point in the
// page, so it is the one constant restated here. It also carries the unicorn,
// which the light card flies in place of the date.
${glyphSrc}

// Which face of the page this card is a portrait of.
const theme = '${theme}';
const isLight = () => ${isLightTheme};
${palSrc}
const P = pal();

// getPuffSprite() builds its sprite on a canvas. Nothing here paints, so the
// sprite is never read — it only has to exist for drawImage to be handed
// something.
const document = {
  createElement: () => ({
    getContext: () => ({
      createRadialGradient: () => ({ addColorStop() {} }),
      fillRect() {},
      set fillStyle(_v) {}
    })
  })
};

${domeConstSrc}

// The card is the page with the track running: weather on the globe and the
// wireframe lit. These are the four values the hero's draw loop feeds that
// code, pinned to one representative frame — a loud one, low end forward.
const EQ_BARS = 56;
const eqBars = new Float32Array(EQ_BARS);
for (let i = 0; i < EQ_BARS; i++) {
  const f = i / (EQ_BARS - 1);
  eqBars[i] = Math.max(0, (1 - f) ** 1.5 * (0.62 + 0.38 * Math.sin(i * 1.9 + 0.7)));
}
const eqMix = 1;
const cloudMix = 1;
const level = 0.42;

${rigConstSrc}

// The lighting desk, held at one moment. Cyan keeps the dark card in the page's
// own cool register while still showing that the grid takes the rig's colour.
// The light card takes bubblegum instead: the sky it washes over is pink, and a
// cyan rig turned the whole portrait cold.
const reduceMotion = false;
const rigColour = ${isLightTheme ? 0 : 1};
const rigPhase = 2.1;
const rigSnap = 0;
const bandEnergy = [0.55, 0.48, 0.3];
const bandHit = [0.8, 0.35, 0.2];
// No strobe on a still: a frozen flash is just a washed-out card.
const flash = 0;

${rigSrc}

// Draw ops in the order the hero issues them, so the clouds land between the
// surface and the towers on the card exactly as they do on the page.
const ops = [];
let cur = [0, 0], style = '#fff', lw = 1, alpha = 1;
const stack = [];
const line = (x1, y1, x2, y2) => ops.push(['line', x1, y1, x2, y2, style, lw]);
const ctx = {
  set strokeStyle(v) { style = v; }, get strokeStyle() { return style; },
  set lineWidth(v) { lw = v; }, get lineWidth() { return lw; },
  set globalAlpha(v) { alpha = v; }, get globalAlpha() { return alpha; },
  set globalCompositeOperation(_v) {}, get globalCompositeOperation() { return 'source-over'; },
  save() { stack.push([style, lw, alpha]); },
  restore() { const s = stack.pop(); if (s) { style = s[0]; lw = s[1]; alpha = s[2]; } },
  beginPath() {}, moveTo(x, y) { cur = [x, y]; },
  lineTo(x, y) { line(cur[0], cur[1], x, y); cur = [x, y]; },
  stroke() {},
  drawImage(_img, x, y, w2, h2) { ops.push(['puff', x + w2 / 2, y + h2 / 2, w2 / 2, h2 / 2, alpha]); },
  strokeRect(x, y, w2, h2) {
    line(x, y, x + w2, y); line(x + w2, y, x + w2, y + h2);
    line(x + w2, y + h2, x, y + h2); line(x, y + h2, x, y);
  }
};

// The hero decides its own sizes from viewport width; the card decides its own.
const w = ${W};
const towerBaseX = ${CX}, towerBaseY = ${APEX_Y};
const towerW = ${TOWER.towerW}, towerH = ${TOWER.towerH}, towerGap = ${TOWER.towerGap};
const domeR = ${DOME_R};
// A still frame: pick the rotation that puts the Atlantic face to camera.
const nowMs = GLOBE_SPIN_MS * 0.5;

${domeDrawSrc}

// The towers, drawn as the hero draws them. The light card stands a candy
// mountain here instead, which is recorded separately — see the mountain shim.
const tx1 = towerBaseX - towerGap / 2 - towerW;
const tx2 = towerBaseX + towerGap / 2;
if (!isLight()) {
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1.6;
  ctx.strokeRect(tx1, towerBaseY - towerH, towerW, towerH);
  ctx.strokeRect(tx2, towerBaseY - towerH, towerW, towerH);
}

// Project flat — the card is a still, so there is no arc tangent to align to;
// only the hero's own view angles are kept.
const viewYaw = 1.35, viewPitch = 0.2;
const cyaw = Math.cos(viewYaw), syaw = Math.sin(viewYaw);
const cpitch = Math.cos(viewPitch), spitch = Math.sin(viewPitch);
const project = (V, atX, atY, size) => V.map(([mx, my, mz]) => {
  const x1 = mx * cyaw + mz * syaw;
  const z1 = -mx * syaw + mz * cyaw;
  const y2 = my * cpitch - z1 * spitch;
  return [atX + x1 * size, atY - y2 * size];
});
const glyph = project(V3, ${GLYPH_AT[0]}, ${GLYPH_AT[1]}, ${GLYPH_SIZE});
const unicorn = project(UNICORN_V3, ${UNI_AT[0]}, ${UNI_AT[1]}, ${UNI_SIZE});

module.exports = {
  ops, glyph, edges: E3,
  unicorn, uniEdges: UNICORN_E3, uniParts: UNICORN_PARTS, uniPaint: UNICORN_PAINT,
  rigs: RIGS, colours: pal().rig, rigColour
};
`;

	// The candy mountain fills, clips and curves, none of which the globe's
	// line-recorder can see. It is self-contained apart from `ctx` and TWO_PI, so
	// it runs on its own against a shim that records whole paths instead.
	const mountainHarness = `
const TWO_PI = Math.PI * 2;
${mountainSrc}

const ops = [];
let path = [], sub = null, clip = null;
let fillStyle = '#000', strokeStyle = '#000', lineWidth = 1;
const stack = [];
const copy = (p) => p.map((s) => s.slice());
const pt = (x, y) => { if (!sub) { sub = []; path.push(sub); } sub.push([x, y]); };
const ctx = {
  set fillStyle(v) { fillStyle = v; }, get fillStyle() { return fillStyle; },
  set strokeStyle(v) { strokeStyle = v; }, get strokeStyle() { return strokeStyle; },
  set lineWidth(v) { lineWidth = v; }, get lineWidth() { return lineWidth; },
  set lineCap(_v) {}, set lineJoin(_v) {},
  save() { stack.push([fillStyle, strokeStyle, lineWidth, clip]); },
  restore() { const s = stack.pop(); if (s) { fillStyle = s[0]; strokeStyle = s[1]; lineWidth = s[2]; clip = s[3]; } },
  beginPath() { path = []; sub = null; },
  moveTo(x, y) { sub = [[x, y]]; path.push(sub); },
  lineTo(x, y) { pt(x, y); },
  closePath() { if (sub && sub.length) sub.push([sub[0][0], sub[0][1]]); },
  quadraticCurveTo(cx, cy, x, y) {
    if (!sub || !sub.length) { pt(x, y); return; }
    const [x0, y0] = sub[sub.length - 1];
    // Flattened: the card is raster in the end, and 14 segments is under a
    // pixel of error at this size.
    for (let i = 1; i <= 14; i++) {
      const t = i / 14, m = 1 - t;
      pt(m * m * x0 + 2 * m * t * cx + t * t * x, m * m * y0 + 2 * m * t * cy + t * t * y);
    }
  },
  arc(cx, cy, r, a0, a1) {
    sub = null;
    for (let i = 0; i <= 36; i++) {
      const a = a0 + ((a1 - a0) * i) / 36;
      pt(cx + r * Math.cos(a), cy + r * Math.sin(a));
    }
  },
  clip() { clip = copy(path); },
  fill() { ops.push(['fill', copy(path), fillStyle, clip && copy(clip)]); },
  stroke() { ops.push(['stroke', copy(path), strokeStyle, lineWidth, clip && copy(clip)]); }
};

drawCandyMountain(${W}, ${CX}, ${APEX_Y}, ${TOWER.towerW}, ${TOWER.towerH}, ${TOWER.towerGap});
module.exports = { ops };
`;

	const scratch = mkdtempSync(join(tmpdir(), 'ammoura-og-'));
	let recorded, mountain = { ops: [] };
	try {
		const modPath = join(scratch, 'render.cjs');
		writeFileSync(modPath, harness);
		recorded = require(modPath);
		if (isLightTheme) {
			const mPath = join(scratch, 'mountain.cjs');
			writeFileSync(mPath, mountainHarness);
			mountain = require(mPath);
		}
	} finally {
		rmSync(scratch, { recursive: true, force: true });
	}

	const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	const parts = [];
	let uid = 0;

	// The two palettes the wording and the drawn lines are read against. On black
	// a white line glows; on a pastel sky it has to be ink, with a light halo
	// instead of a dark one.
	const INK = isLightTheme ? '#3a1e42' : '#ffffff';
	const HALO = isLightTheme ? '#fff7fb' : '#000000';
	const shadow = `style="paint-order:stroke" stroke="${HALO}" stroke-width="6" stroke-opacity="${
		isLightTheme ? '0.9' : '0.85'
	}"`;

	parts.push(
		`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`
	);
	if (isLightTheme) {
		parts.push(
			`<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">` +
				SKY.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('') +
				`</linearGradient></defs><rect width="${W}" height="${H}" fill="url(#sky)"/>`
		);
	} else {
		parts.push(`<rect width="${W}" height="${H}" fill="#000"/>`);
	}

	// The flight path: the same quadratic the hero flies, ending at the foot of
	// the towers, with the creature sitting on it.
	const P0 = [30, 70];
	const P1 = [330, 30];
	const P2 = [CX + TOWER.towerGap / 2 + TOWER.towerW, APEX_Y];
	const bez = (t) => [
		(1 - t) ** 2 * P0[0] + 2 * (1 - t) * t * P1[0] + t * t * P2[0],
		(1 - t) ** 2 * P0[1] + 2 * (1 - t) * t * P1[1] + t * t * P2[1]
	];
	const path = Array.from({ length: 81 }, (_, i) => bez(i / 80));
	parts.push(
		`<polyline fill="none" stroke="${INK}" stroke-opacity="${
			isLightTheme ? '0.3' : '0.28'
		}" stroke-width="1.4" points="${path
			.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
			.join(' ')}"/>`
	);

	// The rig. The hero paints its beams onto canvas under a transform, which the
	// recording shim has no way to capture, so the card paints its own — from the
	// page's own fixture list, at the same angles the page would be at for this
	// rigPhase. Geometry from the hero, painting by the card, which is the same
	// deal the planet's strokes get.
	//
	// Drawn before the planet, as on the page.
	{
		const rigLen = Math.hypot(W, H) * 1.15;
		const { rigs, colours, rigColour: ci } = recorded;
		const towerTopY = APEX_Y - TOWER.towerH;
		for (const rig of rigs) {
			const ox = rig.at === 'towers' ? CX : rig.at === 'left' ? W * 0.06 : W * 0.94;
			const oy = rig.at === 'towers' ? towerTopY : H * 1.04;
			if (rig.wash) {
				const c = colours[ci];
				const hid = `haze${uid++}`;
				parts.push(
					`<defs><radialGradient id="${hid}"><stop offset="0" stop-color="rgb(${c})"` +
						` stop-opacity="0.22"/><stop offset="0.5" stop-color="rgb(${c})"` +
						` stop-opacity="0.075"/><stop offset="1" stop-color="rgb(${c})"` +
						` stop-opacity="0"/></radialGradient></defs>` +
						`<circle cx="${ox}" cy="${oy}" r="${(rigLen * 0.55).toFixed(0)}" fill="url(#${hid})"/>`
				);
			}
			rig.beams.forEach((b, i) => {
				const c = colours[i % 2 ? (ci + 2) % colours.length : ci];
				// The still's sweep: the same expression the page evaluates, at the
				// rigPhase the harness was pinned to.
				const ang = b.base + Math.sin(2.1 * b.speed + b.phase) * b.swing;
				const drive = 0.3 + 0.7 * 0.5;
				// Half strength on the light card. The same alpha that reads as a beam
				// against black reads as a smear against a pastel sky.
				const a = drive * (isLightTheme ? 0.1 : 0.22);
				const half = rigLen * b.width * (0.55 + 0.8 * drive);
				const dx = Math.cos(ang);
				const dy = Math.sin(ang);
				const tx = ox + dx * rigLen;
				const ty = oy + dy * rigLen;
				const id = `bm${uid++}`;
				// Screen lifts toward white, which on a pastel sky bleaches rather
				// than glows; multiply is the same gesture the right way up.
				const blend = isLightTheme ? 'multiply' : 'screen';
				parts.push(
					`<defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse"` +
						` x1="${ox.toFixed(1)}" y1="${oy.toFixed(1)}" x2="${tx.toFixed(1)}" y2="${ty.toFixed(1)}">` +
						`<stop offset="0" stop-color="rgb(${c})" stop-opacity="1"/>` +
						`<stop offset="0.35" stop-color="rgb(${c})" stop-opacity="0.42"/>` +
						`<stop offset="1" stop-color="rgb(${c})" stop-opacity="0"/>` +
						`</linearGradient></defs>` +
						`<polygon points="${ox.toFixed(1)},${oy.toFixed(1)} ` +
						`${(tx - dy * half).toFixed(1)},${(ty + dx * half).toFixed(1)} ` +
						`${(tx + dy * half).toFixed(1)},${(ty - dx * half).toFixed(1)}"` +
						` fill="url(#${id})" opacity="${a.toFixed(3)}" style="mix-blend-mode:${blend}"/>` +
						`<line x1="${ox.toFixed(1)}" y1="${oy.toFixed(1)}" x2="${tx.toFixed(1)}" y2="${ty.toFixed(1)}"` +
						` stroke="url(#${id})" stroke-width="2.4" opacity="${Math.min(0.95, a * 2.8).toFixed(3)}"` +
						` style="mix-blend-mode:${blend}"/>`
				);
			});
		}
	}

	// The planet, its weather and the towers, in the order the hero drew them.
	// The puff gradient restates the sprite the page stamps; `screen` stands in
	// for the canvas's additive blend, so overlapping puffs still build into a
	// bank rather than flattening into one grey disc. The light theme draws its
	// clouds plainly over a pale sky, which is the one place it is simpler.
	parts.push(
		'<defs><radialGradient id="puff">' +
			'<stop offset="0" stop-color="#fff" stop-opacity="0.62"/>' +
			'<stop offset="0.30" stop-color="#f0f8ff" stop-opacity="0.30"/>' +
			'<stop offset="0.62" stop-color="#d6eaff" stop-opacity="0.09"/>' +
			'<stop offset="1" stop-color="#c8e2ff" stop-opacity="0"/>' +
			'</radialGradient></defs>'
	);
	for (const op of recorded.ops) {
		if (op[0] === 'puff') {
			const [, cx, cy, rx, ry, a] = op;
			parts.push(
				`<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(
					1
				)}" fill="url(#puff)" opacity="${Math.min(1, a).toFixed(3)}"${
					isLightTheme ? '' : ' style="mix-blend-mode:screen"'
				}/>`
			);
			continue;
		}
		const [, x1, y1, x2, y2, st, lwv] = op;
		const m = /rgba\((\d+),(\d+),(\d+),([\d.]+)\)/.exec(st);
		const col = m ? `rgb(${m[1]},${m[2]},${m[3]})` : INK;
		const opacity = m ? m[4] : '0.25';
		parts.push(
			`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(
				1
			)}" stroke="${col}" stroke-opacity="${opacity}" stroke-width="${(lwv * 1.6).toFixed(2)}"/>`
		);
	}

	// The candy mountain, from its own recorder.
	{
		const d = (p) =>
			p
				.map((sp) => sp.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(''))
				.join(' ');
		const paint = (c) => {
			const m = /rgba\((\d+),(\d+),(\d+),([\d.]+)\)/.exec(c);
			return m ? [`rgb(${m[1]},${m[2]},${m[3]})`, m[4]] : [c, '1'];
		};
		for (const op of mountain.ops) {
			let clipAttr = '';
			const clipPath = op[0] === 'fill' ? op[3] : op[4];
			if (clipPath) {
				const cid = `cm${uid++}`;
				parts.push(`<defs><clipPath id="${cid}"><path d="${d(clipPath)}"/></clipPath></defs>`);
				clipAttr = ` clip-path="url(#${cid})"`;
			}
			if (op[0] === 'fill') {
				const [col, o] = paint(op[2]);
				parts.push(`<path d="${d(op[1])}" fill="${col}" fill-opacity="${o}"${clipAttr}/>`);
			} else {
				const [col, o] = paint(op[2]);
				parts.push(
					`<path d="${d(op[1])}" fill="none" stroke="${col}" stroke-opacity="${o}"` +
						` stroke-width="${op[3].toFixed(2)}" stroke-linecap="butt"${clipAttr}/>`
				);
			}
		}
	}

	// The creature on the wing. The dark card flies the date as one ink; the
	// light card flies the unicorn, painted a part at a time in the page's own
	// passes so it arrives pink and white rather than as a pink outline.
	if (isLightTheme) {
		const { unicorn, uniEdges, uniParts, uniPaint } = recorded;
		const rgba = (c) => {
			const m = /rgba?\((\d+),(\d+),(\d+)(?:,([\d.]+))?\)/.exec(c);
			return m ? [`rgb(${m[1]},${m[2]},${m[3]})`, m[4] === undefined ? '1' : m[4]] : [c, '1'];
		};
		for (const part of uniParts) {
			// One stride frame only: the rest belong to other moments of the gallop.
			if (part.frame !== undefined && part.frame !== UNI_STRIDE_FRAME) continue;
			// A filled region indexes vertices rather than edges, and lays the solid
			// down before the outline that shares its path.
			if (part.kind === 'fill') {
				const pts = [];
				for (let i = part.from; i < part.to; i++) {
					const v = unicorn[i];
					if (v) pts.push(`${v[0].toFixed(1)},${v[1].toFixed(1)}`);
				}
				if (!pts.length) continue;
				const [col, o] = rgba(part.colour);
				parts.push(`<polygon points="${pts.join(' ')}" fill="${col}" fill-opacity="${o}"/>`);
				continue;
			}
			const { tag, from, to } = part;
			for (const [colour, width] of uniPaint[tag]) {
				const segs = [];
				for (let i = from; i < to; i++) {
					const p = unicorn[uniEdges[i][0]];
					const q = unicorn[uniEdges[i][1]];
					if (!p || !q) continue;
					segs.push(
						`M${p[0].toFixed(1)},${p[1].toFixed(1)}L${q[0].toFixed(1)},${q[1].toFixed(1)}`
					);
				}
				if (!segs.length) continue;
				const [col, o] = rgba(colour);
				parts.push(
					`<path d="${segs.join('')}" fill="none" stroke="${col}" stroke-opacity="${o}"` +
						` stroke-width="${(width * UNI_STROKE).toFixed(2)}" stroke-linecap="round"` +
						` stroke-linejoin="round"/>`
				);
			}
		}
	} else {
		for (const [a, b] of recorded.edges) {
			const p = recorded.glyph[a];
			const q = recorded.glyph[b];
			if (!p || !q) continue;
			parts.push(
				`<line x1="${p[0].toFixed(1)}" y1="${p[1].toFixed(1)}" x2="${q[0].toFixed(
					1
				)}" y2="${q[1].toFixed(1)}" stroke="#fff" stroke-opacity="0.8" stroke-width="1.5"/>`
			);
		}
	}

	// Wording. Georgia is the page's face but is not installable on Linux, so the
	// stack falls through to whatever metrically similar serif the box has.
	const SERIF = "Georgia, 'Liberation Serif', 'DejaVu Serif', serif";
	const SANS = "'DejaVu Sans', 'Liberation Sans', sans-serif";

	parts.push(
		`<text x="${CX}" y="150" text-anchor="middle" font-family="${SANS}" font-size="19"` +
			` letter-spacing="7" fill="${INK}" fill-opacity="0.5" ${shadow}>AMMOURA</text>`
	);
	parts.push(
		`<text x="${CX}" y="226" text-anchor="middle" font-family="${SERIF}" font-size="72"` +
			` fill="${INK}" ${shadow}>Build Your Empire</text>`
	);
	parts.push(
		`<text x="${CX}" y="274" text-anchor="middle" font-family="${SERIF}" font-size="25"` +
			` font-style="italic" fill="${INK}" fill-opacity="0.66" ${shadow}>` +
			`We don&#39;t sell dreams. We give you the tools to ${verb} them.</text>`
	);
	parts.push(
		`<text x="${CX}" y="520" text-anchor="middle" font-family="${SANS}" font-size="23"` +
			` letter-spacing="9" fill="${INK}" fill-opacity="0.92" ${shadow}>${esc(launchLabel)}</text>`
	);
	parts.push(
		`<text x="${CX}" y="575" text-anchor="middle" font-family="${SANS}" font-size="15"` +
			` letter-spacing="4" fill="${INK}" fill-opacity="0.58" ${shadow}>A WEBSITE, A STOREFRONT,` +
			` AND EVERYTHING BEHIND THEM</text>`
	);

	parts.push('</svg>');

	const svgPath = join(ROOT, `.og-card-${theme}.svg`);
	writeFileSync(svgPath, parts.join('\n'));
	try {
		execFileSync('magick', ['-density', '144', svgPath, '-resize', `${W}x${H}!`, 'PNG24:' + out], {
			stdio: 'inherit'
		});
	} finally {
		rmSync(svgPath, { force: true });
	}

	console.log(`build-og: wrote ${out} (${W}x${H}) for ${launchLabel}`);
}

for (const variant of VARIANTS) buildCard(variant);
