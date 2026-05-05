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
      // The `xlsx` package on the public npm registry is permanently
      // locked at 0.18.5 with two known high-severity CVEs (Prototype
      // Pollution + ReDoS). The official patches live behind SheetJS's
      // own CDN, which is blocked by the ALTEN corporate firewall.
      //
      // `@e965/xlsx` is a community-maintained mirror that auto-republishes
      // the latest SheetJS source to npm via GitHub Actions. Same code,
      // patched CVEs, accessible from corporate networks. The alias keeps
      // every `import ... from 'xlsx'` working untouched across the
      // codebase (lib/exports.ts, UsersPanel.tsx, ProjectsPanel.tsx).
      //
      // Revisit this if (a) the corporate proxy ever opens cdn.sheetjs.com,
      // or (b) Anillo 2 needs richer Excel features (styled cells, charts)
      // — at that point ExcelJS becomes a viable migration target.
      'xlsx': '@e965/xlsx',
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
          // The substring 'xlsx' also matches '@e965/xlsx' under
          // node_modules/@e965/xlsx/, so the alias above doesn't break
          // chunking — they share a single chunk under the 'xlsx' name.
          if (id.includes('xlsx')) return 'xlsx'
          // PowerPoint — pptxgenjs lazy-loaded via dynamic import.
          if (id.includes('pptxgenjs')) return 'pptx'
          return undefined
        },
      },
    },
  },
})
