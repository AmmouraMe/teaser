<!--
	Every meta tag a page needs, emitted once and identically.

	Before this, only the home page had Open Graph and Twitter tags — sharing
	/privacy or /terms produced a bare link with no card at all. Routing all
	three through one component is what keeps them matching; there is no second
	place for the tags to drift.

	Usage:
	  <Seo title="Privacy Policy | Ammoura" description="..." path="/privacy" />
-->
<script>
	import {
		SITE_NAME,
		SITE_URL,
		SITE_DESCRIPTION,
		KEYWORDS,
		OG_IMAGE_PATH,
		OG_IMAGE_WIDTH,
		OG_IMAGE_HEIGHT,
		OG_IMAGE_ALT,
		OG_IMAGE_TYPE
	} from '$lib/seo.js';

	let {
		/** Full <title>, including the brand suffix. */
		title,
		/** Meta and card description. Defaults to the site description. */
		description = SITE_DESCRIPTION,
		/** Path this page canonicalises to, e.g. "/" or "/privacy". */
		path = '/',
		/** og:type — "website" for the home page, "article" reads wrong for legal text. */
		ogType = 'website',
		/** Extra JSON-LD nodes to merge into the @graph. */
		schema = []
	} = $props();

	// Canonical URLs are absolute and built from the production origin rather
	// than the request origin, so a preview deployment cannot advertise itself
	// as the canonical copy and split the ranking.
	const canonical = $derived(path === '/' ? SITE_URL + '/' : SITE_URL + path);
	const ogImageUrl = SITE_URL + OG_IMAGE_PATH;

	const graph = $derived([
		{
			'@type': 'WebSite',
			'@id': SITE_URL + '/#website',
			url: SITE_URL + '/',
			name: SITE_NAME,
			description: SITE_DESCRIPTION,
			inLanguage: 'en-US'
		},
		{
			'@type': 'WebPage',
			'@id': canonical + '#webpage',
			url: canonical,
			name: title,
			description,
			isPartOf: { '@id': SITE_URL + '/#website' },
			inLanguage: 'en-US',
			primaryImageOfPage: { '@id': SITE_URL + '/#ogimage' }
		},
		{
			'@type': 'ImageObject',
			'@id': SITE_URL + '/#ogimage',
			url: ogImageUrl,
			width: OG_IMAGE_WIDTH,
			height: OG_IMAGE_HEIGHT,
			caption: OG_IMAGE_ALT
		},
		...schema
	]);
</script>

<svelte:head>
	<!-- Primary -->
	<title>{title}</title>
	<meta name="description" content={description} />
	<meta name="keywords" content={KEYWORDS.join(', ')} />
	<meta name="author" content={SITE_NAME} />
	<meta name="robots" content="index, follow, max-image-preview:large" />
	<link rel="canonical" href={canonical} />

	<!-- Open Graph -->
	<meta property="og:type" content={ogType} />
	<meta property="og:url" content={canonical} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:image" content={ogImageUrl} />
	<meta property="og:image:secure_url" content={ogImageUrl} />
	<meta property="og:image:type" content={OG_IMAGE_TYPE} />
	<meta property="og:image:width" content={String(OG_IMAGE_WIDTH)} />
	<meta property="og:image:height" content={String(OG_IMAGE_HEIGHT)} />
	<meta property="og:image:alt" content={OG_IMAGE_ALT} />
	<meta property="og:site_name" content={SITE_NAME} />
	<meta property="og:locale" content="en_US" />

	<!-- Twitter / X. No site or creator handle: there is no Ammoura account yet,
	     and pointing at one that does not exist is worse than omitting it. -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:url" content={canonical} />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={ogImageUrl} />
	<meta name="twitter:image:alt" content={OG_IMAGE_ALT} />

	<!-- Structured data -->
	{@html `<script type="application/ld+json">${JSON.stringify({
		'@context': 'https://schema.org',
		'@graph': graph
	})
		.replace(/</g, '\\u003c')
		.replace(/>/g, '\\u003e')}</script>`}
</svelte:head>
