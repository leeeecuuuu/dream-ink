/**
 * toast.js — Toast 通知组件
 *
 * 使用 createElement 安全构建 DOM，不使用 innerHTML 拼接用户文本。
 *
 * 改进：
 *  - Material Symbols 替代 emoji
 *  - 关闭按钮 + 最大堆叠数 5 条
 *  - aria-live 屏幕阅读器播报
 *  - 精确错误匹配（正则）
 */

import { $ } from '../utils/helpers.js';
import { el, icon } from '../utils/dom.js';
import { errMap } from '../utils/helpers.js';

const MAX_TOASTS = 5;

/**
 * 显示 Toast 通知
 * @param {string|Error} msg - 消息内容
 * @param {'success'|'error'} type - 通知类型
 */
export function showToast(msg, type = 'success') {
  const container = $('toastContainer');
  if (!container) return;

  // 堆叠上限：移除最旧的 toast
  while (container.children.length >= MAX_TOASTS) {
    const oldest = container.firstElementChild;
    if (oldest) {
      oldest.classList.add('fade-out');
      setTimeout(() => oldest.remove(), 300);
    }
  }

  // 统一提取字符串
  const rawText = typeof msg === 'string' ? msg : (msg?.message || String(msg));

  // 错误消息映射为用户友好文本（使用正则精确匹配）
  let displayText = rawText;
  if (type === 'error') {
    for (const code in errMap) {
      const pattern = new RegExp(`(\\b|status:\\s*)${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (pattern.test(rawText)) {
        displayText = errMap[code];
        break;
      }
    }
  }

  // 安全构建 DOM
  const toastIcon = icon(
    type === 'success' ? 'check_circle' : 'error',
    'text-[20px] flex-shrink-0'
  );

  const msgEl = el('span', {
    className: 'toast-msg',
    textContent: displayText,
  });

  const closeBtn = el('button', {
    className: 'toast-close',
    title: '关闭',
    type: 'button',
  }, icon('close', 'text-[16px]'));

  closeBtn.onclick = () => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  };

  const toast = el('div', { className: `toast ${type}` },
    toastIcon,
    msgEl,
    closeBtn
  );

  container.appendChild(toast);

  // 5 秒后淡出移除
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

/**
 * 覆写 window.alert 为 Toast 错误提示
 * 保持原有行为兼容
 */
export function overrideAlert() {
  window.alert = (msg) => showToast(msg, 'error');
}
