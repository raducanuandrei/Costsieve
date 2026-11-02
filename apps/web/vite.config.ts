import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import { fileURLToPath } from 'node:url';
import { cp, mkdir } from 'node:fs/promises';

export default defineConfig({
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss(), {
    name: 'costsieve-local-assets',
    async closeBundle() {
      const target = fileURLToPath(new URL('./dist/costsieve-assets/', import.meta.url));
      await mkdir(target, { recursive: true });
      await cp(fileURLToPath(new URL('../../packages/imports/assets/', import.meta.url)), target, { recursive: true });
    },
  }],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
});
