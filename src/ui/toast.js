/**
 * toast.js — Toast 通知组件
 *
 * 使用 createElement 安全构建 DOM，不使用 innerHTML 拼接用户文本。
 */

import { $ } from '../utils/helpers.js';
import { el } from '../utils/dom.js';
import { errMap } from '../utils/helpers.js';

/**
 * 显示 Toast 通知
 * @param {string|Error} msg - 消息内容
 * @param {'success'|'error'} type - 通知类型
 */
export function showToast(msg, type = 'success') {
  const container = $('toastContainer');
  if (!container) return;

  // 统一提取字符串
  const rawText = typeof msg === 'string' ? msg : (msg?.message || String(msg));

  // 错误消息映射为用户友好文本
  let displayText = rawText;
  if (type === 'error') {
    for (const code in errMap) {
      if (rawText.includes(code)) {
        displayText = errMap[code];
        break;
      }
    }
  }

  // 安全构建 DOM（不使用 innerHTML 拼接用户文本）
  const toast = el('div', { className: `toast ${type}` },
    el('div', { style: 'font-size:1.2rem', textContent: type === 'success' ? '✅' : '❌' }),
    el('div', { style: 'font-size:0.9rem', textContent: displayText })
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
