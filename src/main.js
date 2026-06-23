/**
 * main.js — 应用入口
 * 
 * 仅负责统一导入依赖，调度并初始化各子模块和事件绑定。
 */

import '../style.css';

import { $, base64ToBlob, compressImageFile } from './utils/helpers.js';
import { state } from './state/app-state.js';
import { showToast, overrideAlert } from './ui/toast.js';
import { initTheme } from './ui/theme.js';
import { initEngine, switchEngine, syncModelInput, updatePreview } from './ui/engine.js';
import { saveLib } from './ui/library.js';
import { initLightbox } from './ui/lightbox.js';
import { initModals } from './ui/modals.js';
import { initMobile } from './ui/mobile.js';
import './ui/preview.js'; // 注册参考图预览的事件监听
import { initGptSizePicker } from './ui/gpt-size-picker.js';
import { initGeminiSizePicker } from './ui/gemini-size-picker.js';
import { initMaskEditor } from './ui/mask-editor.js';
import { initHistoryFilters, persistHistoryData } from './ui/history.js';
import { fetchGeminiModels, fetchOpenaiModels } from './api/model-fetch.js';
import { enqueueTask, enqueueMultiple, clearQueue, executeGeneration } from './core/generator.js';
import JSZip from 'jszip';
import { registerSW } from 'virtual:pwa-register';

// 注册 Service Worker (PWA 离线支持)
registerSW({ immediate: true });

// 初始器引入
import { initFormPersistence } from './init/form-persistence.js';
import { initDataLoader } from './init/data-loader.js';
import { initWebDAV } from './init/webdav-sync.js';
import { initGitee } from './init/gitee-sync.js';
import { bus } from './utils/event-bus.js';
import { injectModals } from './components/ModalManager.js';
import { localFS } from './storage/local-fs.js';

// 全局错误边界 (Error Boundary)
window.addEventListener('error', (e) => {
  console.error('【捕获到全局错误】', e.error || e.message);
  const msg = e.message || '';
  // 向用户显示简洁提示，技术细节仅保留在控制台
  if (msg.includes('NetworkError') || msg.includes('Failed to fetch')) {
    showToast('网络连接失败，请检查网络后重试', 'error');
  } else {
    showToast('应用出现异常，请刷新页面后重试', 'error');
  }
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('【捕获到未处理的 Promise 异常】', e.reason);
  const msg = e.reason?.message || String(e.reason || '');
  if (msg.includes('NetworkError') || msg.includes('Failed to fetch') || msg.includes('fetch')) {
    showToast('网络请求失败，请检查网络连接', 'error');
  } else if (msg.includes('timeout') || msg.includes('Timeout')) {
    showToast('请求超时，请稍后重试', 'error');
  } else {
    showToast('操作失败，请稍后重试', 'error');
  }
});

// 覆写 window.alert
overrideAlert();
initLightbox();

document.addEventListener('DOMContentLoaded', () => {
  // 0. 注入模态框 HTML
  injectModals();

  // 1. 基础 UI 和引擎初始化
  initModals();
  initTheme();
  initGptSizePicker();
  initGeminiSizePicker();
  initEngine();
  initMaskEditor();
  initHistoryFilters();

  // 2. 表单与持久化数据加载
  initFormPersistence();
  initDataLoader();
  initWebDAV();
  initGitee();
  initMobile();

  // ========== 历史详情操作 ==========
  $('hdDelBtn').onclick = () => {
    if (state.currentHistoryIdx > -1) {
      if (state.currentDetailMode === 'history') {
        state.historyData.splice(state.currentHistoryIdx, 1);
        persistHistoryData();
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
  if (_hdApplyBtn) _hdApplyBtn.onclick = async () => {
    const item = state.currentDetailMode === 'history'
      ? state.historyData[state.currentHistoryIdx]
      : state.promptLib[state.curFolder].prompts[state.currentHistoryIdx];
    if (!item) return;

    _hdApplyBtn.disabled = true;
    _hdApplyBtn.textContent = '导入中...';

    $('promptInput').value = item.content || (item.prompt === '纯图生成' ? '' : item.prompt) || '';
    if (item.aspectRatio) $('ratioSelect').value = item.aspectRatio;
    if (item.quality) $('qualitySelect').value = item.quality;
    if (item.batchCount) { $('batchSelect').value = item.batchCount; }
    // 关键：导入历史参数时必须通过 switchEngine 同步全链路状态
    // （state.currentEngine / apiTypeSelect / UI 激活态 / 参数面板）
    if (item.apiType) {
      const targetEngine = item.apiType === 'openai' ? 'openai' : 'gemini';
      switchEngine(targetEngine, true);
    }

    // 关键：模型回填按当前 provider 写入新字段（modelGemini/modelOpenai），
    // 避免写入旧桥接字段导致“显示是 Banana，实际走 GPT”这类错位。
    if (item.model) {
      const apiType = $('apiTypeSelect')?.value || 'gemini';
      const targetInputId = apiType === 'openai' ? 'modelOpenai' : 'modelGemini';
      const modelInput = $(targetInputId);
      if (modelInput) {
        modelInput.value = item.model;
        localStorage.setItem(`nanscript_${targetInputId}`, item.model);
      }
      syncModelInput();
      updatePreview();
    }

    state.selectedFiles = [];
    state.selectedMasks = [];

    if (localFS.isActive() && Array.isArray(item.refFiles) && item.refFiles.length) {
      for (let i = 0; i < item.refFiles.length; i++) {
        try {
          const url = await localFS.getImageURL(item.refFiles[i], 'refs');
          const blob = await (await fetch(url)).blob();
          state.selectedFiles.push(new File([blob], `ref${i}.png`, { type: blob.type }));
        } catch(e) { console.warn(e); }
      }
      if (Array.isArray(item.maskFiles)) {
        for (let i = 0; i < item.maskFiles.length; i++) {
           if (!item.maskFiles[i]) {
               state.selectedMasks.push(null);
               continue;
           }
           try {
             const url = await localFS.getImageURL(item.maskFiles[i], 'refs');
             const blob = await (await fetch(url)).blob();
             const b64 = await new Promise((resolve) => {
               const reader = new FileReader();
               reader.onload = () => resolve(reader.result);
               reader.readAsDataURL(blob);
             });
             state.selectedMasks.push(b64);
           } catch(e) { state.selectedMasks.push(null); }
        }
      }
    } else {
      if (item.refImages && item.refImages.length) {
        item.refImages.forEach((src, idx) => {
          if (src.startsWith('data:')) {
            const blob = base64ToBlob(src);
            if (blob) state.selectedFiles.push(new File([blob], `ref${idx}.png`, { type: blob.type }));
          }
        });
      }
      if (Array.isArray(item.maskImages)) {
        state.selectedMasks = [...item.maskImages];
      }
    }

    bus.emit('selectedFiles:change'); bus.emit('preview:update');
    $('historyDetailModal').style.display = 'none';
    if (state.currentDetailMode === 'library') $('libraryModal').style.display = 'none';
    showToast('参数与垫图已导入！');
    
    _hdApplyBtn.disabled = false;
    _hdApplyBtn.innerHTML = '<span class="material-symbols-outlined text-[16px]">file_download</span> 导入参数与垫图';
  };

  const insertTextAtCursor = (textarea, text) => {
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    textarea.value = `${textarea.value.slice(0, start)}${text}${textarea.value.slice(end)}`;
    const nextPos = start + text.length;
    textarea.selectionStart = nextPos;
    textarea.selectionEnd = nextPos;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const appendReferenceFiles = async (files, sourceLabel = '参考图') => {
    const imageFiles = Array.from(files).filter(file => file?.type?.startsWith('image/'));
    if (!imageFiles.length) return;

    const remaining = 10 - state.selectedFiles.length;
    if (remaining <= 0) {
      showToast('参考图最多 10 张', 'error');
      return;
    }

    const accepted = imageFiles.slice(0, remaining);
    if (accepted.length < imageFiles.length) {
      showToast(`最多 10 张，已只添加前 ${accepted.length} 张`, 'error');
    }

    try {
      showToast(`正在压缩${sourceLabel}，尽量保持清晰度...`);
      const compressed = await Promise.all(accepted.map(file => compressImageFile(file)));
      const savedBytes = compressed.reduce((sum, file, i) => sum + Math.max(0, (accepted[i]?.size || 0) - (file?.size || 0)), 0);
      state.selectedFiles = state.selectedFiles.concat(compressed);
      bus.emit('selectedFiles:change');
      if (savedBytes > 0) {
        showToast(`${sourceLabel}已自动压缩，约减少 ${(savedBytes / 1024 / 1024).toFixed(1)}MB`);
      } else {
        showToast(`已添加 ${accepted.length} 张${sourceLabel}`);
      }
    } catch (err) {
      console.warn(`${sourceLabel}压缩失败，使用原图`, err);
      state.selectedFiles = state.selectedFiles.concat(accepted);
      bus.emit('selectedFiles:change');
      showToast(`${sourceLabel}压缩失败，已保留原图`, 'error');
    }
  };

  // ========== 垫图上传、拖拽与粘贴 ==========
  const imgInput = $('imageInput');
  if (imgInput) {
    imgInput.onchange = async e => {
      await appendReferenceFiles(e.target.files, '参考图');
      e.target.value = '';
    };
    const panel = imgInput.parentElement;
    if (panel) {
      ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(e => panel.addEventListener(e, ev => { ev.preventDefault(); ev.stopPropagation(); }));
      ['dragenter', 'dragover'].forEach(e => panel.addEventListener(e, () => panel.classList.add('bg-surface-container-highest', 'border-primary')));
      ['dragleave', 'drop'].forEach(e => panel.addEventListener(e, () => panel.classList.remove('bg-surface-container-highest', 'border-primary')));
      panel.ondrop = e => {
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        if (files.length) appendReferenceFiles(files, '参考图');
      };
    }
  }

  // ========== 快捷键绑定 ==========
  const promptInput = $('promptInput');
  if (promptInput) {
    promptInput.addEventListener('paste', (e) => {
      const clipboard = e.clipboardData;
      if (!clipboard) return;

      let pastedImages = Array.from(clipboard.items || [])
        .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
        .map(item => item.getAsFile())
        .filter(Boolean);
      if (!pastedImages.length) {
        pastedImages = Array.from(clipboard.files || []).filter(file => file.type.startsWith('image/'));
      }

      if (!pastedImages.length) return;

      e.preventDefault();
      const text = clipboard.getData('text/plain');
      if (text) insertTextAtCursor(promptInput, text);
      appendReferenceFiles(pastedImages, '粘贴图片');
    });

    promptInput.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        $('runBtn').click();
      }
    });
  }

  // ========== 主操作按钮绑定 ==========
  const fetchGeminiModelsBtn = $('fetchGeminiModelsBtn');
  if (fetchGeminiModelsBtn) fetchGeminiModelsBtn.onclick = fetchGeminiModels;
  const fetchOpenaiModelsBtn = $('fetchOpenaiModelsBtn');
  if (fetchOpenaiModelsBtn) fetchOpenaiModelsBtn.onclick = fetchOpenaiModels;
  // 生成中点击 → 终止；空闲时点击 → 入队
  $('runBtn').onclick = () => {
    if (state.isGenerating) {
      // 直接调用 executeGeneration 触发终止逻辑（内部检测 isGenerating 并 abort）
      executeGeneration();
    } else {
      enqueueTask();
    }
  };
  
  const multiTaskBtn = $('multiTaskBtn');
  if (multiTaskBtn) multiTaskBtn.onclick = () => {
    const count = Math.max(1, Math.min(parseInt($('multiTaskCount').value) || 1, 50));
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
    img.onload = () => { const c = document.createElement('canvas'), s = 400 / img.width; c.width = 400; c.height = img.height * s; c.getContext('2d').drawImage(img, 0, 0, 400, c.height); state.pendingThumb = c.toDataURL('image/jpeg', 0.85); $('thumbStatus').style.display = 'block'; };
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
  $('clearHistoryBtn').onclick = () => { if (confirm('清空所有历史？')) { state.historyData = []; persistHistoryData(); bus.emit('historyData:change'); } };

  $('exportImagesBtn').onclick = async () => {
    if (!state.historyData.length) return showToast('无记录可导出', 'error');
    showToast('正在为您打包图片，请稍等...', 'success');
    const btn = $('exportImagesBtn'); btn.disabled = true;
    try {
      const zip = new JSZip();
      let count = 0;
      const folder = zip.folder("DreamInk_生成图");
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
      a.download = `DreamInk_画作合集_${Date.now()}.zip`;
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
          state.historyData = [...m.values()].sort((a, b) => String(b.id || '').localeCompare(String(a.id || ''))).slice(0, 100);
        } else state.historyData = imp.slice(0, 100);
        persistHistoryData(); bus.emit('historyData:change'); showToast('导入成功');
      } catch { showToast('无效格式', 'error'); }
      e.target.value = '';
    };
    r.readAsText(file);
  };
  // 终态更新
  bus.emit('preview:update');
});
