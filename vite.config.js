/**
 * Vite 构建配置
 * - 开发时提供 HMR 热更新
 * - 生产构建输出到 dist/
 */
import { defineConfig } from 'vite';

export default defineConfig({
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
