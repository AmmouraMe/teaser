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
 * evaluates them against a tiny recording shim that captures line segments
 * instead of painting them, and emits those segments as SVG. Change the hero
 * and re-run this; the card follows. The wording and the launch date come from
 * `src/lib/seo.js`, which is already the single source of truth for both.
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
const domeConstSrc = slice(page, 'const OCEAN_FAR', '// Tower and dome dimensions');
const domeDrawSrc = slice(
	page,
	'const domeCX = towerBaseX;',
	'// Two tall wireframe rectangles standing on the apex.'
);

// Composition. The planet sits low and centre, cut by the bottom edge the way
// it is cut by the fold on the page; the glyph comes in high from the left.
// The text block sits in the upper half and the planet fills the lower one, so
// the towers top out below the last line of copy rather than growing through
// it. The planet is cut by the bottom edge the way the page's is cut by the
// fold — a whole sphere floating in the middle reads as a clip-art globe.
const CX = W * 0.5;
const DOME_R = 230;
const APEX_Y = 392;
const TOWER = { towerW: 20, towerH: 92, towerGap: 16 };
const GLYPH_AT = [210, 120];
const GLYPH_SIZE = 52;

const harness = `
// The glyph block comes first because it is the one that declares TWO_PI, which
// the globe block then uses. DOME_TILT is declared above the slice point in the
// page, so it is the one constant restated here.
${glyphSrc}

const DOME_TILT = 0.32;
${domeConstSrc}

const segs = [];
let cur = [0, 0], style = '#fff', lw = 1;
const ctx = {
  set strokeStyle(v) { style = v; }, get strokeStyle() { return style; },
  set lineWidth(v) { lw = v; }, get lineWidth() { return lw; },
  beginPath() {}, moveTo(x, y) { cur = [x, y]; },
  lineTo(x, y) { segs.push([cur[0], cur[1], x, y, style, lw]); cur = [x, y]; },
  stroke() {},
  strokeRect(x, y, w2, h2) {
    segs.push([x, y, x + w2, y, style, lw], [x + w2, y, x + w2, y + h2, style, lw],
              [x + w2, y + h2, x, y + h2, style, lw], [x, y + h2, x, y, style, lw]);
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

module.exports = { segs, glyph, edges: E3 };
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

// The planet and towers.
for (const [x1, y1, x2, y2, st, lwv] of recorded.segs) {
	const m = /rgba\((\d+),(\d+),(\d+),([\d.]+)\)/.exec(st);
	const col = m ? `rgb(${m[1]},${m[2]},${m[3]})` : '#fff';
	const op = m ? m[4] : '0.25';
	parts.push(
		`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(
			1
		)}" stroke="${col}" stroke-opacity="${op}" stroke-width="${(lwv * 1.6).toFixed(2)}"/>`
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
