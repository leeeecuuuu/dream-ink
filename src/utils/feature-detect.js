/**
 * feature-detect.js — 能力检测模块
 *
 * 用 Feature Detection 替代 window.innerWidth 的粗暴判断。
 * 依据浏览器的真实能力（API 可用性）决定是否启用特定功能，
 * 而非依据屏幕宽度做平台假设。
 */

/**
 * 检测是否支持 File System Access API（showDirectoryPicker）
 * - 真正的能力检测，不依赖屏幕宽度
 * - 部分移动端 Chrome 也不支持此 API
 * @returns {boolean}
 */
export function supportsFileSystemAccess() {
  return (
    typeof window !== 'undefined' &&
    'showDirectoryPicker' in window &&
    typeof window.showDirectoryPicker === 'function'
  );
}

/**
 * 检测是否为触摸优先设备（用于 UI 布局决策）
 * - 使用 CSS 媒体查询能力检测而非固定宽度
 * - 结合 pointer: coarse（触摸）和 hover: none（无悬停能力）
 * @returns {boolean}
 */
export function isTouchDevice() {
  // 优先使用 CSS 媒体查询能力检测
  if (window.matchMedia) {
    // pointer: coarse 表示主输入设备是粗精度的（触摸屏）
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
    // hover: none 表示主输入设备不支持悬停
    const noHover = window.matchMedia('(hover: none)').matches;
    // 两者同时满足时，高度确定为触摸优先设备
    if (coarsePointer && noHover) return true;
  }
  // 降级：检查是否支持触摸事件 + 触摸点大于 0
  return 'ontouchstart' in window && navigator.maxTouchPoints > 0;
}

/**
 * 检测当前是否为窄屏布局（移动端 UI 模式）
 * - 仅用于 UI 布局决策（面板切换、TabBar 显隐等）
 * - 不应用于功能禁用的判断（功能禁用应走能力检测）
 * @returns {boolean}
 */
export function isNarrowScreen() {
  return window.innerWidth <= 768;
}

/**
 * 检测是否支持 Clipboard API（navigator.clipboard.write）
 * @returns {boolean}
 */
export function supportsClipboardWrite() {
  return (
    navigator.clipboard &&
    typeof navigator.clipboard.write === 'function' &&
    typeof ClipboardItem !== 'undefined'
  );
}
