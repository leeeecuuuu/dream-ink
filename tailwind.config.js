/**
 * Tailwind CSS v3 配置
 * 从原 index.html 中的 <script> 内联配置迁移而来
 */
/** @type {import('tailwindcss').Config} */
export default {
  // 深色模式由 class 控制
  darkMode: 'class',
  // 扫描内容源
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: 'var(--accent)',
        'primary-container': 'var(--accent)',
        'on-primary-container': '#ffffff',
        'primary-fixed-variant': 'var(--accent-hover)',
        'on-primary-fixed-variant': '#ffffff',
        surface: 'var(--bg-primary)',
        'surface-container-lowest': 'var(--bg-secondary)',
        'surface-container-low': 'var(--bg-tertiary)',
        'surface-container': 'var(--bg-tertiary)',
        'surface-container-high': 'var(--input-bg)',
        'surface-container-highest': 'var(--input-bg)',
        'on-surface': 'var(--text-primary)',
        'on-surface-variant': 'var(--text-secondary)',
        outline: 'var(--text-muted)',
        'outline-variant': 'var(--border-color)',
        error: 'var(--error-text)',
        success: 'var(--success-text)',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        headline: ['Inter', 'sans-serif'],
        display: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries'),
  ],
};
