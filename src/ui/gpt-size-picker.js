/**
 * gpt-size-picker.js — GPT Image-2 画幅尺寸选择器
 *
 * 根据 OpenAI 官方文档提供 gpt-image-2 支持的预设尺寸方块、
 * 自定义尺寸输入（约束自动校验），替换旧的 ratio-dropdown.js。
 *
 * 参考: https://developers.openai.com/cookbook/examples/multimodal/image-gen-models-prompting-guide
 *
 * gpt-image-2 约束：
 *   - 长边 < 3840px（安全值 3824）
 *   - 两边均为 16 的倍数
 *   - 长短边比例 ≤ 3:1
 *   - 总像素 655,360 ~ 8,294,400
 *   - 超过 2560×1440 属实验性
 */

import { $, ls } from '../utils/helpers.js';
import { bus } from '../utils/event-bus.js';
import { gcd } from '../state/model-capabilities.js';

// ---------------------------------------------------------------------------
// gpt-image-2 预设尺寸（来自官方文档 Popular gpt-image-2 sizes）
// 参考: https://developers.openai.com/cookbook/examples/multimodal/image-gen-models-prompting-guide
// ---------------------------------------------------------------------------

const GPT_PRESETS = [
  { label: 'Square',       size: '1024x1024', desc: '通用默认' },
  { label: 'HD Portrait',  size: '1024x1536', desc: '竖版高清' },
  { label: 'HD Landscape', size: '1536x1024', desc: '横版高清' },
  { label: '2K / QHD',     size: '2560x1440', desc: '宽屏推荐上限' },
  { label: '4K / UHD',     size: '3824x2144', desc: '实验性' },
];

// ---------------------------------------------------------------------------
// 辅助
// ---------------------------------------------------------------------------

function ratioLabel(w, h) {
  const d = gcd(w, h) || 1;
  return `${w / d}:${h / d}`;
}

// ---------------------------------------------------------------------------
// 状态
// ---------------------------------------------------------------------------

let useCustom = false;

function getCustomWidth() {
  return parseInt($('customWidth')?.value) || 1024;
}

function getCustomHeight() {
  return parseInt($('customHeight')?.value) || 1024;
}

/**
 * 同步 ratioSelect 隐藏字段 + customWidth/customHeight 值
 */
function syncRatioSelect() {
  const rs = $('ratioSelect');
  const cw = $('customWidth');
  const ch = $('customHeight');

  if (useCustom) {
    const rawW = Math.max(256, getCustomWidth());
    const rawH = Math.max(256, getCustomHeight());
    let w = rawW;
    let h = rawH;
    // 约束校验（与 generator.js 内校验逻辑对齐）
    // 长边 < 3840 → 安全值 3824
    w = Math.min(w, 3824);
    h = Math.min(h, 3824);
    // 16px 对齐
    w = Math.round(w / 16) * 16;
    h = Math.round(h / 16) * 16;
    // 比例 ≤ 3:1
    if (w / h > 3) w = h * 3;
    if (h / w > 3) h = w * 3;
    // 像素范围
    while (w * h > 8294400) { w = Math.round(w * 0.96); h = Math.round(h * 0.96); }
    while (w * h < 655360) { w = Math.round(w * 1.04); h = Math.round(h * 1.04); }
    // 再次 16px 对齐
    w = Math.max(256, Math.round(w / 16) * 16);
    h = Math.max(256, Math.round(h / 16) * 16);

    rs.value = `${w}x${h}`;
    if (cw) cw.value = w;
    if (ch) ch.value = h;

    // 约束反馈：如果输入被调整，提示用户
    const hint = $('gptSizeHint');
    if (hint && (w !== rawW || h !== rawH)) {
      const reasons = [];
      if (rawW > 3824 || rawH > 3824) reasons.push('长边限 3824');
      if (w !== Math.round(rawW / 16) * 16 || h !== Math.round(rawH / 16) * 16) reasons.push('16px 对齐');
      if (rawW / rawH > 3 || rawH / rawW > 3) reasons.push('比例 ≤ 3:1');
      hint.textContent = `已调整为 ${w}×${h}（${reasons.join('，')}）`;
      hint.style.color = 'var(--accent)';
      clearTimeout(window._gptHintTimeout);
      window._gptHintTimeout = setTimeout(() => {
        if (hint) { hint.textContent = `当前: ${(rs.value || '').replace('x', '×')}`; hint.style.color = ''; }
      }, 2500);
    }
  }
}

// ---------------------------------------------------------------------------
// UI 渲染
// ---------------------------------------------------------------------------

function renderGptSizeGrid() {
  const grid = $('gptSizeGrid');
  const hint = $('gptSizeHint');
  const customBox = $('gptCustomSize');
  if (!grid) return;

  const currentSize = $('ratioSelect')?.value || '1024x1024';

  grid.innerHTML = '';

  // 自定义模式
  if (useCustom) {
    grid.classList.add('hidden');
    if (customBox) customBox.classList.remove('hidden');
    if (hint) hint.textContent = '使用下方自定义宽高 · 自动对齐 gpt-image-2 约束';
    return;
  }

  grid.classList.remove('hidden');
  if (customBox) customBox.classList.add('hidden');

  // 渲染预设方块
  for (const preset of GPT_PRESETS) {
    const isActive = preset.size === currentSize;

    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = `gpt-size-tile${isActive ? ' active' : ''}`;
    tile.dataset.size = preset.size;
    tile.innerHTML = `
      <span class="gpt-size-tile-label">${preset.label}</span>
      <span class="gpt-size-tile-dims">${preset.size.replace('x', ' × ')}</span>
      <span class="gpt-size-tile-sub">${preset.desc}</span>
    `;
    tile.onclick = () => selectPresetSize(preset.size);
    grid.appendChild(tile);
  }

  // 自定义入口方块
  const customTile = document.createElement('button');
  customTile.type = 'button';
  customTile.className = `gpt-size-tile gpt-size-tile-custom${useCustom ? ' active' : ''}`;
  customTile.innerHTML = `
    <span class="material-symbols-outlined gpt-size-tile-icon">edit_square</span>
    <span class="gpt-size-tile-label">自定义</span>
    <span class="gpt-size-tile-sub">手动输入</span>
  `;
  customTile.onclick = () => enterCustomMode();
  grid.appendChild(customTile);

  if (hint) hint.textContent = `当前: ${currentSize.replace('x', '×')} · ${ratioLabelFromSize(currentSize)}`;
}

function ratioLabelFromSize(size) {
  const [w, h] = size.split('x').map(Number);
  if (!w || !h) return '';
  return ratioLabel(w, h);
}

function updateTileHighlight() {
  const currentSize = $('ratioSelect')?.value || '1024x1024';
  document.querySelectorAll('.gpt-size-tile').forEach((tile) => {
    tile.classList.toggle('active', tile.dataset.size === currentSize && !useCustom);
  });
}

// ---------------------------------------------------------------------------
// 操作
// ---------------------------------------------------------------------------

function selectPresetSize(size) {
  useCustom = false;
  $('ratioSelect').value = size;
  ls('nanscript_ratioSelect', size);

  // 清空自定义输入值
  const cw = $('customWidth');
  const ch = $('customHeight');
  if (cw) cw.value = '';
  if (ch) ch.value = '';

  renderGptSizeGrid();
  bus.emit('preview:update');
}

function enterCustomMode() {
  useCustom = true;

  // 初始化自定义输入框为当前值或默认值
  const cw = $('customWidth');
  const ch = $('customHeight');

  const currentSize = $('ratioSelect')?.value || '1024x1024';
  const [w, h] = currentSize.split('x').map(Number);

  if (cw) cw.value = w || 1024;
  if (ch) ch.value = h || 1024;

  syncRatioSelect();
  renderGptSizeGrid();
  bus.emit('preview:update');
}

function backToPresets() {
  useCustom = false;
  // 恢复默认预设值
  $('ratioSelect').value = '1024x1024';
  ls('nanscript_ratioSelect', '1024x1024');
  renderGptSizeGrid();
  bus.emit('preview:update');
}

// ---------------------------------------------------------------------------
// 兼容 form-persistence.js 的全局回调
// ---------------------------------------------------------------------------

function updateRatioUI(value) {
  if (!value) return;
  // 检查是否是预设尺寸
  const isPreset = GPT_PRESETS.some((p) => p.size === value);
  if (isPreset) {
    useCustom = false;
    selectPresetSize(value);
  } else {
    // 非预设尺寸 → 可能是自定义或历史恢复
    useCustom = true;
    const [w, h] = value.split('x').map(Number);
    const cw = $('customWidth');
    const ch = $('customHeight');
    if (cw && w) cw.value = w;
    if (ch && h) ch.value = h;
    syncRatioSelect();
    renderGptSizeGrid();
  }
}

// ---------------------------------------------------------------------------
// 初始化
// ---------------------------------------------------------------------------

export function initGptSizePicker() {
  // 恢复上次选择
  const saved = ls('nanscript_ratioSelect');
  if (saved) {
    const isPreset = GPT_PRESETS.some((p) => p.size === saved);
    if (isPreset) {
      useCustom = false;
      $('ratioSelect').value = saved;
    } else if (/^\d+x\d+$/i.test(saved)) {
      useCustom = true;
      const [w, h] = saved.split('x').map(Number);
      const cw = $('customWidth');
      const ch = $('customHeight');
      if (cw && w) cw.value = w;
      if (ch && h) ch.value = h;
      syncRatioSelect();
    } else {
      $('ratioSelect').value = '1024x1024';
    }
  }

  // 绑定返回预设按钮
  const backBtn = $('gptBackToPresetBtn');
  if (backBtn) backBtn.onclick = backToPresets;

  // 绑定自定义尺寸输入事件
  const cw = $('customWidth');
  const ch = $('customHeight');
  if (cw) {
    cw.oninput = () => {
      if (!useCustom) return;
      syncRatioSelect();
      bus.emit('preview:update');
    };
  }
  if (ch) {
    ch.oninput = () => {
      if (!useCustom) return;
      syncRatioSelect();
      bus.emit('preview:update');
    };
  }

  // 初始渲染
  renderGptSizeGrid();

  // 兼容 form-persistence.js 的 window._updateRatioUI 回调
  window._updateRatioUI = updateRatioUI;
}
