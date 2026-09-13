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

/**
 * Public launch: 21 November 2026, 19:00 MST — doors at State Farm Stadium in
 * Glendale, Arizona. The moment the page counts down to and the date a crawler
 * is told the software was published, so it is declared once here and imported
 * everywhere else.
 *
 * The offset is -07:00 and stays -07:00: Arizona does not observe daylight
 * time, so unlike the Eastern dates this sat on before, the wall clock and the
 * offset cannot drift apart whatever month the date moves to.
 */
export const LAUNCH_ISO = '2026-11-21T19:00:00-07:00';

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
 * Emitted as `<meta name="keywords">`, which is ignored by every major search
 * engine — Google dropped it in 2009. It costs nothing and a few smaller
 * engines still parse it, but nothing here should be expected to move a
 * ranking. The terms that count are the ones in SITE_DESCRIPTION, the page
 * title, and the JSON-LD below.
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

/**
 * What Ammoura does, as a plain list.
 *
 * These were briefly a visible row in the hero; it crowded the legal links and
 * came out again. They still describe the product to a crawler through
 * `featureList` on the SoftwareApplication node.
 */
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
/**
 * Launch day as words, in the launch's own timezone.
 *
 * Arizona rather than the reader's zone: the card and the alt text should name
 * the date the countdown actually ends on, which is fixed, not the date it is
 * where the reader happens to be sitting. Derived rather than written out so it
 * cannot drift from LAUNCH_ISO the way a second copy would.
 */
export const LAUNCH_LABEL = new Intl.DateTimeFormat('en-GB', {
	day: 'numeric',
	month: 'long',
	year: 'numeric',
	timeZone: 'America/Phoenix'
}).format(new Date(LAUNCH_ISO));

export const OG_IMAGE_ALT = `Ammoura — Build Your Empire. Launching ${LAUNCH_LABEL}.`;
export const OG_IMAGE_TYPE = 'image/png';
