<script>
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';

	/** @type {{ data: import('./$types').PageData }} */
	let { data } = $props();

	let expandedRows = $state(new Set());
	let showArchived = $state(false);

	const COOKIE_NAME = 'admin_session';
	const LS_KEY = 'admin_session';

	onMount(() => {
		// Persist the session cookie to localStorage
		const match = document.cookie.split('; ').find(c => c.startsWith(COOKIE_NAME + '='));
		if (match) {
			localStorage.setItem(LS_KEY, match.split('=').slice(1).join('='));
		}
	});

	function handleLogout() {
		localStorage.removeItem(LS_KEY);
		window.location.href = '/auth/logout';
	}

	function toggleRow(i) {
		const next = new Set(expandedRows);
		if (next.has(i)) next.delete(i);
		else next.add(i);
		expandedRows = next;
	}

	function formatValue(val) {
		if (val === null || val === undefined) return '—';
		if (typeof val === 'object') return JSON.stringify(val, null, 2);
		return String(val);
	}

	/** Pick non-null/non-empty fields from an object */
	function nonEmpty(obj) {
		if (!obj || typeof obj !== 'object') return [];
		return Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && v !== '' && v !== 'null');
	}

	function geoSummary(entry) {
		const s = entry.server || {};
		return [s.city, s.region, s.country].filter(Boolean).join(', ') || '—';
	}

	function deviceSummary(entry) {
		const c = entry.client || {};
		const s = entry.server || {};
		return c.platform || s.secChUaPlatform || '—';
	}

	const geoKeys = ['ip', 'country', 'city', 'region', 'regionCode', 'continent', 'postalCode', 'latitude', 'longitude', 'timezone', 'metroCode'];
	const netKeys = ['asn', 'asOrganization', 'tlsVersion', 'tlsCipher', 'httpProtocol'];
	const reqKeys = ['userAgent', 'acceptLanguage', 'referer', 'origin', 'secFetchDest', 'secFetchMode', 'secFetchSite', 'secChUa', 'secChUaMobile', 'secChUaPlatform', 'secChUaPlatformVersion', 'secChUaArch', 'secChUaModel', 'secChUaFullVersion', 'dnt', 'cfRay', 'cfVisitor'];
	const screenKeys = ['screenWidth', 'screenHeight', 'screenAvailWidth', 'screenAvailHeight', 'colorDepth', 'pixelDepth', 'devicePixelRatio', 'viewportWidth', 'viewportHeight', 'screenOrientation'];
	const localeKeys = ['timezone', 'timezoneOffset', 'language', 'languages', 'localTime'];
	const hwKeys = ['platform', 'userAgent', 'hardwareConcurrency', 'deviceMemory', 'maxTouchPoints', 'webglRenderer', 'pluginCount', 'canvasHash'];
	const featKeys = ['cookieEnabled', 'doNotTrack', 'pdfViewerEnabled', 'webdriver', 'onLine', 'touchSupport', 'prefersDarkMode', 'prefersReducedMotion'];
	const connKeys = ['connectionType', 'connectionEffectiveType', 'connectionDownlink', 'connectionRtt', 'connectionSaveData'];
	const refKeys = ['referrer', 'pageUrl', 'utmSource', 'utmMedium', 'utmCampaign', 'utmTerm', 'utmContent'];

	/** Extract subset of keys from an object, returning only non-null entries */
	function pick(obj, keys) {
		if (!obj) return [];
		return keys
			.filter(k => obj[k] !== null && obj[k] !== undefined && obj[k] !== '' && obj[k] !== 'null')
			.map(k => [k, obj[k]]);
	}
</script>

<svelte:head>
	<title>Admin — Waitlist Entries</title>
</svelte:head>

<main>
	<header>
		<h1>Waitlist Entries</h1>
		<div class="meta">
			<span class="user">Logged in as <strong>{data.user.username}</strong></span>
			<button onclick={handleLogout} class="logout">Logout</button>
		</div>
	</header>

	{#if data.entries.length === 0 && data.archivedEntries.length === 0}
		<p class="empty">No entries yet.</p>
	{:else}
		<div class="stats-bar">
			<div class="stat">
				<span class="stat-value">{data.entries.length}</span>
				<span class="stat-label">Total Submissions</span>
			</div>
			<div class="stat">
				<span class="stat-value">{data.uniqueEmails}</span>
				<span class="stat-label">Unique Emails</span>
			</div>
			<div class="stat">
				<span class="stat-value">{data.uniqueDiscords}</span>
				<span class="stat-label">Discord Linked</span>
			</div>
		</div>

		<div class="tab-bar">
			<button class="tab" class:active={!showArchived} onclick={() => { showArchived = false; expandedRows = new Set(); }}>
				Active ({data.entries.length})
			</button>
			<button class="tab" class:active={showArchived} onclick={() => { showArchived = true; expandedRows = new Set(); }}>
				Archived ({data.archivedEntries.length})
			</button>
		</div>

		{@const displayEntries = showArchived ? data.archivedEntries : data.entries}

		{#if displayEntries.length === 0}
			<p class="empty">{showArchived ? 'No archived entries.' : 'No active entries.'}</p>
		{:else}
			<p class="count">{displayEntries.length} {displayEntries.length === 1 ? 'entry' : 'entries'}</p>

		<div class="table-wrap">
			<table>
				<thead>
					<tr>
						<th>#</th>
						<th>Name</th>
						<th>Email</th>
						<th>What's Stopping Them</th>
						<th>Location</th>
						<th>Device</th>
						<th>Submitted</th>
						<th></th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{#each displayEntries as entry, i}
						<tr class="summary-row" class:expanded={expandedRows.has(i)} onclick={() => toggleRow(i)}>
							<td class="num">{i + 1}</td>
							<td>{entry.name}</td>
							<td><a href="mailto:{entry.email}" onclick={(e) => e.stopPropagation()}>{entry.email}</a></td>
							<td class="insecurity">{entry.insecurity}</td>
							<td class="geo">{geoSummary(entry)}</td>
							<td class="device">{deviceSummary(entry)}</td>
							<td class="ts">{new Date(entry.ts).toLocaleString()}</td>
							<td class="archive-cell" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
								<form method="POST" action={showArchived ? '?/unarchive' : '?/archive'} use:enhance={() => { return async ({ update }) => { await update(); expandedRows = new Set(); }; }}>
									<input type="hidden" name="kvKey" value={entry._kvKey} />
									<button type="submit" class="archive-btn" title={showArchived ? 'Unarchive' : 'Archive'}>
										{showArchived ? '↩' : '🗃️'}
									</button>
								</form>
							</td>
							<td class="toggle">{expandedRows.has(i) ? '▲' : '▼'}</td>
						</tr>
						{#if expandedRows.has(i)}
							<tr class="detail-row">
								<td colspan="9">
									<div class="detail-grid">
										<!-- Server Data -->
										{#if entry.server && nonEmpty(entry.server).length > 0}
											<div class="detail-section">
												<h3>Server Data</h3>
												<div class="detail-cards">
													{#if pick(entry.server, geoKeys).length > 0}
														<div class="card">
															<h4>Location & Geo</h4>
															<dl>
																{#each pick(entry.server, geoKeys) as [key, val]}
																	<dt>{key}</dt>
																	<dd>{formatValue(val)}</dd>
																{/each}
															</dl>
														</div>
													{/if}

													{#if pick(entry.server, netKeys).length > 0}
														<div class="card">
															<h4>Network & Security</h4>
															<dl>
																{#each pick(entry.server, netKeys) as [key, val]}
																	<dt>{key}</dt>
																	<dd>{formatValue(val)}</dd>
																{/each}
															</dl>
														</div>
													{/if}

													{#if entry.server.botManagement}
														<div class="card">
															<h4>Bot Detection</h4>
															<dl>
																{#each nonEmpty(entry.server.botManagement) as [key, val]}
																	<dt>{key}</dt>
																	<dd>{formatValue(val)}</dd>
																{/each}
															</dl>
														</div>
													{/if}

													{#if pick(entry.server, reqKeys).length > 0}
														<div class="card wide">
															<h4>Request Info</h4>
															<dl>
																{#each pick(entry.server, reqKeys) as [key, val]}
																	<dt>{key}</dt>
																	<dd class="break-word">{formatValue(val)}</dd>
																{/each}
															</dl>
														</div>
													{/if}

													{#if entry.server.rawHeaders}
														<div class="card wide">
															<h4>Raw Headers</h4>
															<pre class="raw">{JSON.stringify(entry.server.rawHeaders, null, 2)}</pre>
														</div>
													{/if}
												</div>
											</div>
										{/if}

										<!-- Client Data -->
										{#if entry.client && nonEmpty(entry.client).length > 0}
											<div class="detail-section">
												<h3>Client Data</h3>
												<div class="detail-cards">
													{#if pick(entry.client, screenKeys).length > 0}
														<div class="card">
															<h4>Screen & Viewport</h4>
															<dl>
																{#each pick(entry.client, screenKeys) as [key, val]}
																	<dt>{key}</dt>
																	<dd>{formatValue(val)}</dd>
																{/each}
															</dl>
														</div>
													{/if}

													{#if pick(entry.client, localeKeys).length > 0}
														<div class="card">
															<h4>Locale & Time</h4>
															<dl>
																{#each pick(entry.client, localeKeys) as [key, val]}
																	<dt>{key}</dt>
																	<dd>{formatValue(val)}</dd>
																{/each}
															</dl>
														</div>
													{/if}

													{#if pick(entry.client, hwKeys).length > 0}
														<div class="card wide">
															<h4>Platform & Hardware</h4>
															<dl>
																{#each pick(entry.client, hwKeys) as [key, val]}
																	<dt>{key}</dt>
																	<dd class="break-word">{formatValue(val)}</dd>
																{/each}
															</dl>
														</div>
													{/if}

													{#if pick(entry.client, featKeys).length > 0}
														<div class="card">
															<h4>Features & Preferences</h4>
															<dl>
																{#each pick(entry.client, featKeys) as [key, val]}
																	<dt>{key}</dt>
																	<dd>{formatValue(val)}</dd>
																{/each}
															</dl>
														</div>
													{/if}

													{#if pick(entry.client, connKeys).length > 0}
														<div class="card">
															<h4>Connection</h4>
															<dl>
																{#each pick(entry.client, connKeys) as [key, val]}
																	<dt>{key}</dt>
																	<dd>{formatValue(val)}</dd>
																{/each}
															</dl>
														</div>
													{/if}

													{#if pick(entry.client, refKeys).length > 0}
														<div class="card">
															<h4>Referrer & UTM</h4>
															<dl>
																{#each pick(entry.client, refKeys) as [key, val]}
																	<dt>{key}</dt>
																	<dd class="break-word">{formatValue(val)}</dd>
																{/each}
															</dl>
														</div>
													{/if}
												</div>
											</div>
										{/if}
									</div>
								</td>
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>
		</div>
		{/if}
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
		text-decoration: none;
		background: none;
		border: none;
		cursor: pointer;
		font: inherit;
		padding: 0;
	}
	.logout:hover {
		text-decoration: underline;
	}

	.count {
		color: #888;
		font-size: 0.9rem;
		margin-bottom: 1rem;
	}

	.tab-bar {
		display: flex;
		gap: 0;
		margin-bottom: 1.5rem;
		border-bottom: 2px solid #333;
	}

	.tab {
		background: none;
		border: none;
		color: #888;
		font: inherit;
		font-size: 0.9rem;
		padding: 0.6rem 1.25rem;
		cursor: pointer;
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

	.archive-cell {
		width: 2rem;
		text-align: center;
		padding: 0;
	}

	.archive-cell form {
		display: inline;
	}

	.archive-btn {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 0.85rem;
		padding: 0.3rem 0.4rem;
		border-radius: 4px;
		opacity: 0.5;
		transition: opacity 0.15s, background 0.15s;
	}

	.archive-btn:hover {
		opacity: 1;
		background: rgba(255, 255, 255, 0.08);
	}

	.stats-bar {
		display: flex;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.stat {
		flex: 1;
		background: #181818;
		border: 1px solid #2a2a2a;
		border-radius: 8px;
		padding: 1rem 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.stat-value {
		font-size: 1.75rem;
		font-weight: 700;
		color: #fff;
	}

	.stat-label {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: #888;
	}

	.empty {
		color: #666;
		font-style: italic;
	}

	.table-wrap {
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
	}

	th, td {
		text-align: left;
		padding: 0.6rem 0.8rem;
		border-bottom: 1px solid #333;
	}

	th {
		color: #aaa;
		font-weight: 600;
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		border-bottom: 2px solid #444;
	}

	td a {
		color: #7db8ff;
		text-decoration: none;
	}
	td a:hover {
		text-decoration: underline;
	}

	.num {
		color: #666;
		width: 2rem;
	}

	.insecurity {
		max-width: 250px;
	}

	.geo, .device {
		white-space: nowrap;
		font-size: 0.85rem;
		color: #bbb;
	}

	.ts {
		white-space: nowrap;
		color: #888;
		font-size: 0.85rem;
	}

	.toggle {
		color: #666;
		font-size: 0.7rem;
		width: 1.5rem;
		text-align: center;
	}

	.summary-row {
		cursor: pointer;
	}

	.summary-row:hover td {
		background: rgba(255, 255, 255, 0.03);
	}

	.summary-row.expanded td {
		background: rgba(255, 255, 255, 0.02);
		border-bottom-color: transparent;
	}

	/* Detail row */
	.detail-row td {
		padding: 0 0.8rem 1.5rem;
		border-bottom: 2px solid #333;
		background: rgba(255, 255, 255, 0.01);
	}

	.detail-grid {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.detail-section h3 {
		font-size: 0.85rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #7db8ff;
		margin: 0 0 0.75rem;
		padding-bottom: 0.25rem;
		border-bottom: 1px solid #2a2a2a;
	}

	.detail-cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 0.75rem;
	}

	.card {
		background: #181818;
		border: 1px solid #2a2a2a;
		border-radius: 6px;
		padding: 0.75rem 1rem;
	}

	.card.wide {
		grid-column: 1 / -1;
	}

	.card h4 {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: #999;
		margin: 0 0 0.5rem;
	}

	dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.2rem 0.75rem;
		margin: 0;
		font-size: 0.8rem;
	}

	dt {
		color: #777;
		font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', monospace;
		font-size: 0.75rem;
		white-space: nowrap;
	}

	dd {
		margin: 0;
		color: #ccc;
		word-break: break-all;
	}

	.break-word {
		word-break: break-word;
	}

	.raw {
		font-size: 0.75rem;
		color: #999;
		background: #111;
		border-radius: 4px;
		padding: 0.75rem;
		margin: 0;
		overflow-x: auto;
		max-height: 300px;
		white-space: pre-wrap;
		word-break: break-all;
	}
</style>
