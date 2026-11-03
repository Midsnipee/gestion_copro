import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
	plugins: [
		react(),
		VitePWA({
			registerType: 'autoUpdate',
			workbox: {
				// Les binaires SQLite (WASM) dépassent la limite par défaut ; ils doivent être en cache pour le hors ligne
				maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
				globPatterns: ['**/*.{js,css,html,wasm,svg,png,webmanifest}'],
				navigateFallback: '/index.html',
				navigateFallbackDenylist: [/^\/api\//, /^\/powersync\//]
			},
			includeAssets: ['icon.svg'],
			manifest: {
				name: 'Gestion copro',
				short_name: 'Copro',
				lang: 'fr',
				start_url: '/',
				scope: '/',
				display: 'standalone',
				background_color: '#f6f5f2',
				theme_color: '#1f3a5f',
				icons: [
					{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
					{ src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
					{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }
				]
			}
		})
	],
	optimizeDeps: {
		// Contient des web workers et du WASM : ne pas pré-bundler
		exclude: ['@powersync/web']
	},
	worker: { format: 'es' },
	server: {
		proxy: {
			'/api': 'http://127.0.0.1:3000',
			'/powersync': { target: 'http://127.0.0.1:8080', ws: true, rewrite: (p) => p.replace(/^\/powersync/, '') }
		}
	}
});
