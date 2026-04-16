import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@domain': resolve(__dirname, 'src/domain'),
      '@data': resolve(__dirname, 'src/data'),
      '@services': resolve(__dirname, 'src/services'),
      '@components': resolve(__dirname, 'src/components'),
      '@hooks': resolve(__dirname, 'src/hooks'),
      '@stores': resolve(__dirname, 'src/stores'),
      '@lib': resolve(__dirname, 'src/lib'),
      '@app-types': resolve(__dirname, 'src/types'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['preact', '@preact/signals', '@supabase/supabase-js'],
          domain: [
            resolve(__dirname, 'src/domain/criticality.ts'),
            resolve(__dirname, 'src/domain/skills.ts'),
            resolve(__dirname, 'src/domain/health.ts'),
            resolve(__dirname, 'src/domain/risks.ts'),
          ],
        },
      },
    },
  },
  server: { port: 3000 },
  // Env vars: only VITE_* are exposed to client
  envPrefix: 'VITE_',
});
