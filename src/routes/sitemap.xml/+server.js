import { SITE_URL } from '$lib/seo.js';

/** Both legal pages carry "Last updated 22 August 2026". */
const LEGAL_UPDATED = '2026-08-22';

/** @type {import('./$types').RequestHandler} */
export function GET() {
	// Absolute, from the production origin: a preview deployment must not list
	// its own hostname in a sitemap that crawlers may reach.
	const origin = SITE_URL;

	// Real dates. Stamping lastmod with today on every request tells crawlers
	// the whole site changes daily, which is both untrue and the kind of signal
	// that gets a sitemap discounted.
	const pages = [
		{ loc: '/', priority: '1.0', changefreq: 'daily', lastmod: '2026-08-26' },
		{ loc: '/privacy', priority: '0.3', changefreq: 'yearly', lastmod: LEGAL_UPDATED },
		{ loc: '/terms', priority: '0.3', changefreq: 'yearly', lastmod: LEGAL_UPDATED }
	];

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
	.map(
		(p) => `  <url>
    <loc>${origin}${p.loc}</loc>
    <lastmod>${p.lastmod}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`
	)
	.join('\n')}
</urlset>`;

	return new Response(xml, {
		headers: {
			'Content-Type': 'application/xml',
			'Cache-Control': 'max-age=3600'
		}
	});
}
