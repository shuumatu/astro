import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { cp, mkdir, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectDirectory = dirname(fileURLToPath(import.meta.url))
const vditorDistribution = resolve(projectDirectory, 'node_modules/vditor/dist')

function localVditorAssets(): Plugin {
  return {
    name: 'local-vditor-assets',
    configureServer(server) {
      server.middlewares.use('/vditor-assets/dist', async (request, response, next) => {
        try {
          const relativePath = decodeURIComponent((request.url || '/').split('?')[0]).replace(/^\/+/, '')
          const assetPath = resolve(vditorDistribution, relativePath)
          if (!assetPath.startsWith(vditorDistribution)) return next()
          const content = await readFile(assetPath)
          response.setHeader('Content-Type', assetContentType(assetPath))
          response.end(content)
        } catch {
          next()
        }
      })
    },
    async writeBundle(options: { dir?: string }) {
      const outputDirectory = resolve(projectDirectory, options.dir || 'dist')
      const target = resolve(outputDirectory, 'vditor-assets/dist')
      await mkdir(dirname(target), { recursive: true })
      await cp(vditorDistribution, target, { recursive: true })
    },
  }
}

function assetContentType(path: string): string {
  if (path.endsWith('.js')) return 'text/javascript; charset=utf-8'
  if (path.endsWith('.css')) return 'text/css; charset=utf-8'
  if (path.endsWith('.svg')) return 'image/svg+xml'
  if (path.endsWith('.png')) return 'image/png'
  if (path.endsWith('.woff2')) return 'font/woff2'
  return 'application/octet-stream'
}

export default defineConfig({
  plugins: [vue(), localVditorAssets()],
  server: {
    port: 5173,
    proxy: {
      '/api': process.env.VITE_DEV_PROXY_TARGET || 'http://localhost:8080'
    }
  }
})
