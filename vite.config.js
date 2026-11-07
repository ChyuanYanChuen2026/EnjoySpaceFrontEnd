import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
export default defineConfig(async ({ mode }) => {
  const plugins = [vue()]

  // 只有 Cloudflare 模式才載入外掛及 Worker 執行環境。
  if (mode === 'cloudflare') {
    const { cloudflare } = await import('@cloudflare/vite-plugin')
    plugins.push(cloudflare())
    return { plugins, build: { outDir: 'dist-cloudflare' } }
  }

  // 一般開發與預覽沿用本機後台，不經過 Cloudflare Worker。
  const env = loadEnv(mode, process.cwd(), '')
  const proxy = {
    '/api': {
      target: env.API_PROXY_TARGET || 'http://localhost:5209', changeOrigin: true
    }
  }
  return {
    plugins,
    // 僅掃描網站入口，避免舊測試預覽頁與雲端建置產物被當成開發入口。
    optimizeDeps: { entries: ['index.html'] },
    server: {
      host: env.PORTAL_DEV_HOST || '0.0.0.0',
      port: 4000,
      strictPort: true,
      watch: { ignored: ['**/dist-cloudflare/**', '**/.wrangler/**'] },
      proxy
    }, preview: { proxy }
  }
})
