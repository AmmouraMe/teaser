import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		port: 4237,
		allowedHosts: ['ammoura-dev.starspace.group']
	},
	test: {
		include: ['src/**/*.test.js'],
		environment: 'node'
	}
});
