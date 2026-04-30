/**
 * engine.js — 引擎切换模块
 *
 * 管理 Banana·Gemini 和 GPT Image-2 两个生成引擎的切换。
 * 包括 UI 状态更新、模型输入同步、预览信息更新。
 */

import { $, ls } from '../utils/helpers.js';
import { state, PROVIDER_DEFAULTS } from '../state/app-state.js';
import { showToast } from './toast.js';
import { bus } from '../utils/event-bus.js';

/**
 * 获取当前引擎对应的模型名称
 * @returns {string} 模型名称
 */
export function getModel() {
  if (state.currentEngine === 'openai') {
    return $('modelOpenai')?.value?.trim() || PROVIDER_DEFAULTS.openai.model;
  }
  return $('modelGemini')?.value?.trim() || PROVIDER_DEFAULTS.gemini.model;
}

/**
 * 同步隐藏桥接字段（确保 executeGeneration 读取正确值）
 */
export function syncModelInput() {
  const mi = $('modelInput');
  if (mi) mi.value = getModel();
}

/**
 * 更新底部参数预览文本
 */
export function updatePreview() {
  const r = $('ratioSelect');
  const q = $('qualitySelect');
  const b = $('batchSelect');
  if (!r || !q || !b) return;

  syncModelInput();

  const preview = $('paramPreview');
  if (preview) {
    preview.textContent = `${r.value || 'Auto'} | ${
      q.options[q.selectedIndex]?.text.split(' ')[0] || 'Standard'
    } | x${b.value} | ${getModel() || 'No Model'}`;
  }

  // 同步引擎提示文字
  const hint = $('engineModelHintText');
  if (hint) hint.textContent = `当前模型: ${getModel()}`;
}

/**
 * 切换引擎
 * @param {string} engineKey - 引擎标识：'gemini' | 'openai'
 * @param {boolean} silent - 静默模式（不显示 Toast）
 */
export function switchEngine(engineKey, silent = false) {
  const cfg = PROVIDER_DEFAULTS[engineKey];
  if (!cfg) return;

  state.currentEngine = engineKey;
  ls('nanscript_currentEngine', engineKey);

  // 更新隐藏的 apiTypeSelect
  const apiSel = $('apiTypeSelect');
  if (apiSel) {
    apiSel.value = cfg.apiType;
    ls('nanscript_apiTypeSelect', cfg.apiType);
  }

  // 若对应引擎的模型输入框为空，填入预设默认值
  if (engineKey === 'gemini') {
    const mg = $('modelGemini');
    if (mg && !mg.value.trim()) {
      mg.value = cfg.model;
      ls('nanscript_modelGemini', cfg.model);
    }
  } else {
    const mo = $('modelOpenai');
    if (mo && !mo.value.trim()) {
      mo.value = cfg.model;
      ls('nanscript_modelOpenai', cfg.model);
    }
  }

  // 同步隐藏桥接字段
  syncModelInput();

  // 更新 UI 按钮激活态
  document.querySelectorAll('.engine-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.engine === engineKey);
  });

  // 更新引擎徽章
  const badge = $('engineBadge');
  if (badge) {
    badge.textContent = cfg.badgeText;
    badge.className = cfg.badgeClass;
  }

  // 更新引擎提示文字
  const hint = $('engineModelHintText');
  if (hint) hint.textContent = `当前模型: ${getModel()}`;

  bus.emit('preview:update');
  if (!silent) showToast(`已切换至 ${cfg.label}`);

  // 防改写开关：仅 OpenAI 引擎时显示
  const guardLabel = $('rewriteGuardLabel');
  if (guardLabel) guardLabel.classList.toggle('hidden', engineKey !== 'openai');
}

/**
 * 初始化引擎切换器
 * - 绑定引擎切换按钮事件
 * - 恢复上次选择的引擎
 */
export function initEngine() {
  // 绑定引擎切换按钮
  document.querySelectorAll('.engine-btn').forEach((btn) => {
    btn.onclick = () => switchEngine(btn.dataset.engine);
  });

  // 静默恢复上次引擎选择
  const eng = state.currentEngine;
  const cfg = PROVIDER_DEFAULTS[eng];
  if (!cfg) return;

  // 恢复模型值：优先读 localStorage，无则用预设（但不覆盖 localStorage）
  // 注意：此函数在 initFormPersistence 之前执行，输入框此时为空，
  //       不能以"输入框为空"为由覆盖已保存的 localStorage 值！
  const mg = $('modelGemini');
  if (mg) {
    const savedMg = ls('nanscript_modelGemini');
    mg.value = savedMg || PROVIDER_DEFAULTS.gemini.model;
    if (!savedMg) ls('nanscript_modelGemini', PROVIDER_DEFAULTS.gemini.model);
  }

  const mo = $('modelOpenai');
  if (mo) {
    const savedMo = ls('nanscript_modelOpenai');
    mo.value = savedMo || PROVIDER_DEFAULTS.openai.model;
    if (!savedMo) ls('nanscript_modelOpenai', PROVIDER_DEFAULTS.openai.model);
  }

  // 同步隐藏桥接字段 & apiTypeSelect
  const apiSel = $('apiTypeSelect');
  if (apiSel) apiSel.value = cfg.apiType;
  syncModelInput();

  // 更新按钮激活态
  document.querySelectorAll('.engine-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.engine === eng);
  });

  // 更新徽章
  const badge = $('engineBadge');
  if (badge) {
    badge.textContent = cfg.badgeText;
    badge.className = cfg.badgeClass;
  }

  const hint = $('engineModelHintText');
  if (hint) hint.textContent = `当前模型: ${getModel()}`;

  // 展示/隐藏防改写开关
  const guardLabel = $('rewriteGuardLabel');
  if (guardLabel) guardLabel.classList.toggle('hidden', eng !== 'openai');
}

// 订阅事件总线
bus.on('preview:update', updatePreview);
