/**
 * main.js — 应用入口
 * 
 * 统一导入所有模块，按顺序初始化各子系统。
 */

import './style.css';

import { $, ls, fileToB64, urlToFile, base64ToBlob } from './utils/helpers.js';
import { el, icon } from './utils/dom.js';
import { supportsFileSystemAccess, isNarrowScreen } from './utils/feature-detect.js';
import { idb } from './storage/idb.js';
import { localFS } from './storage/local-fs.js';
import { state, PROVIDER_DEFAULTS } from './state/app-state.js';
import { showToast, overrideAlert } from './ui/toast.js';
import { initTheme } from './ui/theme.js';
import { initEngine, getModel, syncModelInput, updatePreview } from './ui/engine.js';
import { createGalleryItemDOM } from './ui/gallery.js';
import { saveHistory, renderHistory, showHistoryDetail } from './ui/history.js';
import { saveLib, renderFolders, renderPrompts } from './ui/library.js';
import { initLightbox } from './ui/lightbox.js';
import { initModals } from './ui/modals.js';
import { initMobile } from './ui/mobile.js';
import { initRatioDropdown } from './ui/ratio-dropdown.js';
import { fetchModels } from './api/model-fetch.js';
import { executeGeneration, enqueueTask, enqueueMultiple, clearQueue, getQueueLength } from './core/generator.js';
import { webdav } from './storage/webdav.js';
import JSZip from 'jszip';

// 覆写 window.alert
overrideAlert();

// Lightbox 立即初始化（不依赖 DOMContentLoaded）
initLightbox();

// ========== 预览列表渲染 ==========
function renderPreviews() {
  const list = $('imagePreviewList');
  list.innerHTML = '';
  state.selectedFiles.forEach((f, i) => {
    const wrapper = el('div', { className: 'relative group w-20 h-20 rounded-md mt-2' });
    const img = el('img', {
      src: URL.createObjectURL(f),
      className: 'w-20 h-20 object-cover rounded-md border border-outline-variant/50 relative z-10',
    });

    img.onmouseenter = () => {
      let hp = document.getElementById('globalHoverPreview');
      if (!hp) {
        hp = el('img', {
          id: 'globalHoverPreview',
          className: 'fixed w-[320px] max-w-none h-auto max-h-[500px] object-cover bg-surface rounded-lg shadow-[0_10px_40px_rgba(0,0,0,0.5)] pointer-events-none transition-opacity duration-200 z-[9999] border border-outline-variant/30',
        });
        document.body.appendChild(hp);
      }
      hp.src = img.src;
      const rect = img.getBoundingClientRect();
      hp.style.left = `${rect.right + 16}px`;
      let topPos = rect.top - 120;
      if (topPos < 20) topPos = 20;
      if (topPos + 400 > window.innerHeight) topPos = window.innerHeight - 420;
      hp.style.top = `${topPos}px`;
      hp.style.opacity = '1';
    };

    img.onmouseleave = () => {
      const hp = document.getElementById('globalHoverPreview');
      if (hp) hp.style.opacity = '0';
    };

    const closeBtn = el('button', {
      className: 'absolute -top-2 -right-2 bg-error text-white rounded-full w-5 h-5 flex items-center justify-center z-[60] shadow-md hover:bg-red-600 transition-transform hover:scale-110',
    }, icon('close', 'text-[14px]'));

    closeBtn.onclick = () => { state.selectedFiles.splice(i, 1); renderPreviews(); };
    wrapper.append(img, closeBtn);
    list.appendChild(wrapper);
  });

  // 持久化垫图
  Promise.all(state.selectedFiles.map(fileToB64)).then(async (b64s) => {
    if (localFS.isActive()) {
      const refFiles = [];
      for (let i = 0; i < b64s.length; i++) {
        const fname = `current_ref_${i}.png`;
        await localFS.saveImage(fname, b64s[i], 'refs').catch(() => {});
        refFiles.push(fname);
      }
      await localFS.saveJSON('current_refs.json', refFiles).catch(() => {});
    } else {
      idb.set('nanscript_current_refs', b64s);
    }
  }).catch(() => {});
}

// ========== DOMContentLoaded ==========
document.addEventListener('DOMContentLoaded', () => {
  // 初始化各子系统
  initModals();
  initTheme();
  initRatioDropdown();
  initEngine();

  // 历史详情 - 删除
  $('hdDelBtn').onclick = () => {
    if (state.currentHistoryIdx > -1) {
      if (state.currentDetailMode === 'history') {
        state.historyData.splice(state.currentHistoryIdx, 1);
        idb.set('nanscript_history_db', state.historyData);
        renderHistory();
      } else {
        state.promptLib[state.curFolder].prompts.splice(state.currentHistoryIdx, 1);
        saveLib();
        renderPrompts();
      }
      $('historyDetailModal').style.display = 'none';
      showToast('记录已删除');
    }
  };

  // 历史详情 - 复制咒语
  const _hdCopyBtn = $('hdCopyBtn');
  if (_hdCopyBtn) _hdCopyBtn.onclick = async () => {
    const text = $('hdPrompt').value;
    if (!text) return;
    try { await navigator.clipboard.writeText(text); showToast('提示词已复制'); }
    catch { showToast('复制失败', 'error'); }
  };

  // 历史详情 - 收藏到咒语书
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
    saveLib(); renderFolders(); showToast('已加入当前分类');
  };

  // 历史详情 - 应用参数
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
    renderPreviews(); updatePreview();
    $('historyDetailModal').style.display = 'none';
    if (state.currentDetailMode === 'library') $('libraryModal').style.display = 'none';
    showToast('参数与垫图已导入！');
  };

  // 表单字段持久化
  ['baseUrl', 'apiKey', 'modelGemini', 'modelOpenai', 'ratioSelect', 'customWidth', 'customHeight', 'qualitySelect', 'promptInput', 'batchSelect'].forEach(id => {
    const elem = $(id); if (!elem) return;
    const saved = ls('nanscript_' + id); if (saved) elem.value = saved;
    const sync = () => {
      // 并发数量 clamp: 1~20
      if (id === 'batchSelect') {
        let v = parseInt(elem.value) || 1;
        v = Math.max(1, Math.min(v, 20));
        elem.value = v;
      }
      ls('nanscript_' + id, elem.value);
      if (id === 'modelGemini' || id === 'modelOpenai') syncModelInput();
      if (id === 'ratioSelect' && window._updateRatioUI) window._updateRatioUI(elem.value);
      updatePreview();
    };
    elem.oninput = elem.onchange = sync;
  });
  if (window._updateRatioUI) window._updateRatioUI($('ratioSelect').value || '1024x1024');

  // 垫图上传
  const imgInput = $('imageInput');
  if (imgInput) {
    imgInput.onchange = e => {
      const nf = Array.from(e.target.files);
      if (state.selectedFiles.length + nf.length > 10) return alert('最多 10 张！');
      state.selectedFiles = state.selectedFiles.concat(nf); renderPreviews(); e.target.value = '';
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

  // API 配置存档
  const profSel = $('apiProfileSelect');
  const loadProfiles = () => {
    profSel.innerHTML = '<option value="">-- 选择配置 --</option>';
    state.apiProfiles.forEach(p => { const o = document.createElement('option'); o.value = o.textContent = p.name; profSel.appendChild(o); });
  };
  if (profSel) {
    loadProfiles();
    profSel.onchange = e => {
      const p = state.apiProfiles.find(x => x.name === e.target.value); if (!p) return;
      $('baseUrl').value = p.baseUrl || ''; ls('nanscript_baseUrl', p.baseUrl || '');
      $('apiKey').value = p.apiKey || ''; ls('nanscript_apiKey', p.apiKey || '');
      if (p.modelGemini && $('modelGemini')) { $('modelGemini').value = p.modelGemini; ls('nanscript_modelGemini', p.modelGemini); }
      if (p.modelOpenai && $('modelOpenai')) { $('modelOpenai').value = p.modelOpenai; ls('nanscript_modelOpenai', p.modelOpenai); }
      $('apiProfileName').value = p.name;
      syncModelInput(); updatePreview(); showToast(`已加载: ${p.name}（可修改后保存覆盖）`);
    };
  }

  $('saveProfileBtn').onclick = () => {
    const name = $('apiProfileName').value.trim(); if (!name) return alert('请输入配置名称');
    const cfg = { name, baseUrl: $('baseUrl').value, apiKey: $('apiKey').value,
      modelGemini: $('modelGemini')?.value || PROVIDER_DEFAULTS.gemini.model,
      modelOpenai: $('modelOpenai')?.value || PROVIDER_DEFAULTS.openai.model };
    const i = state.apiProfiles.findIndex(p => p.name === name);
    i > -1 ? state.apiProfiles[i] = cfg : state.apiProfiles.push(cfg);
    ls('nanscript_api_profiles', JSON.stringify(state.apiProfiles));
    loadProfiles(); profSel.value = name; showToast(`配置 [${name}] 已保存`);
  };

  $('delProfileBtn').onclick = () => {
    const name = profSel.value; if (!name || !confirm(`删除 [${name}]？`)) return;
    state.apiProfiles = state.apiProfiles.filter(p => p.name !== name);
    ls('nanscript_api_profiles', JSON.stringify(state.apiProfiles));
    loadProfiles(); $('apiProfileName').value = ''; showToast('已删除');
  };

  // 应用并关闭 API 配置
  $('applyApiConfigBtn').onclick = () => {
    ['baseUrl', 'apiKey'].forEach(id => { if ($(id)) ls('nanscript_' + id, $(id).value); });
    const mg = $('modelGemini')?.value || PROVIDER_DEFAULTS.gemini.model;
    const mo = $('modelOpenai')?.value || PROVIDER_DEFAULTS.openai.model;
    ls('nanscript_modelGemini', mg); ls('nanscript_modelOpenai', mo);
    syncModelInput(); updatePreview();
    $('apiConfigModal').style.display = 'none';
    if (localFS.isActive()) {
      localFS.saveConfig().then(() => console.log('[localFS] config.json 已写入')).catch(e => { console.error('[localFS] saveConfig 失败:', e); showToast('配置写入本地失败', 'error'); });
    }
    showToast(`已应用 · Banana: ${mg} | Image-2: ${mo}`);
  };

  // 按钮绑定
  $('fetchModelsBtn').onclick = fetchModels;
  $('runBtn').onclick = () => enqueueTask();

  // 批量提交任务
  $('multiTaskBtn').onclick = () => {
    const count = Math.max(2, Math.min(parseInt($('multiTaskCount').value) || 3, 50));
    enqueueMultiple(count);
    $('clearQueueBtn').classList.remove('hidden');
  };
  $('clearQueueBtn').onclick = () => {
    clearQueue();
    $('clearQueueBtn').classList.add('hidden');
  };

  // 咒语书 - 添加文件夹
  $('addFolderBtn').onclick = () => {
    const n = $('newFolderInput').value.trim(); if (!n) return;
    state.promptLib.push({ folderName: n, prompts: [] }); $('newFolderInput').value = '';
    state.curFolder = state.promptLib.length - 1; saveLib(); renderFolders();
  };

  // 咒语书 - 附图
  $('newPromptImg').onchange = e => {
    const file = e.target.files[0]; if (!file) return;
    const img = new Image();
    img.onload = () => { const c = document.createElement('canvas'), s = 250 / img.width; c.width = 250; c.height = img.height * s; c.getContext('2d').drawImage(img, 0, 0, 250, c.height); state.pendingThumb = c.toDataURL('image/jpeg', 0.6); $('thumbStatus').style.display = 'block'; };
    img.src = URL.createObjectURL(file);
  };

  // 咒语书 - 保存
  $('addPromptBtn').onclick = () => {
    if (!state.promptLib.length) return alert('请先创建分类');
    const n = $('newPromptName').value.trim(), c = $('newPromptContent').value.trim();
    if (!n || !c) return alert('名称和内容必填');
    state.promptLib[state.curFolder].prompts.unshift({ name: n, content: c, thumb: state.pendingThumb });
    $('newPromptName').value = $('newPromptContent').value = $('newPromptImg').value = '';
    $('thumbStatus').style.display = 'none'; state.pendingThumb = null; saveLib(); renderPrompts();
  };

  // 历史记录操作
  $('clearHistoryBtn').onclick = () => { if (confirm('清空所有历史？')) { state.historyData = []; idb.set('nanscript_history_db', state.historyData); renderHistory(); } };

  // 打包下载
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

  // 导出/导入历史
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
        idb.set('nanscript_history_db', state.historyData); renderHistory(); showToast('导入成功');
      } catch { showToast('无效格式', 'error'); }
      e.target.value = '';
    };
    r.readAsText(file);
  };

  // 重绘
  $('confirmRedrawBtn').onclick = async () => {
    const src = $('redrawSourceThumb').src, p = $('redrawPrompt').value.trim();
    if (!p) return showToast('请输入修改建议', 'error');
    const btn = $('confirmRedrawBtn'); btn.disabled = true; btn.textContent = '重绘中...';
    try {
      state.selectedFiles = [await urlToFile(src, 'redraw.png', 'image/png')]; renderPreviews();
      $('promptInput').value = p; $('redrawModal').style.display = 'none'; executeGeneration();
    } catch { showToast('图片加载失败', 'error'); }
    finally { btn.disabled = false; btn.textContent = '确认重绘'; }
  };

  // 本地文件夹存储 - 使用能力检测替代 innerWidth
  const pickBtn = $('pickFolderBtn'), clearFolderBtnEl = $('clearFolderBtn');
  if (!supportsFileSystemAccess()) {
    const fsSection = $('localFsSection');
    if (fsSection) fsSection.style.display = 'none';
    if (pickBtn) pickBtn.disabled = true;
  } else {
    if (pickBtn) pickBtn.onclick = () => localFS.pick(showToast);
    if (clearFolderBtnEl) clearFolderBtnEl.onclick = async () => {
      if (!confirm('解除绑定后，将切换回浏览器缓存模式。确定解除吗？')) return;
      await localFS.clear(showToast);
    };
  }

  // 渲染历史记录项（支持本地模式异步加载缩略图）
  const renderHistoryItem = async (item) => {
    let thumbSrc = item.thumb || '';
    if (!thumbSrc && item.thumbFile && localFS.isActive()) {
      thumbSrc = await localFS.getImageURL(item.thumbFile, 'thumbs').catch(() => '');
    }
    return { ...item, _thumbSrc: thumbSrc || item.thumb || '' };
  };

  // 启动加载数据
  const initData = async () => {
    // 使用能力检测而非屏幕宽度来判断是否恢复本地文件夹
    const hasLocal = supportsFileSystemAccess() ? await localFS.restore() : false;

    if (hasLocal) {
      state.promptLib = await localFS.loadJSON('prompts.json', []);
      state.historyData = await localFS.loadJSON('history.json', []);
      const list = $('historyList');
      if (list) list.innerHTML = '<div class="text-center text-outline text-xs mt-8">正在从本地加载...</div>';
      const enriched = await Promise.all(state.historyData.map(renderHistoryItem));
      state.historyData = enriched;
      renderHistory();

      const galleryMeta = await localFS.loadJSON('gallery.json', []);
      if (galleryMeta.length) {
        const gallery = $('imageGallery'); gallery.innerHTML = '';
        for (const meta of galleryMeta) {
          if (!meta.imageFile) continue;
          const src = await localFS.getImageURL(meta.imageFile, 'originals').catch(() => '');
          if (!src) continue;
          state.currentGalleryData.push({ src, sec: meta.sec, ratio: meta.ratio, quality: meta.quality, prompt: meta.prompt, imageFile: meta.imageFile });
          gallery.appendChild(createGalleryItemDOM(src, meta.sec, meta.ratio, meta.quality));
        }
        if (state.currentGalleryData.length) {
          $('emptyState').style.display = 'none';
          $('resultArea').style.display = 'block';
          $('textResultSection').style.display = 'none';
        }
      }

      const refFiles = await localFS.loadJSON('current_refs.json', []);
      if (refFiles.length) {
        for (const fname of refFiles) {
          try {
            const url = await localFS.getImageURL(fname, 'refs');
            if (!url) continue;
            const blob = await (await fetch(url)).blob();
            state.selectedFiles.push(new File([blob], fname, { type: blob.type }));
          } catch (e) { console.warn('恢复垫图失败:', fname, e); }
        }
        if (state.selectedFiles.length) renderPreviews();
      }
      await localFS.loadConfig(syncModelInput, updatePreview);
    } else {
      idb.get('nanscript_prompt_lib').then(d => { if (Array.isArray(d) && d.length) state.promptLib = d; }).catch(() => {});
      idb.get('nanscript_history_db').then(d => {
        if (Array.isArray(d) && d.length) state.historyData = d;
        else try { const o = JSON.parse(ls('nanscript_history_db') || '[]'); if (o.length) { state.historyData = o; idb.set('nanscript_history_db', o); } } catch {}
        renderHistory();
      }).catch(() => renderHistory());
      idb.get('nanscript_current_refs').then(d => {
        if (Array.isArray(d) && d.length) {
          d.forEach((src, idx) => {
            if (src.startsWith('data:')) {
              const blob = base64ToBlob(src);
              if (blob) state.selectedFiles.push(new File([blob], `ref${idx}.png`, { type: blob.type }));
            }
          });
          renderPreviews();
        }
      }).catch(() => {});
      idb.get('nanscript_current_gallery').then(d => {
        if (Array.isArray(d) && d.length) {
          state.currentGalleryData = d;
          const gallery = $('imageGallery'); gallery.innerHTML = '';
          state.currentGalleryData.forEach(item => gallery.appendChild(createGalleryItemDOM(item.src, item.sec, item.ratio, item.quality)));
          $('emptyState').style.display = 'none';
          $('resultArea').style.display = 'block';
          $('textResultSection').style.display = 'none';
        }
      }).catch(() => {});
    }
  };
  initData();

  // 清空画廊
  if ($('clearGalleryBtn')) {
    $('clearGalleryBtn').onclick = () => {
      if (!confirm('确定要清空当前的画廊吗？（历史记录不会受影响）')) return;
      state.currentGalleryData = [];
      if (localFS.isActive()) localFS.saveJSON('gallery.json', []).catch(() => {});
      else idb.set('nanscript_current_gallery', []);
      $('imageGallery').innerHTML = '';
      $('resultArea').style.display = 'none';
      $('emptyState').style.display = 'block';
      showToast('画廊已清空');
    };
  }

  // ========== WebDAV 云同步初始化 ==========
  // 恢复保存的凭据到表单
  const wUrl = ls('nanscript_webdav_url');
  const wUser = ls('nanscript_webdav_user');
  const wPass = ls('nanscript_webdav_pass');
  if (wUrl && $('webdavUrl')) $('webdavUrl').value = wUrl;
  if (wUser && $('webdavUser')) $('webdavUser').value = wUser;
  if (wPass && $('webdavPass')) $('webdavPass').value = wPass;
  if (webdav.isConfigured()) {
    const badge = $('webdavBadge');
    if (badge) badge.classList.remove('hidden');
  }

  // 保存凭据
  $('webdavSaveBtn').onclick = () => {
    const url = $('webdavUrl').value.trim();
    const user = $('webdavUser').value.trim();
    const pass = $('webdavPass').value.trim();
    if (!url || !user || !pass) return showToast('请填写完整的 WebDAV 信息', 'error');
    webdav.saveCredentials(url, user, pass);
    const badge = $('webdavBadge');
    if (badge) badge.classList.remove('hidden');
    showToast('WebDAV 凭据已保存');
  };

  // 测试连接
  $('webdavTestBtn').onclick = async () => {
    const url = $('webdavUrl').value.trim();
    const user = $('webdavUser').value.trim();
    const pass = $('webdavPass').value.trim();
    if (!url || !user || !pass) return showToast('请先填写 WebDAV 信息', 'error');
    // 临时保存以便测试
    webdav.saveCredentials(url, user, pass);
    const st = $('webdavStatus');
    st.textContent = '正在测试连接...';
    st.classList.remove('hidden');
    const result = await webdav.testConnection();
    st.textContent = result.message;
    st.className = `text-[11px] font-bold ${result.ok ? 'text-success' : 'text-error'}`;
    if (result.ok) showToast('WebDAV 连接成功 ✅');
    else showToast(result.message, 'error');
  };

  // 上传到云端
  $('webdavUploadBtn').onclick = async () => {
    if (!webdav.isConfigured()) return showToast('请先保存 WebDAV 凭据', 'error');
    const btn = $('webdavUploadBtn'); btn.disabled = true;
    const st = $('webdavStatus'); st.textContent = '正在上传...'; st.classList.remove('hidden');
    try {
      const { success, failed } = await webdav.uploadAll();
      st.textContent = `✅ 上传完成: ${success} 成功` + (failed ? `, ${failed} 失败` : '');
      st.className = 'text-[11px] font-bold text-success';
      showToast(`☁️ 云端同步完成: ${success} 个文件`);
    } catch (e) {
      st.textContent = `❌ 上传失败: ${e.message}`;
      st.className = 'text-[11px] font-bold text-error';
      showToast(e.message, 'error');
    } finally { btn.disabled = false; }
  };

  // 从云端恢复
  $('webdavDownloadBtn').onclick = async () => {
    if (!webdav.isConfigured()) return showToast('请先保存 WebDAV 凭据', 'error');
    if (!confirm('从云端恢复将合并远端数据到本地。继续？')) return;
    const btn = $('webdavDownloadBtn'); btn.disabled = true;
    const st = $('webdavStatus'); st.textContent = '正在下载...'; st.classList.remove('hidden');
    try {
      const { success, failed, skipped } = await webdav.downloadAll({
        renderHistory, renderFolders, syncModelInput, updatePreview,
      });
      st.textContent = `✅ 恢复完成: ${success} 合并` + (skipped ? `, ${skipped} 跳过` : '') + (failed ? `, ${failed} 失败` : '');
      st.className = 'text-[11px] font-bold text-success';
      showToast(`☁️ 云端恢复完成`);
    } catch (e) {
      st.textContent = `❌ 恢复失败: ${e.message}`;
      st.className = 'text-[11px] font-bold text-error';
      showToast(e.message, 'error');
    } finally { btn.disabled = false; }
  };

  updatePreview();
});

// 移动端适配
initMobile();
