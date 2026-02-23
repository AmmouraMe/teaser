<script>
	let { children } = $props();
</script>

{@render children()}

<style>
	:global(*) {
		-webkit-user-select: none;
		-moz-user-select: none;
		-ms-user-select: none;
		user-select: none;
	}
</style>

