/**
 * form-persistence.js — 表单持久化初始化
 *
 * 处理各种表单字段（参数、API 配置等）的自动存档和恢复，
 * 以及 API 预设配置管理逻辑。
 */

import { $, ls } from '../utils/helpers.js';
import { state, PROVIDER_DEFAULTS } from '../state/app-state.js';
import { syncModelInput } from '../ui/engine.js';
import { bus } from '../utils/event-bus.js';
import { showToast } from '../ui/toast.js';
import { localFS } from '../storage/local-fs.js';

export function initFormPersistence() {
  // 表单字段持久化
  ['baseUrl', 'apiKey', 'modelGemini', 'modelOpenai', 'ratioSelect', 'customWidth', 'customHeight', 'qualitySelect', 'promptInput', 'batchSelect', 'gptApiFormat', 'customModelsGemini', 'customModelsOpenai', 'moderationSelect'].forEach(id => {
    const elem = $(id); if (!elem) return;
    const isCheckbox = elem.type === 'checkbox';
    const saved = ls('nanscript_' + id); 
    if (saved !== null && saved !== undefined) {
      if (isCheckbox) elem.checked = saved === 'true';
      else elem.value = saved;
    }
    const sync = () => {
      // 并发数量 clamp: 1~20
      if (id === 'batchSelect') {
        let v = parseInt(elem.value) || 1;
        v = Math.max(1, Math.min(v, 20));
        elem.value = v;
      }
      ls('nanscript_' + id, isCheckbox ? elem.checked : elem.value);
      if (id === 'modelGemini' || id === 'modelOpenai') syncModelInput();
      if (id === 'ratioSelect' && window._updateRatioUI) window._updateRatioUI(elem.value);
      bus.emit('preview:update');
    };
    elem.oninput = elem.onchange = sync;
  });
  if (window._updateRatioUI) window._updateRatioUI($('ratioSelect').value || '1024x1024');

  // API 配置存档
  const profSel = $('apiProfileSelect');
  const loadProfiles = () => {
    if (!profSel) return;
    profSel.innerHTML = '<option value="">-- 选择配置 --</option>';
    state.apiProfiles.forEach(p => { const o = document.createElement('option'); o.value = o.textContent = p.name; profSel.appendChild(o); });
  };
  if (profSel) {
    loadProfiles();
    profSel.onchange = e => {
      const p = state.apiProfiles.find(x => x.name === e.target.value); if (!p) return;
      if ($('baseUrl')) { $('baseUrl').value = p.baseUrl || ''; ls('nanscript_baseUrl', p.baseUrl || ''); }
      if ($('apiKey')) { $('apiKey').value = p.apiKey || ''; ls('nanscript_apiKey', p.apiKey || ''); }
      if (p.modelGemini && $('modelGemini')) { $('modelGemini').value = p.modelGemini; ls('nanscript_modelGemini', p.modelGemini); }
      if (p.modelOpenai && $('modelOpenai')) { $('modelOpenai').value = p.modelOpenai; ls('nanscript_modelOpenai', p.modelOpenai); }
      if (p.customModelsGemini !== undefined && $('customModelsGemini')) { $('customModelsGemini').value = p.customModelsGemini; ls('nanscript_customModelsGemini', p.customModelsGemini); }
      if (p.customModelsOpenai !== undefined && $('customModelsOpenai')) { $('customModelsOpenai').value = p.customModelsOpenai; ls('nanscript_customModelsOpenai', p.customModelsOpenai); }
      if ($('apiProfileName')) $('apiProfileName').value = p.name;
      syncModelInput(); bus.emit('preview:update'); showToast(`已加载: ${p.name}（可修改后保存覆盖）`);
    };
  }

  const saveProfileBtn = $('saveProfileBtn');
  if (saveProfileBtn) saveProfileBtn.onclick = () => {
    const name = $('apiProfileName').value.trim(); if (!name) return alert('请输入配置名称');
    const cfg = { name, baseUrl: $('baseUrl')?.value || '', apiKey: $('apiKey')?.value || '',
      modelGemini: $('modelGemini')?.value || PROVIDER_DEFAULTS.gemini.model,
      modelOpenai: $('modelOpenai')?.value || PROVIDER_DEFAULTS.openai.model,
      customModelsGemini: $('customModelsGemini')?.value || '',
      customModelsOpenai: $('customModelsOpenai')?.value || '' };
    const i = state.apiProfiles.findIndex(p => p.name === name);
    i > -1 ? state.apiProfiles[i] = cfg : state.apiProfiles.push(cfg);
    ls('nanscript_api_profiles', JSON.stringify(state.apiProfiles));
    loadProfiles(); profSel.value = name; showToast(`配置 [${name}] 已保存`);
  };

  const delProfileBtn = $('delProfileBtn');
  if (delProfileBtn) delProfileBtn.onclick = () => {
    const name = profSel.value; if (!name || !confirm(`删除 [${name}]？`)) return;
    state.apiProfiles = state.apiProfiles.filter(p => p.name !== name);
    ls('nanscript_api_profiles', JSON.stringify(state.apiProfiles));
    loadProfiles(); $('apiProfileName').value = ''; showToast('已删除');
  };

  // 应用并关闭 API 配置
  const applyApiConfigBtn = $('applyApiConfigBtn');
  if (applyApiConfigBtn) applyApiConfigBtn.onclick = () => {
    ['baseUrl', 'apiKey'].forEach(id => { if ($(id)) ls('nanscript_' + id, $(id).value); });
    const mg = $('modelGemini')?.value || PROVIDER_DEFAULTS.gemini.model;
    const mo = $('modelOpenai')?.value || PROVIDER_DEFAULTS.openai.model;
    ls('nanscript_modelGemini', mg); ls('nanscript_modelOpenai', mo);
    syncModelInput(); bus.emit('preview:update');
    if ($('apiConfigModal')) $('apiConfigModal').style.display = 'none';
    if (localFS.isActive()) {
      localFS.saveConfig().then(() => console.log('[localFS] config.json 已写入')).catch(e => { console.error('[localFS] saveConfig 失败:', e); showToast('配置写入本地失败', 'error'); });
    }
    showToast(`已应用 · Banana: ${mg} | Image-2: ${mo}`);
  };
}
