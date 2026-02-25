/** 
 * Dynamic OG image generator — returns a 1200×630 PNG-compatible SVG.
 * Social media crawlers that accept SVG will use this directly.
 * For full PNG support, replace /static/og.png with a rasterised version.
 * 
 * @type {import('./$types').RequestHandler} 
 */
export function GET() {
	const width = 1200;
	const height = 630;

	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#000"/>
  <text x="${width / 2}" y="240" text-anchor="middle" font-family="Georgia, serif" font-size="72" fill="#fff" letter-spacing="4">Build your empire</text>
  <text x="${width / 2}" y="340" text-anchor="middle" font-family="Georgia, serif" font-size="28" fill="rgba(255,255,255,0.6)" letter-spacing="2">We don't sell dreams. We give you the tools to crush them.</text>
  <text x="${width / 2}" y="520" text-anchor="middle" font-family="Georgia, serif" font-size="22" fill="rgba(255,255,255,0.3)" letter-spacing="8" text-transform="uppercase">AMMOURA</text>
</svg>`;

	return new Response(svg, {
		headers: {
			'Content-Type': 'image/svg+xml',
			'Cache-Control': 'public, max-age=86400'
		}
	});
}
