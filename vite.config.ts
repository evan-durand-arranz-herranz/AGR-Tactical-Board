import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const host = process.env.TAURI_DEV_HOST

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
  ],

  // Tauri — ne pas vider la console (les logs Rust s'affichent dedans)
  clearScreen: false,

  server: {
    port: 5173,
    strictPort: true,
    // Nécessaire pour le hot-reload Tauri sur certains OS
    host: host ?? false,
    hmr: host
      ? { protocol: 'ws', host, port: 5183 }
      : undefined,
    watch: {
      // Évite de surveiller les sources Rust (redémarrages inutiles)
      ignored: ['**/src-tauri/**'],
    },
  },

  envPrefix: ['VITE_', 'TAURI_ENV_*'],

  build: {
    // WebView2 (Windows) = Chrome ≥ 105, WebKit (macOS) = Safari ≥ 15
    target: ['es2021', 'chrome105', 'safari15'],
    minify: !process.env.TAURI_ENV_DEBUG,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
})
