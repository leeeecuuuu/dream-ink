/**
 * theme.js — 主题切换模块
 *
 * 支持三种模式：auto（跟随系统）、dark、light
 * 使用 CSS class + data-theme 属性双重控制
 */

import { $, ls } from '../utils/helpers.js';
import { el, icon } from '../utils/dom.js';

/**
 * 初始化主题切换功能
 */
export function initTheme() {
  const html = document.documentElement;
  const tBtn = $('themeToggle');
  if (!tBtn) return;

  /**
   * 设置主题
   * @param {'auto'|'dark'|'light'} theme
   */
  const setTheme = (theme) => {
    html.setAttribute('data-theme', theme);
    ls('theme', theme);

    let isDark = false;
    // 使用 textContent + icon 安全构建按钮内容
    const iconName =
      theme === 'auto' ? 'hdr_auto' : theme === 'dark' ? 'dark_mode' : 'light_mode';

    // 安全更新按钮内容（不使用 innerHTML）
    tBtn.replaceChildren(icon(iconName, 'text-[20px]'));

    if (theme === 'auto') {
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    } else {
      isDark = theme === 'dark';
    }

    if (isDark) html.classList.add('dark');
    else html.classList.remove('dark');
  };

  // 监听系统主题变化
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', (e) => {
      if (ls('theme') === 'auto') {
        if (e.matches) html.classList.add('dark');
        else html.classList.remove('dark');
      }
    });

  // 初始化当前主题
  setTheme(ls('theme') || 'auto');

  // 绑定切换按钮：auto → dark → light → auto
  tBtn.onclick = () => {
    const cur = ls('theme') || 'auto';
    if (cur === 'auto') setTheme('dark');
    else if (cur === 'dark') setTheme('light');
    else setTheme('auto');
  };
}
