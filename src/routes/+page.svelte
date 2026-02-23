<script>
	import { enhance } from '$app/forms';

	/** @type {{ form: import('./$types').ActionData }} */
	let { form } = $props();

	let showForm = $state(false);
	let submitted = $state(false);
	let submitting = $state(false);
	let formError = $state('');

	let name = $state('');
	let email = $state('');
	let insecurity = $state('');

	// Sync server response into local state
	$effect(() => {
		if (form?.success) {
			submitted = true;
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
	<title>Build your empire. Break your heart.</title>
	<meta name="description" content="We don't sell dreams. We give you the tools to crush them." />
</svelte:head>

<main>
	<section class="hero">
		<p class="tagline">Build your empire. Break your heart.</p>
		<h1>We don't sell dreams. We give you the tools to crush them.</h1>
	</section>

	<section class="enter">
		{#if !showForm && !submitted}
			<button onclick={() => (showForm = true)}>Start the Crush</button>
		{/if}

		{#if showForm && !submitted}
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
					<span>Your deepest insecurity.</span>
					<span class="warning">If you lie, we'll know.</span>
					<textarea name="insecurity" bind:value={insecurity} rows="3" spellcheck="false" required></textarea>
				</label>
				{#if formError}
					<p class="error">{formError}</p>
				{/if}
				<button type="submit" disabled={!formValid || submitting}>
					{submitting ? '...' : 'Join Waitlist'}
				</button>
			</form>
		{/if}

		{#if submitted}
			<p class="confirmation">We'll be in touch.</p>
		{/if}
	</section>
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
		min-height: 200vh;
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
	textarea:-webkit-autofill,
	textarea:-webkit-autofill:hover,
	textarea:-webkit-autofill:focus {
		-webkit-text-fill-color: #fff;
		-webkit-box-shadow: 0 0 0px 1000px #000 inset;
		box-shadow: 0 0 0px 1000px #000 inset;
		transition: background-color 5000s ease-in-out 0s;
		caret-color: #fff;
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
</style>

