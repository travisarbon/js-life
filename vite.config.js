import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/js-life/',
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
