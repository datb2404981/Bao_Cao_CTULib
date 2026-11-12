import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'

// Giữ đồng bộ CSP với public/_headers (Cloudflare Pages) và vercel.json.
// Inline styles vẫn cần thiết cho các Vue component hiện tại.
const securityHeaders = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' https: data: blob:",
    "connect-src 'self' https: ws: wss:",
    "form-action 'self'",
  ].join('; '),
  'X-Frame-Options': 'DENY',
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      headers: securityHeaders,
      proxy: {
        '/api': { target: env.VITE_API_PROXY_TARGET || 'http://localhost:8080', changeOrigin: false },
      },
    },
    preview: {
      headers: securityHeaders,
    },
  }
})
