/**
 * Vite 构建配置
 * - 开发时提供 HMR 热更新
 * - 生产构建输出到 dist/
 */
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: false },
      manifest: {
        name: 'DreamInk',
        short_name: 'DreamInk',
        description: '图像生成工作台',
        theme_color: '#000000',
        icons: [] // Optional, could add a placeholder icon if needed.
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']
      }
    })
  ],
  // 配置相对基础路径，解决部署后资源 404 的问题
  base: './',
  // 项目根目录即当前目录
  root: '.',
  // 开发服务器配置
  server: {
    port: 3000,
    open: true,
  },
  // 构建配置
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // 资源内联阈值 4KB
    assetsInlineLimit: 4096,
  },
});
