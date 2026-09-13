#!/usr/bin/env node
/**
 * Regenerate the social card, `static/og.png`.
 *
 *   node scripts/build-og.mjs
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
const OUT = join(ROOT, 'static/og.png');

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

const harness = `
// The glyph block comes first because it is the one that declares TWO_PI, which
// the globe block then uses. DOME_TILT is declared above the slice point in the
// page, so it is the one constant restated here.
${glyphSrc}

// The card is the dark theme. The light one is a thing a visitor switches on;
// a share card is what the link looks like before anybody has switched anything.
const theme = 'dark';
const isLight = () => false;
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

// The lighting desk, held at one moment. Cyan keeps the card in the page's own
// cool register while still showing that the grid takes the rig's colour.
const reduceMotion = false;
const rigColour = 1;
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

// The towers, drawn as the hero draws them.
const tx1 = towerBaseX - towerGap / 2 - towerW;
const tx2 = towerBaseX + towerGap / 2;
ctx.strokeStyle = 'rgba(255,255,255,0.25)';
ctx.lineWidth = 1.6;
ctx.strokeRect(tx1, towerBaseY - towerH, towerW, towerH);
ctx.strokeRect(tx2, towerBaseY - towerH, towerW, towerH);

// Project the glyph flat — the card is a still, so there is no arc tangent to
// align to; only the hero's own view angles are kept.
const viewYaw = 1.35, viewPitch = 0.2;
const cyaw = Math.cos(viewYaw), syaw = Math.sin(viewYaw);
const cpitch = Math.cos(viewPitch), spitch = Math.sin(viewPitch);
const glyph = V3.map(([mx, my, mz]) => {
  const x1 = mx * cyaw + mz * syaw;
  const z1 = -mx * syaw + mz * cyaw;
  const y2 = my * cpitch - z1 * spitch;
  return [${GLYPH_AT[0]} + x1 * ${GLYPH_SIZE}, ${GLYPH_AT[1]} - y2 * ${GLYPH_SIZE}];
});

module.exports = { ops, glyph, edges: E3, rigs: RIGS, colours: pal().rig, rigColour };
`;

const scratch = mkdtempSync(join(tmpdir(), 'ammoura-og-'));
let recorded;
try {
	const modPath = join(scratch, 'render.cjs');
	writeFileSync(modPath, harness);
	recorded = require(modPath);
} finally {
	rmSync(scratch, { recursive: true, force: true });
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const parts = [];

parts.push(
	`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`
);
parts.push(`<rect width="${W}" height="${H}" fill="#000"/>`);

// The flight path: the same quadratic the hero flies, ending at the foot of the
// towers, with the glyph sitting on it.
const P0 = [30, 70];
const P1 = [330, 30];
const P2 = [CX + TOWER.towerGap / 2 + TOWER.towerW, APEX_Y];
const bez = (t) => [
	(1 - t) ** 2 * P0[0] + 2 * (1 - t) * t * P1[0] + t * t * P2[0],
	(1 - t) ** 2 * P0[1] + 2 * (1 - t) * t * P1[1] + t * t * P2[1]
];
const path = Array.from({ length: 81 }, (_, i) => bez(i / 80));
parts.push(
	`<polyline fill="none" stroke="#fff" stroke-opacity="0.28" stroke-width="1.4" points="${path
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
	let gid = 0;
	for (const rig of rigs) {
		const ox = rig.at === 'towers' ? CX : rig.at === 'left' ? W * 0.06 : W * 0.94;
		const oy = rig.at === 'towers' ? towerTopY : H * 1.04;
		if (rig.wash) {
			const c = colours[ci];
			parts.push(
				`<defs><radialGradient id="haze"><stop offset="0" stop-color="rgb(${c})"` +
					` stop-opacity="0.22"/><stop offset="0.5" stop-color="rgb(${c})"` +
					` stop-opacity="0.075"/><stop offset="1" stop-color="rgb(${c})"` +
					` stop-opacity="0"/></radialGradient></defs>` +
					`<circle cx="${ox}" cy="${oy}" r="${(rigLen * 0.55).toFixed(0)}" fill="url(#haze)"/>`
			);
		}
		rig.beams.forEach((b, i) => {
			const c = colours[i % 2 ? (ci + 2) % colours.length : ci];
			// The still's sweep: the same expression the page evaluates, at the
			// rigPhase the harness was pinned to.
			const ang = b.base + Math.sin(2.1 * b.speed + b.phase) * b.swing;
			const drive = 0.3 + 0.7 * 0.5;
			const a = drive * 0.22;
			const half = rigLen * b.width * (0.55 + 0.8 * drive);
			const dx = Math.cos(ang);
			const dy = Math.sin(ang);
			const tx = ox + dx * rigLen;
			const ty = oy + dy * rigLen;
			const id = `bm${gid++}`;
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
					` fill="url(#${id})" opacity="${a.toFixed(3)}" style="mix-blend-mode:screen"/>` +
					`<line x1="${ox.toFixed(1)}" y1="${oy.toFixed(1)}" x2="${tx.toFixed(1)}" y2="${ty.toFixed(1)}"` +
					` stroke="url(#${id})" stroke-width="2.4" opacity="${Math.min(0.95, a * 2.8).toFixed(3)}"` +
					` style="mix-blend-mode:screen"/>`
			);
		});
	}
}

// The planet, its weather and the towers, in the order the hero drew them.
// The puff gradient restates the sprite the page stamps; `screen` stands in for
// the canvas's additive blend, so overlapping puffs still build into a bank
// rather than flattening into one grey disc.
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
			)}" fill="url(#puff)" opacity="${a.toFixed(3)}" style="mix-blend-mode:screen"/>`
		);
		continue;
	}
	const [, x1, y1, x2, y2, st, lwv] = op;
	const m = /rgba\((\d+),(\d+),(\d+),([\d.]+)\)/.exec(st);
	const col = m ? `rgb(${m[1]},${m[2]},${m[3]})` : '#fff';
	const opacity = m ? m[4] : '0.25';
	parts.push(
		`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(
			1
		)}" stroke="${col}" stroke-opacity="${opacity}" stroke-width="${(lwv * 1.6).toFixed(2)}"/>`
	);
}

// The glyph.
for (const [a, b] of recorded.edges) {
	const p = recorded.glyph[a];
	const q = recorded.glyph[b];
	if (!p || !q) continue;
	parts.push(
		`<line x1="${p[0].toFixed(1)}" y1="${p[1].toFixed(1)}" x2="${q[0].toFixed(1)}" y2="${q[1].toFixed(
			1
		)}" stroke="#fff" stroke-opacity="0.8" stroke-width="1.5"/>`
	);
}

// Wording. Georgia is the page's face but is not installable on Linux, so the
// stack falls through to whatever metrically similar serif the box has.
const SERIF = "Georgia, 'Liberation Serif', 'DejaVu Serif', serif";
const SANS = "'DejaVu Sans', 'Liberation Sans', sans-serif";
const shadow = 'style="paint-order:stroke" stroke="#000" stroke-width="6" stroke-opacity="0.85"';

parts.push(
	`<text x="${CX}" y="150" text-anchor="middle" font-family="${SANS}" font-size="19"` +
		` letter-spacing="7" fill="#fff" fill-opacity="0.5" ${shadow}>AMMOURA</text>`
);
parts.push(
	`<text x="${CX}" y="226" text-anchor="middle" font-family="${SERIF}" font-size="72"` +
		` fill="#fff" ${shadow}>Build Your Empire</text>`
);
parts.push(
	`<text x="${CX}" y="274" text-anchor="middle" font-family="${SERIF}" font-size="25"` +
		` font-style="italic" fill="#fff" fill-opacity="0.66" ${shadow}>` +
		`We don&#39;t sell dreams. We give you the tools to crush them.</text>`
);
parts.push(
	`<text x="${CX}" y="520" text-anchor="middle" font-family="${SANS}" font-size="23"` +
		` letter-spacing="9" fill="#fff" fill-opacity="0.92" ${shadow}>${esc(launchLabel)}</text>`
);
parts.push(
	`<text x="${CX}" y="575" text-anchor="middle" font-family="${SANS}" font-size="15"` +
		` letter-spacing="4" fill="#fff" fill-opacity="0.58" ${shadow}>A WEBSITE, A STOREFRONT,` +
		` AND EVERYTHING BEHIND THEM</text>`
);

parts.push('</svg>');

const svgPath = join(ROOT, '.og-card.svg');
writeFileSync(svgPath, parts.join('\n'));
try {
	execFileSync('magick', ['-density', '144', svgPath, '-resize', `${W}x${H}!`, 'PNG24:' + OUT], {
		stdio: 'inherit'
	});
} finally {
	rmSync(svgPath, { force: true });
}

console.log(`build-og: wrote ${OUT} (${W}x${H}) for ${launchLabel}`);
