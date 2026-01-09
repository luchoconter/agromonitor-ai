
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true,
        type: 'module',
      },
      includeAssets: ['icon-192.png', 'icon-512.png', 'manifest.json'],
      manifest: {
        name: 'Ing Arg. Msc. Enrique A Marcon (v.1.1)',
        short_name: 'Ing Arg. Msc. Enrique A Marcon (v.1.1)',
        start_url: '/',
        display: 'standalone',
        background_color: '#f8fafc',
        theme_color: '#16a34a',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ],
        share_target: {
          action: '/share-target',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: {
            title: 'name',
            text: 'description',
            url: 'link',
            files: [
              {
                name: 'routes',
                accept: ['application/gpx+xml', '.gpx']
              }
            ]
          }
        }
      }
    })
  ]
});
