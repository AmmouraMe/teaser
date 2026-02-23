<script>
	/** @type {{ data: import('./$types').PageData }} */
	let { data } = $props();
</script>

<svelte:head>
	<title>Admin — Waitlist Entries</title>
</svelte:head>

<main>
	<header>
		<h1>Waitlist Entries</h1>
		<div class="meta">
			<span class="user">Logged in as <strong>{data.user.username}</strong></span>
			<a href="/auth/logout" class="logout">Logout</a>
		</div>
	</header>

	{#if data.entries.length === 0}
		<p class="empty">No entries yet.</p>
	{:else}
		<p class="count">{data.entries.length} {data.entries.length === 1 ? 'entry' : 'entries'}</p>

		<div class="table-wrap">
			<table>
				<thead>
					<tr>
						<th>#</th>
						<th>Name</th>
						<th>Email</th>
						<th>Deepest Insecurity</th>
						<th>Submitted</th>
					</tr>
				</thead>
				<tbody>
					{#each data.entries as entry, i}
						<tr>
							<td class="num">{i + 1}</td>
							<td>{entry.name}</td>
							<td><a href="mailto:{entry.email}">{entry.email}</a></td>
							<td class="insecurity">{entry.insecurity}</td>
							<td class="ts">{new Date(entry.ts).toLocaleString()}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</main>

<style>
	main {
		max-width: 960px;
		margin: 2rem auto;
		padding: 0 1.5rem;
		font-family: system-ui, -apple-system, sans-serif;
		color: #e0e0e0;
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
	}
	.logout:hover {
		text-decoration: underline;
	}

	.count {
		color: #888;
		font-size: 0.9rem;
		margin-bottom: 1rem;
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
		max-width: 300px;
	}

	.ts {
		white-space: nowrap;
		color: #888;
		font-size: 0.85rem;
	}

	tr:hover td {
		background: rgba(255, 255, 255, 0.03);
	}
</style>
