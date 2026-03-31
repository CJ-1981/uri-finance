import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { readFileSync } from "fs";
import { resolve } from "path";
import { VitePWA } from 'vite-plugin-pwa';

// @MX:NOTE: Dev server plugin to redirect /uri-finance to / in development
// This allows accessing the app with either http://localhost:8080 or http://localhost:8080/uri-finance
function devBasePathRedirect() {
  return {
    name: 'dev-base-path-redirect',
    configureServer(server: { middlewares: { use: (handler: (req: any, res: any, next: () => void) => void) => void } }) {
      // Register as pre-middleware (runs before Vite's internal middlewares)
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';

        // Redirect /uri-finance and /uri-finance/* to /*
        if (url.startsWith('/uri-finance')) {
          const newPath = url.slice('/uri-finance'.length) || '/';
          console.log('[DevRedirect] Redirecting', url, '->', newPath);
          // 302 redirect to the correct path
          res.writeHead(302, { Location: newPath });
          res.end();
          return;
        }

        next();
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const base = mode === 'development' ? '/' : (process.env.VITE_BASE_URL || "/uri-finance/");
  
  return {
    // @MX:NOTE: Use base="/uri-finance/" for production builds, base="/" for development
    // This prevents 404 errors when refreshing pages during development
    base,
    define: {
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
      __APP_VERSION__: JSON.stringify(JSON.parse(readFileSync(resolve(__dirname, './package.json'), 'utf-8')).version),
    },
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: false, // Handled manually in main.tsx
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'robots.txt'],
        manifest: {
          name: 'URI Finance',
          short_name: 'URI Finance',
          description: 'Track your personal and project finances securely.',
          theme_color: '#ffffff',
          icons: [
            {
              src: 'icon-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'icon-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'icon-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          // Ensure service worker works correctly with GitHub Pages base path
          navigateFallback: `${base}index.html`,
        }
      }),
      mode === 'development' && devBasePathRedirect(),
      mode === "development" && componentTagger()
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});

// Cache busting: 2026-03-30
