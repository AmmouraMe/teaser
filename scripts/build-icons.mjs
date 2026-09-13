#!/usr/bin/env node
/**
 * Regenerate the icon set and the web manifest.
 *
 *   node scripts/build-icons.mjs
 *
 * Two sources, on purpose:
 *
 *   ../design/logos/icon.svg  the brand mark, with generous padding. Right for
 *                             a 180px home-screen tile.
 *   static/favicon.svg        the same mark drawn tighter. At 16-32px the
 *                             padded version shrinks the A to a smudge.
 *
 * Neither is redrawn here. This only rasterises them and, for the installed-app
 * icons, flattens the result.
 *
 * Why flatten
 * -----------
 * Apple rejects an alpha channel in a touch icon — it composites unpredictably,
 * and the failure looks like a rendering bug rather than a bad file. The mark's
 * own base is a rounded rect of #1B0E20 on nothing, so flattening onto that same
 * colour both removes the alpha and squares the tile off, which is what iOS and
 * Android want: they apply their own mask and a pre-rounded icon gets rounded
 * twice. The tab favicon keeps its alpha, because there the rounded tile is the
 * whole point.
 *
 * Needs ImageMagick 7 (`magick`). Not part of `npm run build`: run it when the
 * mark changes and commit the output.
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname;
const STATIC = join(ROOT, 'static');

/** The mark's base colour — the rounded rect in both SVGs. */
const BRAND_BG = '#1B0E20';

const PADDED = join(ROOT, '../design/logos/icon.svg');
const TIGHT = join(STATIC, 'favicon.svg');

/**
 * Rasterise an SVG at `size`.
 *
 * `-background none` before reading keeps the source's transparency; the
 * flatten step then decides whether any of it survives. Rendering at 4x and
 * downsampling gives cleaner edges on the diagonal of the A than asking the SVG
 * renderer for the final size directly.
 */
function render(src, size, out, { flatten }) {
	const args = ['-background', 'none', '-density', '512', src, '-resize', `${size * 4}x${size * 4}`];
	if (flatten) args.push('-background', BRAND_BG, '-flatten', '-alpha', 'off');
	args.push('-resize', `${size}x${size}`, (flatten ? 'PNG24:' : 'PNG32:') + out);
	execFileSync('magick', args, { stdio: 'inherit' });
	return out;
}

// Installed-app icons: flattened, square, no alpha.
render(PADDED, 180, join(STATIC, 'apple-touch-icon.png'), { flatten: true });
render(PADDED, 192, join(STATIC, 'icon-192.png'), { flatten: true });
render(PADDED, 512, join(STATIC, 'icon-512.png'), { flatten: true });

// Tab favicon: the tight mark, alpha kept so the rounded tile reads as a tile.
render(TIGHT, 32, join(STATIC, 'favicon.png'), { flatten: false });

const manifest = {
	name: 'Ammoura',
	short_name: 'Ammoura',
	description: 'A website and online store builder for creators and small teams.',
	start_url: '/',
	scope: '/',
	display: 'standalone',
	// Matches the page, not the mark: this is the colour behind the splash
	// screen, and the site is black.
	background_color: '#000000',
	theme_color: '#000000',
	icons: [
		{ src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
		{ src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }
	]
};
const manifestPath = join(STATIC, 'site.webmanifest');
writeFileSync(manifestPath, JSON.stringify(manifest, null, '\t') + '\n');

// Verify rather than assume: an alpha channel here is the exact bug this script
// exists to prevent, so fail loudly if one survived.
for (const name of ['apple-touch-icon.png', 'icon-192.png', 'icon-512.png']) {
	const channels = execFileSync('magick', ['identify', '-format', '%[channels]', join(STATIC, name)])
		.toString()
		.trim();
	if (channels.includes('a')) {
		throw new Error(`build-icons: ${name} still has an alpha channel (${channels})`);
	}
}

console.log('build-icons: wrote apple-touch-icon, icon-192, icon-512, favicon.png, site.webmanifest');
