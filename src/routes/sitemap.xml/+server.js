/** @type {import('./$types').RequestHandler} */
export function GET({ url }) {
	const origin = url.origin;
	const now = new Date().toISOString().split('T')[0];

	const pages = [
		{ loc: '/', priority: '1.0', changefreq: 'weekly' },
		{ loc: '/privacy', priority: '0.3', changefreq: 'yearly' },
		{ loc: '/terms', priority: '0.3', changefreq: 'yearly' }
	];

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
	.map(
		(p) => `  <url>
    <loc>${origin}${p.loc}</loc>
    <lastmod>${now}</lastmod>
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
