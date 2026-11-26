import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Pisahkan library besar ke chunk sendiri.
// Tanpa ini seluruh dependency masuk ke satu berkas index-*.js (±3,4 MB)
// sehingga halaman pertama harus mengunduh semuanya lebih dulu.
const vendorGroups = [
  { name: 'vendor-react', test: /[\\/]node_modules[\\/](react|react-dom|scheduler|react-is)[\\/]/ },
  { name: 'vendor-router', test: /[\\/]node_modules[\\/](react-router|react-router-dom|@remix-run)[\\/]/ },
  { name: 'vendor-motion', test: /[\\/]node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/ },
  { name: 'vendor-charts', test: /[\\/]node_modules[\\/](recharts|d3-[^\\/]+|victory-vendor|internmap|decimal\.js-light)[\\/]/ },
  { name: 'vendor-pdf', test: /[\\/]node_modules[\\/](jspdf|jspdf-autotable)[\\/]/ },
  { name: 'vendor-canvas', test: /[\\/]node_modules[\\/](html2canvas|dompurify|purify\.es)[\\/]/ },
  { name: 'vendor-xlsx', test: /[\\/]node_modules[\\/]xlsx[\\/]/ },
  { name: 'vendor-editor', test: /[\\/]node_modules[\\/](react-quill|quill)[\\/]/ },
  { name: 'vendor-icons', test: /[\\/]node_modules[\\/]lucide-react[\\/]/ },
  { name: 'vendor-date', test: /[\\/]node_modules[\\/](date-fns|react-day-picker)[\\/]/ },
  { name: 'vendor-http', test: /[\\/]node_modules[\\/]axios[\\/]/ },
]

const manualChunks = (id) => {
  // Helper preload milik Vite ikut dipakai entry, jadi taruh di chunk "vendor"
  // yang memang sudah dimuat di awal. Kalau dibiarkan, Rollup bisa menaruhnya
  // di chunk lazy (mis. vendor-pdf) sehingga chunk tersebut ikut diunduh
  // padahal belum diperlukan.
  if (id.includes('vite/preload-helper') || id.includes('vite/modulepreload-polyfill')) {
    return 'vendor'
  }
  if (!id.includes('node_modules')) return undefined
  const group = vendorGroups.find((entry) => entry.test.test(id))
  return group ? group.name : 'vendor'
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // Target proxy disamakan dengan base URL API di `.env`, sehingga memindahkan
  // backend (artisan serve -> Apache/Nginx) cukup ubah satu variabel.
  const apiTarget = env.VITE_PROXY_TARGET || env.VITE_API_BASE_URL || 'http://localhost:8000'

  return {
    plugins: [react()],
    // Pre-bundle library PDF sejak server start. Tanpa ini, dynamic import
    // 'jspdf' / 'jspdf-autotable' (mis. saat Cetak Rapor PDF) memicu re-optimasi
    // Vite di tengah sesi, sehingga browser melempar
    // "Failed to fetch dynamically imported module" ke node_modules/.vite/deps.
    optimizeDeps: {
      include: ['jspdf', 'jspdf-autotable'],
    },
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          // `php artisan serve` hanya melayani SATU koneksi sekaligus. Keep-alive dari
          // Vite membuat koneksi menumpuk (TIME_WAIT/ESTABLISHED) sehingga request
          // berikutnya mengantre detik-detik. Tutup koneksi tiap request.
          agent: false,
          headers: { Connection: 'close' },
        },
        // Berkas storage (PDF lembar soal esai) ikut diproksy agar pdfjs bisa
        // meng-fetch byte secara same-origin (:3000 → :8000) tanpa kena CORS.
        '/storage': {
          target: apiTarget,
          changeOrigin: true,
          agent: false,
          headers: { Connection: 'close' },
        }
      }
    },
    build: {
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: { manualChunks },
      },
    },
  }
})
