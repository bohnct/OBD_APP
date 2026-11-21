/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// `base` is the GitHub Pages sub-path (https://<user>.github.io/<repo>/).
// Override with BASE_PATH when deploying somewhere else.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  // Shown in settings so it's easy to tell which version is running.
  define: { __BUILD_TIME__: JSON.stringify(new Date().toISOString()) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      workbox: { globPatterns: ['**/*.{js,css,html,svg,woff2}'] },
      manifest: {
        name: 'OBD Gauges',
        short_name: 'Gauges',
        description: 'Read-only engine gauges over a Bluetooth OBD adapter.',
        display: 'fullscreen',
        orientation: 'landscape',
        background_color: '#000000',
        theme_color: '#000000',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: { include: ['src/safety/**'] },
  },
});
