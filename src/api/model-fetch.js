/**
 * model-fetch.js — 模型列表获取模块
 *
 * 同时拉取 Gemini 和 OpenAI 两个引擎的模型列表，
 * 并填充到对应的下拉选择框中。
 */

import { $, ls } from '../utils/helpers.js';
import { syncModelInput, updatePreview } from '../ui/engine.js';

/**
 * 获取两个引擎的模型列表
 */
export async function fetchModels() {
  const base = $('baseUrl').value.trim();
  const key = $('apiKey').value.trim();
  const st = $('modelStatus');
  const btn = $('fetchModelsBtn');

  if (!key || !base) {
    st.className = 'model-status fail';
    st.textContent = !key ? '❌ 缺少 API Key' : '❌ 缺少 Base URL';
    return;
  }

  btn.classList.add('loading');
  btn.disabled = true;
  st.className = 'model-status';
  st.textContent = '正在获取模型列表...';

  /**
   * 填充 select 下拉框并同步到 input
   * @param {HTMLSelectElement} sel - 下拉框
   * @param {HTMLInputElement} inp - 对应的文本输入框
   * @param {string} lsKey - localStorage 键名
   * @param {string[]} models - 模型名称列表
   * @param {string} curVal - 当前值
   */
  const fillSelect = (sel, inp, lsKey, models, curVal) => {
    sel.innerHTML = '';
    models.forEach((name) => {
      const o = document.createElement('option');
      o.value = o.textContent = name;
      sel.appendChild(o);
    });
    // 优先恢复已填值，否则优先选 image 相关
    if (curVal && Array.from(sel.options).some((o) => o.value === curVal)) {
      sel.value = curVal;
    } else {
      const imgOpt = Array.from(sel.options).find((o) => o.value.includes('image'));
      if (imgOpt) sel.value = imgOpt.value;
    }
    if (inp) {
      inp.value = sel.value;
      ls(lsKey, sel.value);
    }
    inp?.classList.add('hidden');
    sel.classList.remove('hidden');
    sel.onchange = () => {
      if (inp) {
        inp.value = sel.value;
        ls(lsKey, sel.value);
      }
      syncModelInput();
      updatePreview();
    };
    syncModelInput();
    updatePreview();
  };

  const results = await Promise.allSettled([
    // Gemini 模型列表
    fetch(`${base.replace(/\/$/, '')}/v1beta/models?key=${key}`, {
      headers: { 'Content-Type': 'application/json' },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`Gemini HTTP ${r.status}`);
        return r.json();
      })
      .then((d) =>
        (d.models || []).map((m) =>
          (m.name || m.id).replace('models/', '')
        )
      ),
    // OpenAI 兼容模型列表
    fetch(`${base.replace(/\/$/, '')}/v1/models`, {
      headers: { Authorization: `Bearer ${key}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`OpenAI HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => (d.data || []).map((m) => m.id || m.name)),
  ]);

  const [geminiRes, openaiRes] = results;
  const msgs = [];

  if (geminiRes.status === 'fulfilled' && geminiRes.value.length) {
    fillSelect(
      $('modelGeminiSelect'),
      $('modelGemini'),
      'nanscript_modelGemini',
      geminiRes.value,
      $('modelGemini')?.value?.trim()
    );
    msgs.push(`Banana: ${geminiRes.value.length} 个模型`);
  } else {
    msgs.push(`Banana: ❌ ${geminiRes.reason?.message || '获取失败'}`);
    $('modelGemini')?.classList.remove('hidden');
    $('modelGeminiSelect')?.classList.add('hidden');
  }

  if (openaiRes.status === 'fulfilled' && openaiRes.value.length) {
    fillSelect(
      $('modelOpenaiSelect'),
      $('modelOpenai'),
      'nanscript_modelOpenai',
      openaiRes.value,
      $('modelOpenai')?.value?.trim()
    );
    msgs.push(`Image-2: ${openaiRes.value.length} 个模型`);
  } else {
    msgs.push(`Image-2: ❌ ${openaiRes.reason?.message || '获取失败'}`);
    $('modelOpenai')?.classList.remove('hidden');
    $('modelOpenaiSelect')?.classList.add('hidden');
  }

  st.className = 'model-status ok';
  st.textContent = '✅ ' + msgs.join(' | ');
  btn.classList.remove('loading');
  btn.disabled = false;
}
