<script>
	import Seo from '$lib/components/Seo.svelte';

	const UPDATED = '22 August 2026';
	const CONTACT = 'support@ammoura.me';
</script>

<Seo
	title="Privacy Policy | Ammoura"
	description="How Ammoura collects, uses and protects information on the ammoura.me early-access site."
	path="/privacy"
/>

<h1>Privacy Policy</h1>
<p class="updated">Last updated {UPDATED}</p>

<p class="lede">
	This policy covers <strong>ammoura.me</strong>, the early-access site for Ammoura. It is written
	to describe what actually happens when you visit and when you join the waitlist, including the
	technical data our servers record. We would rather tell you plainly than bury it.
</p>

<h2>1. Who we are</h2>
<p>
	Ammoura ("we", "us") operates ammoura.me. For questions about this policy, or to exercise any of
	the rights described below, contact <a href="mailto:{CONTACT}">{CONTACT}</a>.
</p>
<p>
	For visitors in the UK, EU and EEA, Ammoura is the <strong>data controller</strong> for the
	information described here.
</p>

<h2>2. What we collect</h2>

<h3>Information you give us</h3>
<ul>
	<li><strong>Email address</strong> — when you join the waitlist by typing it in.</li>
	<li>
		<strong>Account details from a sign-in provider</strong> — if you join using GitHub, Discord,
		Google, Facebook or Apple, we receive your email address, the provider's account identifier,
		and a display name or username. We ask those providers for the minimum needed to identify you
		by email. We never receive your password, and we do not post anything on your behalf.
	</li>
</ul>

<h3>Information collected automatically</h3>
<p>
	When you submit the waitlist form, we record technical details about the request and your device.
	This is more than most sites disclose, so here is the actual list:
</p>

<table>
	<thead>
		<tr><th>Category</th><th>What is recorded</th></tr>
	</thead>
	<tbody>
		<tr>
			<td>Network</td>
			<td>IP address, network operator and ASN, TLS version and cipher, HTTP protocol version</td>
		</tr>
		<tr>
			<td>Approximate location</td>
			<td>
				Country, region, city, postal code, timezone and <strong>approximate latitude and
				longitude</strong>, derived by our network provider from your IP address. This is
				IP-derived and is not GPS data from your device.
			</td>
		</tr>
		<tr>
			<td>Device and browser</td>
			<td>
				User agent, operating system and platform, browser client hints, screen and viewport
				size, colour and pixel depth, device memory, CPU core count, touch support, language
				preferences, timezone offset, connection type and speed, and your dark-mode and
				reduced-motion preferences
			</td>
		</tr>
		<tr>
			<td>Device characteristics</td>
			<td>
				A <strong>canvas rendering fingerprint</strong> and your <strong>graphics hardware
				(WebGL) renderer string</strong>. These are values that, taken together, can help
				distinguish one device from another.
			</td>
		</tr>
		<tr>
			<td>Request context</td>
			<td>
				The full set of HTTP headers sent by your browser, the referring page, the page URL,
				and any UTM campaign parameters in the link you arrived through
			</td>
		</tr>
		<tr>
			<td>Automated-traffic signals</td>
			<td>Bot-detection scores produced by our network provider</td>
		</tr>
	</tbody>
</table>

<p>
	We collect this to understand where interest is coming from and to tell real signups apart from
	automated ones. We do not use it to build advertising profiles, and we do not sell it.
</p>

<h3>Analytics</h3>
<p>
	We use <strong>Google Analytics 4</strong> on this site. It sets its own identifiers and reports
	aggregate usage — pages viewed, how visitors arrived, approximate location, device type — to us
	through Google. Google processes this data as described in its own privacy policy. You can opt
	out across all sites using Google's
	<a href="https://tools.google.com/dlpage/gaoptout" rel="noopener noreferrer" target="_blank">browser add-on</a>.
</p>

<h3>Cookies</h3>
<p>We keep our own cookie use minimal. We set:</p>
<ul>
	<li>
		<strong>join_state</strong> — a short-lived security cookie set only when you start a sign-in
		with an external provider. It exists to prevent request-forgery attacks and expires within ten
		minutes. This is strictly necessary for that flow to be safe.
	</li>
	<li>
		<strong>admin_session</strong> — set only for site administrators signing in to manage the
		waitlist. It is never set for ordinary visitors.
	</li>
</ul>
<p>Google Analytics sets additional cookies of its own, which are not under our control.</p>

<h2>3. Why we use it, and our legal basis</h2>
<table>
	<thead>
		<tr><th>Purpose</th><th>Legal basis (UK/EU)</th></tr>
	</thead>
	<tbody>
		<tr>
			<td>Sending you launch and early-access news</td>
			<td>Consent — you gave us your address for this, and can withdraw at any time</td>
		</tr>
		<tr>
			<td>Preventing spam and abuse of the signup form</td>
			<td>Legitimate interests — keeping the waitlist real</td>
		</tr>
		<tr>
			<td>Understanding traffic and demand</td>
			<td>Consent for analytics and device-characteristic data</td>
		</tr>
		<tr>
			<td>Keeping the sign-in flow secure</td>
			<td>Legitimate interests, and strict necessity for the security cookie</td>
		</tr>
	</tbody>
</table>

<h2>4. Who we share it with</h2>
<p>We do not sell your personal information. We share it only with providers who run parts of this service for us:</p>
<table>
	<thead>
		<tr><th>Provider</th><th>What for</th></tr>
	</thead>
	<tbody>
		<tr><td>Cloudflare</td><td>Hosting, network delivery, and storage of waitlist entries</td></tr>
		<tr><td>Discord</td><td>Signup notifications are posted to a private internal channel we control</td></tr>
		<tr><td>Google</td><td>Analytics</td></tr>
		<tr>
			<td>GitHub, Discord, Google, Facebook, Apple</td>
			<td>Only if you choose to join using that provider — the exchange is between you and them</td>
		</tr>
	</tbody>
</table>
<p>
	We may also disclose information if required by law, or as part of a merger or acquisition, in
	which case we will say so here before it takes effect.
</p>

<h2>5. International transfers</h2>
<p>
	Our providers operate globally, so your information may be processed outside your country,
	including in the United States. Where data leaves the UK or EEA, we rely on our providers'
	standard contractual clauses and equivalent safeguards.
</p>

<h2>6. How long we keep it</h2>
<ul>
	<li>
		<strong>Waitlist entries</strong> — until Ammoura launches and we have contacted you, or until
		you ask us to delete them, whichever comes first.
	</li>
	<li>
		<strong>Technical and device data attached to a signup</strong> — kept with that entry and
		deleted with it.
	</li>
	<li><strong>Analytics data</strong> — retained according to Google Analytics' own retention settings.</li>
</ul>
<p>If you ask us to delete your data, we do not keep a shadow copy to remember that you asked.</p>

<h2>7. Your rights</h2>
<p>
	Wherever you live, you can ask us to give you a copy of what we hold about you, correct it, or
	delete it. Email <a href="mailto:{CONTACT}">{CONTACT}</a> and we will respond within 30 days.
</p>
<p>If you are in the UK, EU or EEA, you also have the right to:</p>
<ul>
	<li>object to processing based on legitimate interests</li>
	<li>ask us to restrict processing while a request is resolved</li>
	<li>receive your data in a portable, machine-readable format</li>
	<li>withdraw consent at any time, without affecting what happened before</li>
	<li>complain to your local data protection authority</li>
</ul>
<p>
	If you are a California resident, you have the right to know what we collect, to delete it, to
	correct it, and not to be discriminated against for exercising those rights. We do not sell or
	share personal information as those terms are defined under California law.
</p>

<h2>8. Security</h2>
<p>
	Traffic to this site is encrypted in transit. Waitlist data is held in access-controlled storage,
	administrative access requires authentication, and provider credentials are stored as encrypted
	secrets. No system is perfect, and we will not pretend otherwise — but we do not keep anything
	here that we do not need.
</p>

<h2>9. Children</h2>
<p>
	This site is not directed at children under 13, and we do not knowingly collect their information.
	If you believe a child has signed up, contact us and we will remove the entry.
</p>

<h2>10. Changes to this policy</h2>
<p>
	If we change how we handle your information, we will update this page and change the date at the
	top. If the change is significant, we will contact waitlist members directly rather than relying
	on you to re-read this page.
</p>

<h2>11. Contact</h2>
<p>
	Questions, requests, or complaints: <a href="mailto:{CONTACT}">{CONTACT}</a>.
</p>
