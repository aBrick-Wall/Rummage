import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import type { Plugin } from 'vite'

const alias = { '@shared': resolve('src/shared') }

const PROD_CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: rummage-media:",
  "media-src 'self' rummage-media:",
  "font-src 'self'",
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'"
].join('; ')

// Vite's dev server needs inline styles for HMR and a websocket back to itself.
const DEV_CSP = PROD_CSP.replace("style-src 'self'", "style-src 'self' 'unsafe-inline'")
  .replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")
  .replace("connect-src 'none'", "connect-src 'self' ws://localhost:* http://localhost:*")

function contentSecurityPolicy(): Plugin {
  return {
    name: 'rummage-csp',
    transformIndexHtml(html, ctx) {
      const csp = ctx.server ? DEV_CSP : PROD_CSP
      return html.replace(
        '<!--CSP-->',
        `<meta http-equiv="Content-Security-Policy" content="${csp}" />`
      )
    }
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias },
    build: { rollupOptions: { input: { index: resolve('src/main/index.ts') } } }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias },
    build: {
      rollupOptions: {
        input: { index: resolve('src/preload/index.ts') },
        // Sandboxed preload scripts must be a single CommonJS file.
        output: { format: 'cjs', entryFileNames: '[name].js' }
      }
    }
  },
  renderer: {
    root: resolve('src/renderer'),
    plugins: [react(), contentSecurityPolicy()],
    resolve: { alias },
    build: { rollupOptions: { input: { index: resolve('src/renderer/index.html') } } }
  }
})
