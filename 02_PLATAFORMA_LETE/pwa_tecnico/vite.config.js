import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// 1. Importar el plugin
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),

    // 2. Añadir el plugin con su configuración
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Tesivil Reportes',
        short_name: 'Reportes',
        description: 'App de reportes de diagnóstico eléctrico.',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif)$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'images',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 30 * 24 * 60 * 60 // 30 Days
              }
            }
          },
          {
            // Cache the Google Fonts stylesheets with a stale-while-revalidate strategy.
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets'
            }
          },
          {
            urlPattern: /^\/lete\/api\/.*$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 24 * 60 * 60 // 1 Day
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],

  base: '/lete/app/', 

  server: {
    port: 5174,
    // host: 'localhost', // Comentado para permitir acceso desde cualquier IP
    // hmr: {
    //   host: 'www.tesivil.com',
    //   protocol: 'wss',
    // },
    // allowedHosts: ['www.tesivil.com']
  }
})
