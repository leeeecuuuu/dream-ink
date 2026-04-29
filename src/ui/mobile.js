/**
 * mobile.js — 移动端适配逻辑
 *
 * 使用能力检测（Feature Detection）替代 window.innerWidth 的粗暴判断。
 * - UI 布局判断使用 isNarrowScreen()（仍然基于宽度，因为这是布局决策）
 * - 功能禁用判断使用 supportsFileSystemAccess()（真正的能力检测）
 */

import { isNarrowScreen } from '../utils/feature-detect.js';

/**
 * 初始化移动端面板切换和自动跳转逻辑
 */
export function initMobile() {
  // ---------- 面板切换 ----------
  const panels = {
    left: document.querySelector('aside.left-panel'),
    center: document.querySelector('section.center-panel'),
    right: document.querySelector('aside.right-panel'),
  };

  /**
   * 切换面板显示
   * @param {'left'|'center'|'right'} target
   */
  function switchPanel(target) {
    if (!isNarrowScreen()) return;
    Object.entries(panels).forEach(([key, el]) => {
      if (!el) return;
      el.classList.toggle('panel-active', key === target);
    });
    // 更新 TabBar 激活状态
    document.querySelectorAll('.tab-btn[data-panel]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.panel === target);
    });
  }

  /**
   * 初始化面板状态（响应式）
   */
  function initPanelState() {
    if (isNarrowScreen()) {
      switchPanel('left');
    } else {
      // 桌面端清除 panel-active
      Object.values(panels).forEach((el) => {
        if (el) el.classList.remove('panel-active');
      });
    }
  }

  // 监听 TabBar 点击
  document.querySelectorAll('.tab-btn[data-panel]').forEach((btn) => {
    btn.addEventListener('click', () => switchPanel(btn.dataset.panel));
  });

  // 窗口 resize 时重置面板状态
  window.addEventListener('resize', initPanelState);
  initPanelState();

  // ---------- 生成完成后自动跳转画廊（移动端） ----------
  const runBtnEl = document.getElementById('runBtn');
  if (runBtnEl) {
    const runObserver = new MutationObserver(() => {
      if (isNarrowScreen() && runBtnEl.textContent.includes('开始创造')) {
        const resultArea = document.getElementById('resultArea');
        if (resultArea && resultArea.style.display !== 'none') {
          setTimeout(() => switchPanel('center'), 300);
        }
      }
    });
    runObserver.observe(runBtnEl, { childList: true, subtree: true });
  }
}
