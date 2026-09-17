import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		port: 4237,
		allowedHosts: ['ammoura-dev.starspace.group']
	}
});
