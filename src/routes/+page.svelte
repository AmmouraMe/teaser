<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';

	/** @type {{ form: import('./$types').ActionData }} */
	let { form } = $props();

	let showForm = $state(false);
	let submitted = $state(false);
	let submitting = $state(false);
	let formError = $state('');
	let submittedEmail = $state('');
	let discordLinked = $state(false);

	let name = $state('');
	let email = $state('');
	let insecurity = $state('');

	// Check if user just returned from Discord linking
	$effect(() => {
		const linked = $page.url.searchParams.get('linked');
		if (linked === '1') {
			submitted = true;
			discordLinked = true;
		}
	});

	// Sync server response into local state
	$effect(() => {
		if (form?.success) {
			submitted = true;
			submittedEmail = form.email || '';
			formError = '';
		} else if (form?.error) {
			formError = form.error;
		}
	});

	const fakeName = [
		'test', 'asdf', 'qwerty', 'fake', 'nobody', 'anonymous', 'anon',
		'user', 'admin', 'null', 'undefined', 'none', 'n/a', 'na', 'xxx',
		'abc', 'aaa', 'bbb', 'ccc', '123', 'john doe', 'jane doe', 'lorem'
	];

	const fakeDomains = [
		'test.com', 'fake.com', 'example.com', 'mailinator.com', 'throwaway.email',
		'guerrillamail.com', 'yopmail.com', 'tempmail.com', 'trashmail.com',
		'disposable.com', 'sharklasers.com', 'guerrillamailblock.com', 'grr.la',
		'spam4.me', 'noemail.com', 'nomail.com', 'nomail.org', 'aol.com.invalid'
	];

	const fakeInsecurities = [
		'nothing', 'idk', 'i don\'t know', 'none', 'n/a', 'na', 'no', 'nope',
		'not sure', 'unsure', 'whatever', 'everything', 'nothing really',
		'no insecurities', 'i\'m fine', 'nothing lol', 'lol', 'haha', 'ha',
		'test', 'asdf', 'qwerty', 'abc', '123', '...', '???', 'pass', 'skip',
		'rather not say', 'prefer not to say', 'none of your business'
	];

	function looksLie(value, list) {
		const v = value.trim().toLowerCase();
		return list.some((f) => v === f || v.startsWith(f + ' ') || v.endsWith(' ' + f));
	}

	let formValid = $derived(
		name.trim().length >= 2 &&
		/^[a-zA-Z]/.test(name.trim()) &&
		!/(.)\1{3,}/.test(name.trim()) &&
		!looksLie(name, fakeName) &&
		email.includes('@') &&
		/^[^@]+@[^@]+\.[^@]+$/.test(email) &&
		!fakeDomains.includes((email.split('@')[1] || '').toLowerCase()) &&
		!/^(test|fake|asdf|nope|no|none|null)\+?/.test((email.split('@')[0] || '').toLowerCase()) &&
		insecurity.trim().length >= 5 &&
		!looksLie(insecurity, fakeInsecurities) &&
		!/(.)\1{4,}/.test(insecurity.trim())
	);
</script>

<svelte:head>
	<title>Build your empire.</title>
	<meta name="description" content="We don't sell dreams. We give you the tools to crush them." />
</svelte:head>

<main>
	{#if !showForm && !submitted}
		<section class="hero">
			<p class="tagline">Build your empire.</p>
			<h1>We don't sell dreams. We give you the tools to crush them.</h1>
			<button onclick={() => (showForm = true)}>Start Crush</button>
		</section>
	{/if}

	{#if showForm && !submitted}
		<section class="enter">
			<form
				method="POST"
				use:enhance={() => {
					submitting = true;
					formError = '';
					return async ({ update }) => {
						submitting = false;
						await update();
					};
				}}
				novalidate
			>
				<label>
					<span>Your name.</span>
					<input name="name" type="text" bind:value={name} autocomplete="off" spellcheck="false" required />
				</label>
				<label>
					<span>Your email.</span>
					<input name="email" type="email" bind:value={email} autocomplete="off" required />
				</label>
				<label>
					<span>What's stopping you from being awesome?</span>
					<textarea name="insecurity" bind:value={insecurity} rows="3" spellcheck="false" required></textarea>
				</label>
				{#if formError}
					<p class="error">{formError}</p>
				{/if}
				<button type="submit" disabled={!formValid || submitting}>
					{submitting ? '...' : 'Join Waitlist'}
				</button>
			</form>
		</section>
	{/if}

	{#if submitted}
		<section class="enter">
			{#if discordLinked}
				<p class="confirmation">Discord linked. We'll reach out there first.</p>
				<p class="discord-prompt">Join the server so you don't miss anything.</p>
				<a class="discord-btn" href="https://discord.gg/dUnKPHub4U" target="_blank" rel="noopener noreferrer">
					<svg class="discord-icon" viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
						<path d="M20.317 4.369a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .078-.01c3.927 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .079.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
					</svg>
					Join Server
				</a>
			{:else}
				<p class="confirmation">We'll be in touch.</p>
				<p class="discord-prompt">Want to hear about early access faster?</p>
				<a class="discord-btn" href="/auth/discord/link?email={encodeURIComponent(submittedEmail)}">
					<svg class="discord-icon" viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
						<path d="M20.317 4.369a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .078-.01c3.927 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .079.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
					</svg>
					Connect Discord
				</a>
			{/if}
		</section>
	{/if}
</main>

<style>
	:global(*, *::before, *::after) {
		box-sizing: border-box;
		margin: 0;
		padding: 0;
	}

	:global(html, body) {
		background: #000;
		color: #fff;
		font-family: 'Georgia', serif;
		scroll-behavior: smooth;
	}

	main {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	.hero {
		height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		text-align: center;
	}

	.tagline {
		font-size: clamp(0.75rem, 2vw, 1rem);
		letter-spacing: 0.3em;
		text-transform: uppercase;
		opacity: 0.4;
		margin-bottom: 2.5rem;
	}

	h1 {
		font-size: clamp(1.4rem, 4vw, 2.5rem);
		font-weight: 400;
		line-height: 1.4;
		max-width: 700px;
		letter-spacing: 0.02em;
		margin-bottom: 3rem;
	}

	.enter {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 4rem 2rem;
	}

	button {
		background: none;
		border: 1px solid #fff;
		color: #fff;
		font-family: inherit;
		font-size: 1rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		padding: 1rem 3rem;
		cursor: pointer;
		transition: background 0.2s, color 0.2s;
	}

	button:hover {
		background: #fff;
		color: #000;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 2rem;
		width: 100%;
		max-width: 480px;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	label span {
		font-size: 0.85rem;
		letter-spacing: 0.15em;
		text-transform: uppercase;
		opacity: 0.7;
	}

	.warning {
		font-size: 0.7rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		opacity: 0.35;
		margin-top: -0.3rem;
	}

	input,
	textarea {
		background: none;
		border: none;
		border-bottom: 1px solid rgba(255, 255, 255, 0.4);
		color: #fff;
		font-family: inherit;
		font-size: 1rem;
		padding: 0.5rem 0;
		outline: none;
		resize: none;
		transition: border-color 0.2s;
	}

	input:focus,
	textarea:focus {
		border-bottom-color: #fff;
	}

	input:-webkit-autofill,
	input:-webkit-autofill:hover,
	input:-webkit-autofill:focus,
	input:-webkit-autofill:active,
	textarea:-webkit-autofill,
	textarea:-webkit-autofill:hover,
	textarea:-webkit-autofill:focus,
	textarea:-webkit-autofill:active {
		-webkit-text-fill-color: #fff !important;
		-webkit-box-shadow: 0 0 0px 1000px #000 inset !important;
		box-shadow: 0 0 0px 1000px #000 inset !important;
		background-color: #000 !important;
		color: #fff !important;
		transition: background-color 5000s ease-in-out 0s, color 5000s ease-in-out 0s;
		caret-color: #fff !important;
		-webkit-background-clip: text !important;
		background-clip: text !important;
	}

	input:-internal-autofill-selected,
	textarea:-internal-autofill-selected {
		-webkit-text-fill-color: #fff !important;
		-webkit-box-shadow: 0 0 0px 1000px #000 inset !important;
		box-shadow: 0 0 0px 1000px #000 inset !important;
		background-color: #000 !important;
		color: #fff !important;
	}

	.error {
		font-size: 0.85rem;
		letter-spacing: 0.1em;
		opacity: 0.8;
		text-align: center;
	}

	form button {
		align-self: center;
		margin-top: 1rem;
	}

	form button:disabled {
		opacity: 0.25;
		cursor: default;
		pointer-events: none;
	}

	.confirmation {
		font-size: 1rem;
		letter-spacing: 0.3em;
		text-transform: uppercase;
		opacity: 0.7;
	}

	.discord-prompt {
		font-size: 0.85rem;
		letter-spacing: 0.15em;
		opacity: 0.45;
		margin-top: 2rem;
	}

	.discord-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		margin-top: 1rem;
		border: 1px solid #5865f2;
		color: #fff;
		background: none;
		font-family: inherit;
		font-size: 0.9rem;
		letter-spacing: 0.15em;
		text-transform: uppercase;
		text-decoration: none;
		padding: 0.85rem 2rem;
		cursor: pointer;
		transition: background 0.2s, color 0.2s;
	}

	.discord-btn:hover {
		background: #5865f2;
		color: #fff;
	}

	.discord-icon {
		width: 1.2em;
		height: 1.2em;
	}
</style>

