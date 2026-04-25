import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // The MUI icon packages include "use client" directives which cause extremely noisy build-time warnings
  // under Vite/Rollup. These are safe to ignore for this project and would otherwise flood CI/logs.
  build: {
    rollupOptions: {
      onwarn(warning, defaultHandler) {
        const message = String(warning?.message || '');
        if (
          message.includes('Module level directives cause errors when bundled') &&
          message.includes('"use client"')
        ) {
          return;
        }
        defaultHandler(warning);
      }
    }
  }
});

