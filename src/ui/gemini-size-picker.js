/**
 * gemini-size-picker.js — Gemini 子模型 & 画幅尺寸选择器
 *
 * 在 Banana 引擎面板中提供三个 Nano Banana 子模型的选择，
 * 并根据 model-capabilities.js 官方尺寸表展示画幅比例和分辨率。
 *
 * 参考: https://ai.google.dev/gemini-api/docs/image-generation
 */

import { $, ls } from '../utils/helpers.js';
import { state, GEMINI_MODELS } from '../state/app-state.js';
import { lookupPixelSize, sizeLabelToK, parsePixelSize, getModelConstraints } from '../state/model-capabilities.js';
import { bus } from '../utils/event-bus.js';
import { showToast } from './toast.js';

// ---------------------------------------------------------------------------
// 模型感知的像素尺寸查询
// ---------------------------------------------------------------------------

/**
 * 获取模型在指定比例/分辨率下的官方像素尺寸 {w, h}
 * 直接查官方尺寸表，不再使用通用 K 值公式推导。
 */
function getModelPixelSize(model, ratio, sizeLabel) {
  const pixelStr = lookupPixelSize(model.key, sizeLabel, ratio);
  if (pixelStr) return parsePixelSize(pixelStr);
  // 极端 fallback：从官方表查不到时用通用公式（理论上不应走到这）
  return calcPixelSizeFallback(ratio, sizeLabelToK(sizeLabel));
}

/** 通用宽高比计算（仅用于 fallback，不应作为主要逻辑） */
function calcPixelSizeFallback(ratio, kPixels) {
  const [rw, rh] = ratio.split(':').map(Number);
  if (!rw || !rh) return { w: kPixels, h: kPixels };
  if (rw > rh) return { w: kPixels, h: Math.round(kPixels * rh / rw) };
  if (rh > rw) return { w: Math.round(kPixels * rw / rh), h: kPixels };
  return { w: kPixels, h: kPixels };
}

// ---------------------------------------------------------------------------
// 构建像素尺寸速查表（供 generator.js 扩展参考 / OpenAI compat 映射）
// ---------------------------------------------------------------------------
// UI 渲染
// ---------------------------------------------------------------------------

/**
 * 渲染画幅比例选项网格
 */
function renderSizeGrid() {
  const grid = $('geminiSizeGrid');
  const hint = $('geminiSizeHint');
  const customBox = $('geminiCustomSize');
  if (!grid) return;

  const modelKey = state.geminiModelKey || 'nano-banana-2';
  const sizeLabel = state.geminiActiveSize || '1K';
  const model = GEMINI_MODELS[modelKey];
  if (!model) return;

  // Gemini 2.5 Flash 固定官方尺寸，不允许自定义
  const allowCustom = model.sizes.length > 1;

  if (!allowCustom && state.geminiUseCustom) {
    state.geminiUseCustom = false;
    ls('nanscript_geminiUseCustom', 'false');
  }

  const currentRatio = $('bananaAspectRatio')?.value || '1:1';

  // 清空网格
  grid.innerHTML = '';

  // 检查该模型是否支持当前选中的分辨率
  const isSizeSupported = model.sizes.includes(sizeLabel);
  const effectiveSize = isSizeSupported ? sizeLabel : (model.sizes[0] || '1K');
  if (!isSizeSupported) {
    state.geminiActiveSize = effectiveSize;
    ls('nanscript_geminiActiveSize', effectiveSize);
    renderSizeTabs();
  }

  // 更新提示文字
  if (hint) {
    if (state.geminiUseCustom) {
      hint.textContent = '使用下方自定义宽高';
    } else {
      hint.textContent = allowCustom
        ? `${model.name} · ${effectiveSize} — 点击选择预设画幅`
        : `${model.name} · 固定 1K — 使用官方尺寸表`;
    }
  }

  // 自定义尺寸模式：仅显示输入框
  if (state.geminiUseCustom) {
    grid.classList.add('hidden');
    if (customBox) {
      customBox.classList.remove('hidden');
      updateCustomConstraints();
    }
    return;
  }

  if (customBox) customBox.classList.add('hidden');
  grid.classList.remove('hidden');

  // 生成画幅比选项（使用安全 DOM，不用 innerHTML）
  for (const ratio of model.ratios) {
    const ps = getModelPixelSize(model, ratio, effectiveSize);
    if (!ps) continue;
    const isActive = ratio === currentRatio && !state.geminiUseCustom;

    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = `gemini-ratio-tile${isActive ? ' active' : ''}`;
    tile.dataset.ratio = ratio;

    const label = document.createElement('span');
    label.className = 'gemini-ratio-label';
    label.textContent = ratio;

    const pixels = document.createElement('span');
    pixels.className = 'gemini-ratio-pixels';
    pixels.textContent = `${ps.width} × ${ps.height}`;

    tile.append(label, pixels);
    tile.onclick = () => selectPresetRatio(ratio);
    grid.appendChild(tile);
  }

  // 只有多分辨率模型才提供自定义尺寸入口
  if (allowCustom) {
    const customTile = document.createElement('button');
    customTile.type = 'button';
    customTile.className = `gemini-ratio-tile gemini-ratio-tile-custom${state.geminiUseCustom ? ' active' : ''}`;

    const iconSpan = document.createElement('span');
    iconSpan.className = 'material-symbols-outlined gemini-ratio-custom-icon';
    iconSpan.textContent = 'edit_square';

    const labelSpan = document.createElement('span');
    labelSpan.className = 'gemini-ratio-label';
    labelSpan.textContent = '自定义';

    const pixelSpan = document.createElement('span');
    pixelSpan.className = 'gemini-ratio-pixels';
    pixelSpan.textContent = '手动输入';

    customTile.append(iconSpan, labelSpan, pixelSpan);
    customTile.onclick = () => {
      state.geminiUseCustom = true;
      ls('nanscript_geminiUseCustom', 'true');
      updateCustomConstraints();
      renderSizeGrid();
      syncHiddenFields();
      bus.emit('preview:update');
    };
    grid.appendChild(customTile);
  }
}

/**
 * 渲染分辨率标签栏
 */
function renderSizeTabs() {
  const tabs = $('geminiSizeTabs');
  if (!tabs) return;

  const modelKey = state.geminiModelKey || 'nano-banana-2';
  const model = GEMINI_MODELS[modelKey];
  if (!model) return;

  const activeSize = state.geminiActiveSize || '1K';

  tabs.innerHTML = '';

  for (const sizeLabel of model.sizes) {
    const isActive = sizeLabel === activeSize && !state.geminiUseCustom;
    const kPixels = sizeLabelToK(sizeLabel);

    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = `gemini-size-tab${isActive ? ' active' : ''}`;
    tab.dataset.size = sizeLabel;
    tab.textContent = sizeLabel === '512' ? '0.5K' : sizeLabel;
    tab.title = `长边 ≈ ${kPixels}px`;

    tab.onclick = () => {
      if (state.geminiUseCustom) {
        state.geminiUseCustom = false;
        ls('nanscript_geminiUseCustom', 'false');
      }
      state.geminiActiveSize = sizeLabel;
      ls('nanscript_geminiActiveSize', sizeLabel);
      $('bananaImageSize').value = sizeLabel;
      renderSizeTabs();
      renderSizeGrid();
      bus.emit('preview:update');
    };

    tabs.appendChild(tab);
  }
}

/**
 * 更新自定义尺寸输入的约束提示（使用模型感知的 maxDimension）
 */
function updateCustomConstraints() {
  const modelKey = state.geminiModelKey || 'nano-banana-2';
  const constraints = getModelConstraints(modelKey);
  const maxDim = constraints.maxDimension;

  const hint = $('geminiCustomConstraint');
  if (hint) hint.textContent = `(最大 ${maxDim}×${maxDim}px)`;

  const wInput = $('geminiCustomWidth');
  const hInput = $('geminiCustomHeight');
  if (wInput) {
    wInput.max = maxDim;
    wInput.value = state.geminiCustomWidth || maxDim;
  }
  if (hInput) {
    hInput.max = maxDim;
    hInput.value = state.geminiCustomHeight || maxDim;
  }
}

// ---------------------------------------------------------------------------
// 操作
// ---------------------------------------------------------------------------

/**
 * 选择预设画幅比例
 */
function selectPresetRatio(ratio) {
  if (state.geminiUseCustom) {
    state.geminiUseCustom = false;
    ls('nanscript_geminiUseCustom', 'false');
  }

  $('bananaAspectRatio').value = ratio;

  const sizeLabel = state.geminiActiveSize || '1K';
  $('bananaImageSize').value = sizeLabel;

  ls('nanscript_bananaAspectRatio', ratio);
  ls('nanscript_bananaImageSize', sizeLabel);

  renderSizeGrid();
  renderSizeTabs();
  bus.emit('preview:update');
}

/**
 * 同步隐藏字段值（给 generator.js 读取）
 */
function syncHiddenFields() {
  const modelKey = state.geminiModelKey || 'nano-banana-2';
  const sizeLabel = state.geminiActiveSize || '1K';

  if (state.geminiUseCustom) {
    const w = state.geminiCustomWidth || 1024;
    const h = state.geminiCustomHeight || 1024;
    const constraints = getModelConstraints(modelKey);
    const snappedW = Math.max(256, Math.round(w / constraints.step) * constraints.step);
    const snappedH = Math.max(256, Math.round(h / constraints.step) * constraints.step);
    $('bananaAspectRatio').value = `${snappedW}x${snappedH}`;
    $('bananaImageSize').value = sizeLabel;
  } else {
    $('bananaAspectRatio').value = $('bananaAspectRatio').value || '1:1';
    $('bananaImageSize').value = sizeLabel;
  }
}

/**
 * 选择 Gemini 子模型
 */
function selectGeminiModel(modelKey) {
  const model = GEMINI_MODELS[modelKey];
  if (!model) return;

  state.geminiModelKey = modelKey;
  ls('nanscript_geminiModelKey', modelKey);

  // 固定尺寸模型关闭自定义模式
  if (model.sizes.length === 1 && state.geminiUseCustom) {
    state.geminiUseCustom = false;
    ls('nanscript_geminiUseCustom', 'false');
    showToast(`${model.name} 仅支持官方 1K 预设尺寸，已关闭自定义尺寸`);
  }

  // 更新模型名称到 modelGemini 输入框（geminiModelKey 为唯一可信来源）
  const mg = $('modelGemini');
  if (mg) {
    mg.value = model.modelName;
    ls('nanscript_modelGemini', model.modelName);
  }

  // 更新桥接字段
  const mi = $('modelInput');
  if (mi) mi.value = model.modelName;

  // 如果当前分辨率不在新模型的列表中，回退到第一个
  const oldSize = state.geminiActiveSize;
  if (!model.sizes.includes(state.geminiActiveSize)) {
    state.geminiActiveSize = model.sizes[0] || '1K';
    ls('nanscript_geminiActiveSize', state.geminiActiveSize);
    showToast(`分辨率已从 ${oldSize} 调整为 ${state.geminiActiveSize}（${model.name} 不支持 ${oldSize}）`);
  }

  // 如果当前画幅比例不在新模型列表中，回退到 1:1
  const currentRatio = $('bananaAspectRatio')?.value || '1:1';
  if (!model.ratios.includes(currentRatio) && currentRatio.indexOf('x') === -1) {
    const oldRatio = currentRatio;
    $('bananaAspectRatio').value = '1:1';
    ls('nanscript_bananaAspectRatio', '1:1');
    showToast(`画幅比已从 ${oldRatio} 重置为 1:1（${model.name} 不支持 ${oldRatio}）`);
  }

  // 更新模型卡片激活态
  document.querySelectorAll('.gemini-model-card').forEach((card) => {
    card.classList.toggle('active', card.dataset.geminiModel === modelKey);
  });

  // 更新引擎提示文字
  const hint = $('engineModelHintText');
  if (hint) hint.textContent = `当前模型: ${model.modelName}`;

  // 重新渲染分辨率标签和画幅网格
  renderSizeTabs();
  renderSizeGrid();
  syncHiddenFields();
  bus.emit('preview:update');
}

// ---------------------------------------------------------------------------
// 初始化 & 事件绑定
// ---------------------------------------------------------------------------

export function initGeminiSizePicker() {
  // 绑定模型卡片点击事件
  document.querySelectorAll('.gemini-model-card').forEach((card) => {
    card.onclick = () => selectGeminiModel(card.dataset.geminiModel);
  });

  // 绑定自定义尺寸输入事件（使用模型感知的 maxDimension）
  const wInput = $('geminiCustomWidth');
  const hInput = $('geminiCustomHeight');

  if (wInput) {
    wInput.oninput = () => {
      const modelKey = state.geminiModelKey || 'nano-banana-2';
      const constraints = getModelConstraints(modelKey);
      const rawVal = Number(wInput.value) || 1024;
      const val = Math.max(256, Math.min(rawVal, constraints.maxDimension));
      state.geminiCustomWidth = val;
      syncHiddenFields();
      bus.emit('preview:update');
      // localStorage 写入防抖 300ms
      clearTimeout(wInput._debounce);
      wInput._debounce = setTimeout(() => {
        ls('nanscript_geminiCustomWidth', String(val));
      }, 300);
      // 约束反馈
      const snapped = Math.max(256, Math.round(val / constraints.step) * constraints.step);
      const hint = $('geminiSizeHint');
      if (hint && rawVal !== snapped) {
        hint.textContent = `已规整为 ${snapped}（${constraints.step}px 对齐）`;
        hint.style.color = 'var(--accent)';
        clearTimeout(wInput._hintTimeout);
        wInput._hintTimeout = setTimeout(() => {
          hint.textContent = '';
          hint.style.color = '';
        }, 2000);
      }
    };
  }

  if (hInput) {
    hInput.oninput = () => {
      const modelKey = state.geminiModelKey || 'nano-banana-2';
      const constraints = getModelConstraints(modelKey);
      const rawVal = Number(hInput.value) || 1024;
      const val = Math.max(256, Math.min(rawVal, constraints.maxDimension));
      state.geminiCustomHeight = val;
      syncHiddenFields();
      bus.emit('preview:update');
      // localStorage 写入防抖 300ms
      clearTimeout(hInput._debounce);
      hInput._debounce = setTimeout(() => {
        ls('nanscript_geminiCustomHeight', String(val));
      }, 300);
      // 约束反馈
      const snapped = Math.max(256, Math.round(val / constraints.step) * constraints.step);
      const hint = $('geminiSizeHint');
      if (hint && rawVal !== snapped) {
        hint.textContent = `已规整为 ${snapped}（${constraints.step}px 对齐）`;
        hint.style.color = 'var(--accent)';
        clearTimeout(hInput._hintTimeout);
        hInput._hintTimeout = setTimeout(() => {
          hint.textContent = '';
          hint.style.color = '';
        }, 2000);
      }
    };
  }

  // 恢复上次的模型选择状态（geminiModelKey 为唯一可信来源）
  const savedModelKey = state.geminiModelKey || 'nano-banana-2';
  const model = GEMINI_MODELS[savedModelKey];
  if (model) {
    // 初始化时仅更新 DOM 展示值，不做 localStorage 持久化。
    // 持久化由 selectGeminiModel()（点击卡片）和 form-persistence（手动输入）负责，
    // 避免每次页面加载都无条件覆盖用户此前手动输入的模型名。
    const mg = $('modelGemini');
    if (mg) {
      mg.value = model.modelName;
    }
  }

  // 恢复分辨率标签
  const savedSize = state.geminiActiveSize || '1K';
  state.geminiActiveSize = savedSize;

  // 恢复自定义尺寸状态
  if (state.geminiUseCustom) {
    updateCustomConstraints();
  }

  // 初始渲染
  document.querySelectorAll('.gemini-model-card').forEach((card) => {
    card.classList.toggle('active', card.dataset.geminiModel === savedModelKey);
  });
  renderSizeTabs();
  renderSizeGrid();
  syncHiddenFields();

  // 订阅预览更新事件
  bus.on('preview:update', () => {
    syncHiddenFields();
  });
}
