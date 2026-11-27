<script>
	import { enhance } from '$app/forms';

	/** @type {{ data: import('./$types').PageData, form: any }} */
	let { data, form } = $props();
	const c = $derived(data.config);

	function handleLogout() {
		localStorage.removeItem('admin_session');
		window.location.href = '/auth/logout';
	}
</script>

<svelte:head>
	<title>Admin — SpaceBot</title>
</svelte:head>

<main>
	<header>
		<h1>SpaceBot connection</h1>
		<div class="meta">
			<span class="user">Logged in as <strong>{data.user.username}</strong></span>
			<button onclick={handleLogout} class="logout">Logout</button>
		</div>
	</header>

	<nav class="tab-bar" aria-label="Admin sections">
		<a class="tab" href="/admin">Waitlist</a>
		<a class="tab" href="/admin/traffic">Traffic</a>
		<a class="tab active" href="/admin/spacebot" aria-current="page">SpaceBot</a>
	</nav>

	{#if !data.kvAvailable}
		<section class="panel problem" role="alert"><p>KV is not available here, so nothing can be saved.</p></section>
	{/if}
	{#if form?.error}
		<section class="panel problem" role="alert"><p>{form.error}</p></section>
	{:else if form?.saved}
		<section class="panel ok"><p>Saved.</p></section>
	{:else if form?.removed}
		<section class="panel ok"><p>Connection removed.</p></section>
	{/if}

	<section class="panel help">
		<p>
			In SpaceBot: Server → Settings → Incoming webhooks → New. Copy the URL and secret here. Then make an
			automation with the trigger "Webhook received" and use <code>{'{webhook.event}'}</code>,
			<code>{'{webhook.code}'}</code>, <code>{'{webhook.country}'}</code>, <code>{'{webhook.total}'}</code> in its
			message.
		</p>
		<p>Events carry no name and no email.</p>
	</section>

	<section class="panel">
		<h2>Connection</h2>
		<form method="POST" action="?/save" use:enhance class="stack">
			<label>
				Webhook URL
				<input type="url" name="url" value={c.connected ? c.url : ''} placeholder="https://…/api/hooks/…" required autocomplete="off" />
			</label>
			<label>
				Secret
				<input
					type="password"
					name="secret"
					autocomplete="off"
					placeholder={c.connected && c.hasSecret ? `saved, ends in ${c.secretTail}. Leave blank to keep it.` : 'sbw_…'}
				/>
			</label>
			<label class="check"><input type="checkbox" name="enabled" checked={c.connected ? c.enabled : true} /> Enabled</label>
			<label class="check"><input type="checkbox" name="signup" checked={c.connected ? c.events.signup : true} /> Send an event on each new signup</label>
			<div class="row"><button class="primary" type="submit">Save</button></div>
		</form>
	</section>

	{#if c.connected}
		<section class="panel">
			<h2>Status</h2>
			<div class="row">
				<form method="POST" action="?/toggle" use:enhance>
					<input type="hidden" name="enabled" value={c.enabled ? '0' : '1'} />
					<button type="submit">{c.enabled ? 'Disable' : 'Enable'}</button>
				</form>
				<form method="POST" action="?/test" use:enhance>
					<button type="submit">Send test</button>
				</form>
				<form method="POST" action="?/remove" use:enhance>
					<button type="submit" class="danger">Remove connection</button>
				</form>
			</div>
			<p class="note">Currently {c.enabled ? 'on' : 'off'}.</p>

			<form method="POST" action="?/events" use:enhance class="stack">
				<label class="check"><input type="checkbox" name="signup" checked={c.events.signup} /> signup</label>
				<label class="check"><input type="checkbox" name="test" checked={c.events.test} /> test</label>
				<div class="row"><button type="submit">Save events</button></div>
			</form>

			<h2>Last result</h2>
			{#if c.lastResult}
				<p class:bad={!c.lastResult.ok} class:good={c.lastResult.ok}>
					{c.lastResult.ok ? 'OK' : 'Failed'}, status {c.lastResult.status || 'none'}, {new Date(c.lastResult.at).toLocaleString()}
					{#if c.lastResult.error}<br />{c.lastResult.error}{/if}
				</p>
			{:else}
				<p class="note">Nothing sent yet.</p>
			{/if}
		</section>
	{/if}
</main>

<style>
	main { max-width: 760px; margin: 0 auto; padding: 2rem 1.5rem; min-height: 100vh; font-family: system-ui, -apple-system, sans-serif; color: #e0e0e0; background: #0e0e0e; }
	header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem; }
	h1 { font-size: 1.5rem; margin: 0; color: #fff; }
	h2 { font-size: 0.8rem; margin: 1.25rem 0 0.75rem; color: #999; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600; }
	.panel > h2:first-child { margin-top: 0; }
	.meta { display: flex; align-items: center; gap: 1rem; font-size: 0.85rem; }
	.user { color: #999; }
	.logout { color: #f66; background: none; border: none; cursor: pointer; font: inherit; padding: 0; }
	.logout:hover { text-decoration: underline; }
	.tab-bar { display: flex; margin-bottom: 1.5rem; border-bottom: 2px solid #333; }
	.tab { color: #888; font-size: 0.9rem; padding: 0.6rem 1.25rem; text-decoration: none; border-bottom: 2px solid transparent; margin-bottom: -2px; }
	.tab:hover { color: #ccc; }
	.tab.active { color: #fff; border-bottom-color: #7db8ff; }
	.panel { padding: 1.25rem; margin-bottom: 1.5rem; background: #161616; border: 1px solid #262626; border-radius: 10px; }
	.panel p { margin: 0 0 0.75rem; line-height: 1.55; color: #bbb; }
	.panel p:last-child { margin-bottom: 0; }
	code { background: #222; padding: 0.1rem 0.4rem; border-radius: 4px; color: #7db8ff; }
	.problem { border-color: #6b2a2a; }
	.problem p { color: #f99; }
	.ok { border-color: #2a5a3a; }
	.ok p, .good { color: #8fd9a8; }
	.bad { color: #f99; }
	.note { color: #888; font-size: 0.85rem; }
	.stack { display: flex; flex-direction: column; gap: 0.9rem; }
	label { display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.85rem; color: #999; }
	label.check { flex-direction: row; align-items: center; gap: 0.5rem; color: #ccc; }
	input[type='url'], input[type='password'] { padding: 0.6rem 0.75rem; background: #0e0e0e; color: #e0e0e0; border: 1px solid #333; border-radius: 6px; font: inherit; }
	.row { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 0.75rem; }
	button { padding: 0.5rem 1rem; background: #222; color: #e0e0e0; border: 1px solid #333; border-radius: 6px; cursor: pointer; font: inherit; }
	button:hover { border-color: #7db8ff; }
	button.primary { background: #7db8ff; color: #0e0e0e; border-color: #7db8ff; }
	button.danger { color: #f66; }
</style>
