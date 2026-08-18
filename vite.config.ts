// vite.config.ts

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'buffer': 'buffer', // ? ≈÷«·… alias ‰‡ buffer
    },
  },
  define: {
    'global': 'window', // ?  Ÿ—Í· global „‡ window
    'Buffer': ['buffer', 'Buffer'], // ?  Ÿ—Í· Buffer
  },
  optimizeDeps: {
    include: ['buffer'], // ?  ÷ÂÍÊ buffer ·Í «‰ Õ”ÍÊ
  },
});