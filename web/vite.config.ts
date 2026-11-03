import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// En dev : PocketBase sur :8090 et worker IA sur :8000
export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// SPA : PocketBase sert index.html pour toute route inconnue
			adapter: adapter({ fallback: 'index.html' })
		})
	],
	server: {
		proxy: {
			'/api': 'http://127.0.0.1:8090',
			'/ia': { target: 'http://127.0.0.1:8000', rewrite: (p) => p.replace(/^\/ia/, '') }
		}
	}
});
