import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(), // Tailwind v4 Vite plugin (replaces PostCSS plugin)
    react(),
  ],

  base: './',

  build: {
    outDir: 'dist',
    emptyOutDir: false,
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  // Prevent Vite from bundling Electron internals or Node built-ins
  // into the renderer bundle — they must ONLY live in the main process.
  optimizeDeps: {
    exclude: ['electron'],
  },
});
