import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from 'vite-plugin-pwa';
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: false,
    headers: {
      // Security headers for development (CSP handled by vercel.json in production)
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
    }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'TankAlert',
        short_name: 'TankAlert',
        description: 'Real-time fuel tank monitoring and management system',
        theme_color: '#008457',
        background_color: '#ffffff',
        display: 'standalone',
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
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              }
            }
          },
          {
            urlPattern: /^https:\/\/.*\.tile\.openstreetmap\.org\/.*$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles-cache',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
              }
            }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: false, // Disable SW in dev to prevent port/caching issues
        type: 'module'
      }
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Force all packages to use the same React instance (React 19)
      // Fixes "Invalid hook call" error from @supabase/auth-ui-react
      'react': path.resolve(__dirname, './node_modules/react'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
    },
    // Deduplicate React to ensure single instance
    dedupe: ['react', 'react-dom'],
  },
  build: {
    // Enable advanced optimizations
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: true,
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching
        manualChunks: {
          // React and core libraries
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // UI library
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-tabs'],
          // Data management
          'data-vendor': ['@tanstack/react-query', 'zustand'],
          // Charts and visualization
          'charts-vendor': ['chart.js', 'react-chartjs-2', 'recharts', 'd3'],
          // Map libraries
          'map-vendor': ['leaflet', 'react-leaflet', 'leaflet.heat'],
          // Supabase
          'supabase-vendor': ['@supabase/supabase-js', '@supabase/auth-ui-react'],
        },
      },
    },
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
  },
  optimizeDeps: {
    // Pre-bundle these dependencies for faster dev startup
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@tanstack/react-query',
      'zustand',
      'leaflet',
      'react-leaflet',
    ],
  },
  // Enable advanced CSS optimizations
  css: {
    devSourcemap: true,
  },
});