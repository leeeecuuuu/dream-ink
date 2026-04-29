/**
 * main.js — 应用入口
 * 
 * 仅负责统一导入依赖，调度并初始化各子模块和事件绑定。
 */

import '../style.css';

import { $, base64ToBlob, urlToFile } from './utils/helpers.js';
import { state } from './state/app-state.js';
import { showToast, overrideAlert } from './ui/toast.js';
import { initTheme } from './ui/theme.js';
import { initEngine } from './ui/engine.js';
import { saveLib } from './ui/library.js';
import { initLightbox } from './ui/lightbox.js';
import { initModals } from './ui/modals.js';
import { initMobile } from './ui/mobile.js';
import { initRatioDropdown } from './ui/ratio-dropdown.js';
import { fetchModels } from './api/model-fetch.js';
import { enqueueTask, enqueueMultiple, clearQueue, executeGeneration } from './core/generator.js';
import { idb } from './storage/idb.js';
import JSZip from 'jszip';
import { registerSW } from 'virtual:pwa-register';

// 注册 Service Worker (PWA 离线支持)
registerSW({ immediate: true });

// 初始器引入
import { initFormPersistence } from './init/form-persistence.js';
import { initDataLoader } from './init/data-loader.js';
import { initWebDAV } from './init/webdav-sync.js';
import { bus } from './utils/event-bus.js';
import { injectModals } from './components/ModalManager.js';

// 全局错误边界 (Error Boundary)
window.addEventListener('error', (e) => {
  console.error('【捕获到全局错误】', e.error || e.message);
  showToast(`系统错误: ${e.message}`, 'error');
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('【捕获到未处理的 Promise 异常】', e.reason);
  showToast(`网络或请求错误: ${e.reason?.message || e.reason || '未知异常'}`, 'error');
});

// 覆写 window.alert
overrideAlert();

// Lightbox 立即初始化（不依赖 DOMContentLoaded）
initLightbox();

document.addEventListener('DOMContentLoaded', () => {
  // 0. 注入模态框 HTML
  injectModals();

  // 1. 基础 UI 和引擎初始化
  initModals();
  initTheme();
  initRatioDropdown();
  initEngine();

  // 2. 表单与持久化数据加载
  initFormPersistence();
  initDataLoader();
  initWebDAV();

  // ========== 历史详情操作 ==========
  $('hdDelBtn').onclick = () => {
    if (state.currentHistoryIdx > -1) {
      if (state.currentDetailMode === 'history') {
        state.historyData.splice(state.currentHistoryIdx, 1);
        idb.set('nanscript_history_db', state.historyData);
        bus.emit('historyData:change');
      } else {
        state.promptLib[state.curFolder].prompts.splice(state.currentHistoryIdx, 1);
        saveLib();
        bus.emit('promptLib:promptsChange');
      }
      $('historyDetailModal').style.display = 'none';
      showToast('记录已删除');
    }
  };

  const _hdCopyBtn = $('hdCopyBtn');
  if (_hdCopyBtn) _hdCopyBtn.onclick = async () => {
    const text = $('hdPrompt').value;
    if (!text) return;
    try { await navigator.clipboard.writeText(text); showToast('提示词已复制'); }
    catch { showToast('复制失败', 'error'); }
  };

  $('hdAddLibBtn').onclick = () => {
    const text = $('hdPrompt').value;
    if (!text) return showToast('无提示词可存', 'error');
    const name = prompt('为这组咒语起个名字:', '历史收藏');
    if (!name) return;
    if (!state.promptLib.length) state.promptLib.push({ folderName: 'Default', prompts: [] });
    const histItem = state.currentDetailMode === 'history' ? state.historyData[state.currentHistoryIdx] : null;
    state.promptLib[state.curFolder].prompts.unshift({
      name, content: text,
      thumb: (() => {
        const safeThumb = src => (src && src.startsWith('data:')) ? src : '';
        return safeThumb(histItem?.thumb) || safeThumb(histItem?._thumbSrc) || '';
      })(),
      fullImage: histItem?.fullImage || '',
      imageFile: histItem?.imageFile || null,
      thumbFile: histItem?.thumbFile || null,
      model: histItem?.model, aspectRatio: histItem?.aspectRatio,
      quality: histItem?.quality, batchCount: histItem?.batchCount,
      apiType: histItem?.apiType, refImages: histItem?.refImages,
    });
    saveLib(); bus.emit('promptLib:change'); showToast('已加入当前分类');
  };

  const _hdApplyBtn = $('hdApplyBtn');
  if (_hdApplyBtn) _hdApplyBtn.onclick = () => {
    const item = state.currentDetailMode === 'history'
      ? state.historyData[state.currentHistoryIdx]
      : state.promptLib[state.curFolder].prompts[state.currentHistoryIdx];
    if (!item) return;
    $('promptInput').value = item.content || (item.prompt === '纯图生成' ? '' : item.prompt) || '';
    if (item.aspectRatio) $('ratioSelect').value = item.aspectRatio;
    if (item.quality) $('qualitySelect').value = item.quality;
    if (item.batchCount) { $('batchSelect').value = item.batchCount; }
    if (item.apiType) { $('apiTypeSelect').value = item.apiType; $('apiTypeSelect').dispatchEvent(new Event('change')); }
    if (item.model) {
      const s = $('modelSelect'), inp = $('modelInput');
      Array.from(s?.options || []).some(o => o.value === item.model) && s?.style.display !== 'none'
        ? s.value = item.model : inp.value = item.model;
    }
    state.selectedFiles = [];
    if (item.refImages && item.refImages.length) {
      item.refImages.forEach((src, idx) => {
        if (src.startsWith('data:')) {
          const blob = base64ToBlob(src);
          if (blob) state.selectedFiles.push(new File([blob], `ref${idx}.png`, { type: blob.type }));
        }
      });
    }
    bus.emit('selectedFiles:change'); bus.emit('preview:update');
    $('historyDetailModal').style.display = 'none';
    if (state.currentDetailMode === 'library') $('libraryModal').style.display = 'none';
    showToast('参数与垫图已导入！');
  };

  // ========== 垫图上传与拖拽 ==========
  const imgInput = $('imageInput');
  if (imgInput) {
    imgInput.onchange = e => {
      const nf = Array.from(e.target.files);
      if (state.selectedFiles.length + nf.length > 10) return alert('最多 10 张！');
      state.selectedFiles = state.selectedFiles.concat(nf); bus.emit('selectedFiles:change'); e.target.value = '';
    };
    const panel = imgInput.parentElement;
    if (panel) {
      ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(e => panel.addEventListener(e, ev => { ev.preventDefault(); ev.stopPropagation(); }));
      ['dragenter', 'dragover'].forEach(e => panel.addEventListener(e, () => panel.classList.add('bg-surface-container-highest', 'border-primary')));
      ['dragleave', 'drop'].forEach(e => panel.addEventListener(e, () => panel.classList.remove('bg-surface-container-highest', 'border-primary')));
      panel.ondrop = e => {
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        if (files.length) { const dt = new DataTransfer(); [...(imgInput.files || []), ...files].forEach(f => dt.items.add(f)); imgInput.files = dt.files; imgInput.dispatchEvent(new Event('change')); }
      };
    }
  }

  // ========== 主操作按钮绑定 ==========
  $('fetchModelsBtn').onclick = fetchModels;
  $('runBtn').onclick = () => enqueueTask();
  
  const multiTaskBtn = $('multiTaskBtn');
  if (multiTaskBtn) multiTaskBtn.onclick = () => {
    const count = Math.max(2, Math.min(parseInt($('multiTaskCount').value) || 3, 50));
    enqueueMultiple(count);
    $('clearQueueBtn').classList.remove('hidden');
  };
  
  const clearQueueBtn = $('clearQueueBtn');
  if (clearQueueBtn) clearQueueBtn.onclick = () => {
    clearQueue();
    clearQueueBtn.classList.add('hidden');
  };

  // ========== 咒语书操作 ==========
  $('addFolderBtn').onclick = () => {
    const n = $('newFolderInput').value.trim(); if (!n) return;
    state.promptLib.push({ folderName: n, prompts: [] }); $('newFolderInput').value = '';
    state.curFolder = state.promptLib.length - 1; saveLib(); bus.emit('promptLib:change');
  };

  $('newPromptImg').onchange = e => {
    const file = e.target.files[0]; if (!file) return;
    const img = new Image();
    img.onload = () => { const c = document.createElement('canvas'), s = 250 / img.width; c.width = 250; c.height = img.height * s; c.getContext('2d').drawImage(img, 0, 0, 250, c.height); state.pendingThumb = c.toDataURL('image/jpeg', 0.6); $('thumbStatus').style.display = 'block'; };
    img.src = URL.createObjectURL(file);
  };

  $('addPromptBtn').onclick = () => {
    if (!state.promptLib.length) return alert('请先创建分类');
    const n = $('newPromptName').value.trim(), c = $('newPromptContent').value.trim();
    if (!n || !c) return alert('名称和内容必填');
    state.promptLib[state.curFolder].prompts.unshift({ name: n, content: c, thumb: state.pendingThumb });
    $('newPromptName').value = $('newPromptContent').value = $('newPromptImg').value = '';
    $('thumbStatus').style.display = 'none'; state.pendingThumb = null; saveLib(); bus.emit('promptLib:promptsChange');
  };

  // ========== 历史记录数据操作 ==========
  $('clearHistoryBtn').onclick = () => { if (confirm('清空所有历史？')) { state.historyData = []; idb.set('nanscript_history_db', state.historyData); bus.emit('historyData:change'); } };

  $('exportImagesBtn').onclick = async () => {
    if (!state.historyData.length) return showToast('无记录可导出', 'error');
    showToast('正在为您打包图片，请稍等...', 'success');
    const btn = $('exportImagesBtn'); btn.disabled = true;
    try {
      const zip = new JSZip();
      let count = 0;
      const folder = zip.folder("BanavelAi_生成图");
      for (let i = 0; i < state.historyData.length; i++) {
        const item = state.historyData[i];
        const imgSrc = item.fullImage || item.thumb;
        if (!imgSrc) continue;
        try {
          let blob;
          if (imgSrc.startsWith('data:')) { blob = base64ToBlob(imgSrc); }
          else { blob = await (await fetch(imgSrc)).blob(); }
          if (blob) {
            const dateStr = (item.date || '').replace(/\//g, '');
            const promptStr = (item.prompt && item.prompt !== '纯图生成') ? item.prompt.slice(0, 15).replace(/[\\/:*?"<>|]/g, '').trim() : '图片';
            folder.file(`${String(i + 1).padStart(3, '0')}_${dateStr}_${promptStr}.png`, blob);
            count++;
          }
        } catch (e) { console.warn("打包单张图片失败:", e); }
      }
      if (count === 0) { btn.disabled = false; return showToast('没有可打包的有效图片', 'error'); }
      const content = await zip.generateAsync({ type: "blob" });
      const a = document.createElement('a'); a.href = URL.createObjectURL(content);
      a.download = `BanavelAi_画作合集_${Date.now()}.zip`;
      document.body.appendChild(a); a.click(); setTimeout(() => document.body.removeChild(a), 100);
      showToast(`🎉 成功打包 ${count} 张图片！`);
    } catch (e) { console.error(e); showToast('打包过程出错', 'error'); }
    finally { btn.disabled = false; }
  };

  $('exportHistoryBtn').onclick = () => {
    if (!state.historyData.length) return showToast('无记录', 'error');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(state.historyData, null, 2)], { type: 'application/json' }));
    a.download = `history_${Date.now()}.json`; a.click(); showToast('已导出');
  };
  
  $('importHistoryBtn').onclick = () => $('importHistoryInput').click();
  $('importHistoryInput').onchange = e => {
    const file = e.target.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = ev => {
      try {
        const imp = JSON.parse(ev.target.result); if (!Array.isArray(imp)) throw 1;
        if (state.historyData.length && confirm('与现有记录合并？')) {
          const m = new Map(state.historyData.map(i => [i.id, i])); imp.forEach(i => m.set(i.id, i));
          state.historyData = [...m.values()].sort((a, b) => b.id - a.id).slice(0, 100);
        } else state.historyData = imp.slice(0, 100);
        idb.set('nanscript_history_db', state.historyData); bus.emit('historyData:change'); showToast('导入成功');
      } catch { showToast('无效格式', 'error'); }
      e.target.value = '';
    };
    r.readAsText(file);
  };

  // ========== 重绘操作 ==========
  $('confirmRedrawBtn').onclick = async () => {
    const src = $('redrawSourceThumb').src, p = $('redrawPrompt').value.trim();
    if (!p) return showToast('请输入修改建议', 'error');
    const btn = $('confirmRedrawBtn'); btn.disabled = true; btn.textContent = '重绘中...';
    try {
      state.selectedFiles = [await urlToFile(src, 'redraw.png', 'image/png')]; bus.emit('selectedFiles:change');
      $('promptInput').value = p; $('redrawModal').style.display = 'none'; executeGeneration();
    } catch { showToast('图片加载失败', 'error'); }
    finally { btn.disabled = false; btn.textContent = '确认重绘'; }
  };

  // 终态更新
  bus.emit('preview:update');
});

// 3. 移动端适配
initMobile();
