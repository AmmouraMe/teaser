/**
 * One source of truth for everything a crawler or a social card reads.
 *
 * The page, the privacy page and the terms page all pull from here, so a
 * shared link renders the same card whichever one someone pastes. Editing a
 * string here changes it in the <head>, the Open Graph card, the Twitter card
 * and the JSON-LD at once.
 */

export const SITE_NAME = 'Ammoura';
export const SITE_URL = 'https://ammoura.me';

/** Public launch: 11 September 2026, 20:07 EST. Same moment the page counts down to. */
export const LAUNCH_ISO = '2026-09-11T20:07:00-05:00';

export const DISCORD_URL = 'https://discord.gg/dPRvKFS9dq';

/**
 * The default description.
 *
 * Front-loaded with what the product is, because search engines cut around
 * 155–160 characters and social cards cut sooner. The brand voice lives on the
 * page itself; this is the line that has to survive being read out of context
 * by someone deciding whether to click.
 */
export const SITE_DESCRIPTION =
	'A website and online store builder for creators and small teams. Storefronts, custom domains, print-on-demand, digital downloads. Join the early-access waitlist.';

/** Short description for the launch, used in JSON-LD. */
export const PRODUCT_DESCRIPTION =
	'Ammoura is a multi-tenant website and e-commerce platform. Build a site, open a storefront on your own domain, and sell physical products, print-on-demand merchandise and digital downloads from one place.';

/**
 * What the page is actually about.
 *
 * `<meta name="keywords">` is ignored by every major search engine — Google
 * dropped it in 2009 — so this list earns its place by also driving the
 * visible capability row in the hero, which is content a crawler does weigh.
 */
export const KEYWORDS = [
	'website builder',
	'online store builder',
	'ecommerce platform',
	'storefront',
	'sell online',
	'custom domains',
	'print on demand',
	'digital downloads',
	'creator commerce',
	'small business website'
];

/** The visible capability row. Kept short — it is a hero element, not a footer dump. */
export const CAPABILITIES = [
	'Online store',
	'Website builder',
	'Custom domains',
	'Print on demand',
	'Digital downloads'
];

/**
 * The social card image.
 *
 * A real 1200×630 PNG in /static. It has to be a raster format: no major
 * crawler — Facebook, X, LinkedIn, Discord, Slack — will render an SVG as an
 * OG image.
 */
export const OG_IMAGE_PATH = '/og.png';
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
export const OG_IMAGE_ALT = 'Ammoura — build your empire';
export const OG_IMAGE_TYPE = 'image/png';
