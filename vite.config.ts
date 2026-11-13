import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig, loadEnv, type PluginOption } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * GitHub Pages base path
 * ----------------------
 * - Project site  (https://<user>.github.io/<repo>/)  → '/<repo>/'
 * - User site     (https://<user>.github.io/)         → '/'
 * - Custom domain                                      → '/'
 *
 * The deploy workflow sets BASE_PATH automatically from `actions/configure-pages`,
 * which already knows which of the three cases applies. Locally it defaults to
 * '/'. To hard-code it instead, change DEFAULT_BASE.
 */
const DEFAULT_BASE = '/';

function normalizeBase(raw: string | undefined): string {
  const trimmed = (raw ?? DEFAULT_BASE).trim().replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}/` : '/';
}

/** `src/projects/<slug>/index.tsx` → chunk named `p-<slug>` for readable reports. */
const PROJECT_ENTRY = /[\\/]src[\\/]projects[\\/]([^\\/]+)[\\/]index\.tsx$/;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const base = normalizeBase(env.BASE_PATH);

  const plugins: PluginOption[] = [
    react(),
    VitePWA({
      // Deferred <script> injected into index.html: zero bytes in the JS bundle.
      injectRegister: 'script-defer',
      registerType: 'autoUpdate',
      manifest: {
        name: 'Waffle.fun',
        short_name: 'Waffle.fun',
        description: 'Small interactive things, made with code.',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#15110e',
        theme_color: '#15110e',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the hub shell (so it works offline) but NOT project JS or the
        // 3D vendor chunk: you only pay for what you open. Those are cached at
        // runtime, the first time a project is opened (see runtimeCaching).
        globPatterns: ['**/*.{js,css,html,svg,webmanifest}'],
        globIgnores: ['assets/p-*.js', 'assets/three-vendor-*.js', 'stats.html', '.vite/**'],
        navigateFallback: 'index.html',
        // Activate new deploys on the next navigation. (The plugin only sets
        // these automatically for injectRegister: 'auto', not 'script-defer'.)
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Content-hashed files never change → serve from cache forever.
            // This beats GitHub Pages' fixed `max-age=600` headers.
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.includes('/assets/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'waffle-assets',
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ];

  if (env.ANALYZE) {
    plugins.push(
      visualizer({
        filename: 'dist/stats.html',
        gzipSize: true,
        brotliSize: true,
        template: 'treemap',
      }) as PluginOption,
    );
  }

  return {
    base,
    plugins,
    build: {
      target: 'es2022',
      // Manifest lets scripts/size-report.mjs walk the real import graph.
      manifest: true,
      modulePreload: { polyfill: false },
      rolldownOptions: {
        output: {
          chunkFileNames(chunk) {
            const id = chunk.facadeModuleId ?? '';
            const m = PROJECT_ENTRY.exec(id);
            return m ? `assets/p-${m[1]}-[hash].js` : 'assets/[name]-[hash].js';
          },
          codeSplitting: {
            // Default `true` would pull React (a dependency of R3F) into
            // three-vendor, making the hub download three.js. Keep groups exact.
            includeDependenciesRecursively: false,
            groups: [
              {
                // Shared by every 3D project, downloaded once, cached forever.
                name: 'three-vendor',
                test: /node_modules[\\/](three|three-stdlib|@react-three|react-reconciler|its-fine|suspend-react|react-use-measure|camera-controls|maath|@use-gesture|troika[^\\/]*|meshline|stats-gl|tunnel-rat|detect-gpu)[\\/]/,
                priority: 2,
              },
              {
                // React: changes rarely, so cache separately from app code.
                name: 'react-vendor',
                test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
                priority: 1,
              },
            ],
          },
        },
      },
    },
  };
});
