import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// ── Build configuration ──────────────────────────────────────────────────
//
// `manualChunks` splits heavy third-party libraries into their own chunks
// so they:
//   1. Don't bloat the main bundle (recharts ~95KB, xlsx ~270KB, etc.).
//   2. Get cached independently — bumping a recharts patch doesn't
//      invalidate the rest of the app cache.
//   3. Are only fetched when the user actually triggers the code path
//      that uses them (combined with the dynamic `await import()` calls
//      in src/lib/exports.ts and React.lazy in pages).
//
// Note: `manualChunks` works by inspecting each module's resolved id.
// Returning a string assigns that module to a chunk with that name.
// Modules without a matching rule fall through to Vite's default
// chunking strategy.

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined
          // Charts — only used in ClienteFinanceSummary today, lazy-loaded
          // via React.lazy at the page level.
          if (id.includes('recharts') || id.includes('d3-')) return 'recharts'
          // PDF stack — jspdf + jspdf-autotable travel together, used
          // exclusively from src/lib/exports.ts via dynamic import.
          if (id.includes('jspdf')) return 'pdf-libs'
          // Spreadsheet — xlsx alone is ~270KB minified, biggest of the lot.
          if (id.includes('xlsx')) return 'xlsx'
          // PowerPoint — pptxgenjs lazy-loaded via dynamic import.
          if (id.includes('pptxgenjs')) return 'pptx'
          return undefined
        },
      },
    },
  },
})
