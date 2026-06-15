import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
	plugins: [svelte()],
	server: {
		host: '0.0.0.0',
		proxy: {
			'/api': 'http://localhost:8000',
			'/uploads': 'http://localhost:8000',
			'/ws': {
				target: 'ws://localhost:8000',
				ws: true,
			},
		},
	},
	resolve: {
		alias: {
			$lib: fileURLToPath(new URL('./src/lib', import.meta.url))
		}
	}
});
