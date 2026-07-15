import { readFileSync } from 'node:fs'

import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { defineConfig } from 'vitest/config'

const thirdPartyNotices = readFileSync(new URL('./docs/THIRD_PARTY_NOTICES.txt', import.meta.url), 'utf8')
const offlineLicensePlugin = () => ({
  name: 'offline-license-notice',
  enforce: 'post' as const,
  transformIndexHtml: () => [{
    tag: 'script',
    attrs: { id: 'third-party-notices', type: 'text/plain' },
    children: thirdPartyNotices,
    injectTo: 'body' as const,
  }],
})

export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'offline' ? [viteSingleFile(), offlineLicensePlugin()] : [])],
  base: mode === 'offline' ? './' : mode === 'pages' ? '/nixu-dangan/' : undefined,
  build: mode === 'offline'
    ? {
        outDir: 'dist-offline',
        emptyOutDir: true,
      }
    : undefined,
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  test: {
    environment: 'node',
    coverage: {
      reporter: ['text', 'html'],
    },
  },
}))
