<script>
	/** @type {{ data: import('./$types').PageData }} */
	let { data } = $props();

	const t = $derived(data.traffic);
	const codes = $derived(data.codes);
	const maxCode = $derived(Math.max(1, ...codes.codes.map((c) => c.visits)));
	const fmt = new Intl.NumberFormat('en-US');
	/** @param {number} n */
	const n = (n) => fmt.format(n);

	const h = $derived(t.human);
	const maxHumanDay = $derived(Math.max(1, ...(h?.days ?? []).map((d) => d.visitors)));
	const maxHumanCountry = $derived(Math.max(1, ...(h?.countries ?? []).map((c) => c.visitors)));
	const maxHumanPath = $derived(Math.max(1, ...(h?.topPaths ?? []).map((p) => p.views)));
	const maxVisitors = $derived(Math.max(1, ...t.days.map((d) => d.visitors)));
	const maxCountry = $derived(Math.max(1, ...t.countries.map((c) => c.requests)));
	const maxPath = $derived(Math.max(1, ...(t.topPaths ?? []).map((p) => p.views)));

	/** @param {string} iso */
	function shortDate(iso) {
		const d = new Date(iso + 'T00:00:00Z');
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
	}

	function handleLogout() {
		localStorage.removeItem('admin_session');
		window.location.href = '/auth/logout';
	}
</script>

<svelte:head>
	<title>Admin — Traffic</title>
</svelte:head>

<main>
	<header>
		<h1>Traffic</h1>
		<div class="meta">
			<span class="user">Logged in as <strong>{data.user.username}</strong></span>
			<button onclick={handleLogout} class="logout">Logout</button>
		</div>
	</header>

	<nav class="tab-bar" aria-label="Admin sections">
		<a class="tab" href="/admin">Waitlist</a>
		<a class="tab active" href="/admin/traffic" aria-current="page">Traffic</a>
	</nav>

	{#if codes.configured}
		<h2 class="section">Campaign codes (?t=)</h2>
		{#if codes.error}
			<section class="panel problem" role="alert">
				<p>{codes.error}</p>
			</section>
		{:else}
			<section class="panel">
				<p class="note">
					Visits through a <code>?t=</code> link, such as a printed QR code. A visit is a page load in a
					browser that is not a known bot. A visitor is one address on one day, so a person
					who comes back on another day counts again. Counting began when this went live; earlier visits
					are not in it.
				</p>
				{#if codes.codes.length === 0}
					<p class="empty">No visits through a code yet.</p>
				{:else}
					<ul class="rows">
						{#each codes.codes as c (c.code)}
							<li title="First {shortDate(c.first)}, last {shortDate(c.last)}">
								<span class="row-name mono">{c.code}</span>
								<span class="row-bar"><span class="good" style="width: {(c.visits / maxCode) * 100}%"></span></span>
								<span class="row-num">{n(c.visits)} / {n(c.visitors)}</span>
							</li>
						{/each}
					</ul>
					<p class="note">Visits / visitors. Hover a row for the first and last dates.</p>
				{/if}
			</section>
		{/if}
	{/if}

	{#if !t.configured}
		<section class="panel setup">
			<h2>Connect Cloudflare analytics</h2>
			<p>
				ammoura.me runs behind Cloudflare, which already counts every visit. This page reads
				those counts. It needs two settings, which are not set yet:
			</p>
			<ol>
				<li>
					<code>CF_API_TOKEN</code>: a Cloudflare API token with <em>Analytics: Read</em> on the
					ammoura.me zone (dashboard, My Profile, API Tokens).
				</li>
				<li>
					<code>CF_ZONE_ID</code>: the zone id, on the zone's Overview page, right-hand side.
				</li>
			</ol>
			<p>
				Add both as secrets on the Pages project (Settings, Variables and Secrets), then reload.
				For local work, put them in <code>.dev.vars</code>.
			</p>
		</section>
	{:else if t.error}
		<section class="panel problem" role="alert">
			<h2>Could not read the numbers</h2>
			<p>{t.error}</p>
		</section>
	{:else}
		<h2 class="section">Likely real visitors</h2>
		{#if h}
			<div class="stats-bar">
				<div class="stat strong">
					<span class="stat-value">{n(h.totals.visitors7)}</span>
					<span class="stat-label">Visitors, 7 days</span>
				</div>
				<div class="stat strong">
					<span class="stat-value">{n(h.totals.pageViews7)}</span>
					<span class="stat-label">Page views, 7 days</span>
				</div>
				<div class="stat strong">
					<span class="stat-value">{n(h.totals.visitors30)}</span>
					<span class="stat-label">Visitors, 30 days</span>
				</div>
				<div class="stat strong">
					<span class="stat-value">{n(h.totals.pageViews30)}</span>
					<span class="stat-label">Page views, 30 days</span>
				</div>
			</div>

			<section class="panel">
				<h2>Visitors per day, {h.timeZone}</h2>
				<div class="bars" role="img" aria-label="Likely real visitors per day for the last {h.days.length} days">
					{#each h.days as d (d.date)}
						<div class="bar-col" title="{shortDate(d.date)}: {n(d.visitors)} visitors, {n(d.pageViews)} page views">
							<span class="bar good" style="height: {d.visitors === 0 ? 0 : Math.max(2, (d.visitors / maxHumanDay) * 100)}%"></span>
						</div>
					{/each}
				</div>
				<div class="axis">
					<span>{shortDate(h.days[0].date)}</span>
					<span>{shortDate(h.days[h.days.length - 1].date)}</span>
				</div>
			</section>

			<div class="two">
				<section class="panel">
					<h2>Countries, visitors</h2>
					{#if h.countries.length === 0}
						<p class="empty">Nothing yet.</p>
					{:else}
						<ul class="rows">
							{#each h.countries as c (c.name)}
								<li>
									<span class="row-name">{c.name}</span>
									<span class="row-bar"><span class="good" style="width: {(c.visitors / maxHumanCountry) * 100}%"></span></span>
									<span class="row-num">{n(c.visitors)}</span>
								</li>
							{/each}
						</ul>
					{/if}
				</section>

				<section class="panel">
					<h2>Pages, last 30 days</h2>
					{#if h.topPaths.length === 0}
						<p class="empty">Nothing yet.</p>
					{:else}
						<ul class="rows">
							{#each h.topPaths as p (p.path)}
								<li>
									<span class="row-name mono">{p.path}</span>
									<span class="row-bar"><span class="good" style="width: {(p.views / maxHumanPath) * 100}%"></span></span>
									<span class="row-num">{n(p.views)}</span>
								</li>
							{/each}
						</ul>
					{/if}
				</section>
			</div>

			<p class="note">
				A rule of thumb, not a verdict. It counts a real page load from a browser-looking user
				agent that is not a known bot, from an address that also fetched the site's own
				JavaScript. A visitor is a distinct address over the whole window, so someone who comes
				back is counted once. Days run midnight to midnight in {h.timeZone}. It still misses people behind a shared address and lets through
				bots that act like browsers, and Cloudflare's free plan has no bot score to do better.
			</p>
		{:else}
			<section class="panel">
				<p class="empty">Could not work out the likely-real numbers this time. The raw numbers below still stand.</p>
			</section>
		{/if}

		<h2 class="section">All traffic, bots included</h2>
		<div class="stats-bar">
			<div class="stat">
				<span class="stat-value">{n(t.totals.visitors7)}</span>
				<span class="stat-label">Visitors, 7 days</span>
			</div>
			<div class="stat">
				<span class="stat-value">{n(t.totals.pageViews7)}</span>
				<span class="stat-label">Page views, 7 days</span>
			</div>
			<div class="stat">
				<span class="stat-value">{n(t.totals.visitors30)}</span>
				<span class="stat-label">Visitors, 30 days</span>
			</div>
			<div class="stat">
				<span class="stat-value">{n(t.totals.pageViews30)}</span>
				<span class="stat-label">Page views, 30 days</span>
			</div>
		</div>

		<section class="panel">
			<h2>Visitors per day, UTC days</h2>
			{#if t.days.length === 0}
				<p class="empty">No traffic recorded yet.</p>
			{:else}
				<div class="bars" role="img" aria-label="All visitors per day for the last {t.days.length} days">
					{#each t.days as d (d.date)}
						<div class="bar-col" title="{shortDate(d.date)}: {n(d.visitors)} visitors, {n(d.pageViews)} page views">
							<span class="bar" style="height: {Math.max(2, (d.visitors / maxVisitors) * 100)}%"></span>
						</div>
					{/each}
				</div>
				<div class="axis">
					<span>{shortDate(t.days[0].date)}</span>
					<span>{shortDate(t.days[t.days.length - 1].date)}</span>
				</div>
			{/if}
		</section>

		<div class="two">
			<section class="panel">
				<h2>Countries, requests</h2>
				{#if t.countries.length === 0}
					<p class="empty">Nothing yet.</p>
				{:else}
					<ul class="rows">
						{#each t.countries as c (c.name)}
							<li>
								<span class="row-name">{c.name}</span>
								<span class="row-bar"><span style="width: {(c.requests / maxCountry) * 100}%"></span></span>
								<span class="row-num">{n(c.requests)}</span>
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			<section class="panel">
				<h2>Top pages, last 24 hours</h2>
				{#if t.topPaths === null}
					<p class="empty">Cloudflare did not return page-level data for this plan.</p>
				{:else if t.topPaths.length === 0}
					<p class="empty">Nothing yet.</p>
				{:else}
					<ul class="rows">
						{#each t.topPaths as p (p.path)}
							<li>
								<span class="row-name mono">{p.path}</span>
								<span class="row-bar"><span style="width: {(p.views / maxPath) * 100}%"></span></span>
								<span class="row-num">{n(p.views)}</span>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		</div>

		<p class="note">
			Cloudflare's own counts at the edge. Its days are cut at midnight UTC and the last one is
			still filling, so it can show a few hours of tomorrow. A visitor is a unique address on a
			given day, and the 30-day figure adds the days up. Bots, scanners and link previews are all in here, so read it
			as traffic, not as people. The country bars count requests, not visitors.
		</p>
	{/if}
</main>

<style>
	:global(body) {
		background: #0e0e0e;
		margin: 0;
	}
	main {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem 1.5rem;
		min-height: 100vh;
		font-family: system-ui, -apple-system, sans-serif;
		color: #e0e0e0;
		background: #0e0e0e;
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
		flex-wrap: wrap;
		gap: 1rem;
	}
	h1 {
		font-size: 1.5rem;
		margin: 0;
		color: #fff;
	}
	h2 {
		font-size: 0.8rem;
		margin: 0 0 1rem;
		color: #999;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		font-weight: 600;
	}
	.meta {
		display: flex;
		align-items: center;
		gap: 1rem;
		font-size: 0.85rem;
	}
	.user {
		color: #999;
	}
	.logout {
		color: #f66;
		background: none;
		border: none;
		cursor: pointer;
		font: inherit;
		padding: 0;
	}
	.logout:hover {
		text-decoration: underline;
	}
	.tab-bar {
		display: flex;
		margin-bottom: 1.5rem;
		border-bottom: 2px solid #333;
	}
	.tab {
		color: #888;
		font-size: 0.9rem;
		padding: 0.6rem 1.25rem;
		text-decoration: none;
		border-bottom: 2px solid transparent;
		margin-bottom: -2px;
		transition: color 0.15s, border-color 0.15s;
	}
	.tab:hover {
		color: #ccc;
	}
	.tab.active {
		color: #fff;
		border-bottom-color: #7db8ff;
	}
	.stats-bar {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
		gap: 1rem;
		margin-bottom: 1.5rem;
	}
	.stat {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 1rem 1.25rem;
		background: #161616;
		border: 1px solid #262626;
		border-radius: 10px;
	}
	.stat-value {
		font-size: 1.75rem;
		font-weight: 700;
		color: #fff;
		font-variant-numeric: tabular-nums;
	}
	.stat-label {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: #888;
	}
	.panel {
		padding: 1.25rem;
		margin-bottom: 1.5rem;
		background: #161616;
		border: 1px solid #262626;
		border-radius: 10px;
	}
	.setup p,
	.setup li {
		line-height: 1.55;
		color: #bbb;
	}
	.setup p {
		margin: 0 0 0.9rem;
	}
	.setup li {
		margin-bottom: 0.4rem;
	}
	.setup ol {
		padding-left: 1.25rem;
	}
	.setup code {
		background: #222;
		padding: 0.1rem 0.4rem;
		border-radius: 4px;
		color: #7db8ff;
	}
	.problem {
		border-color: #6b2a2a;
	}
	.problem p {
		color: #f99;
		margin: 0;
	}
	.bars {
		display: flex;
		align-items: flex-end;
		gap: 3px;
		height: 10rem;
	}
	.bar-col {
		flex: 1 1 0;
		height: 100%;
		display: flex;
		align-items: flex-end;
		min-width: 0;
	}
	.bar {
		width: 100%;
		background: #7db8ff;
		border-radius: 2px 2px 0 0;
		opacity: 0.85;
		transition: opacity 0.15s;
	}
	.bar.good,
	.row-bar span.good {
		background: #6fe0a0;
	}
	.stat.strong {
		border-color: #2c3a30;
	}
	h2.section {
		font-size: 1rem;
		color: #fff;
		text-transform: none;
		letter-spacing: 0;
		margin: 0 0 1rem;
	}
	.note + h2.section {
		margin-top: 2.25rem;
	}
	.bar-col:hover .bar {
		opacity: 1;
	}
	.axis {
		display: flex;
		justify-content: space-between;
		margin-top: 0.5rem;
		font-size: 0.75rem;
		color: #777;
	}
	.two {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(22rem, 1fr));
		gap: 1.5rem;
	}
	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}
	.rows li {
		display: grid;
		grid-template-columns: minmax(6rem, 10rem) 1fr 4.5rem;
		align-items: center;
		gap: 0.75rem;
		font-size: 0.85rem;
	}
	.row-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.mono {
		font-family: ui-monospace, monospace;
		font-size: 0.8rem;
	}
	.row-bar {
		height: 0.5rem;
		background: #222;
		border-radius: 999px;
		overflow: hidden;
	}
	.row-bar span {
		display: block;
		height: 100%;
		background: #7db8ff;
		border-radius: 999px;
	}
	.row-num {
		text-align: right;
		color: #aaa;
		font-variant-numeric: tabular-nums;
	}
	.empty {
		color: #666;
		font-style: italic;
		margin: 0;
	}
	.note {
		color: #777;
		font-size: 0.8rem;
		line-height: 1.5;
	}
</style>
