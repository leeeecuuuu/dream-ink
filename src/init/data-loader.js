/**
 * data-loader.js — 数据加载与初始化
 *
 * 处理 LocalFS (File System Access) 和 IndexedDB 数据源的初始化。
 * 包括恢复历史记录、画廊、咒语书、以及垫图数据。
 */

import { $, ls, base64ToBlob } from '../utils/helpers.js';
import { supportsFileSystemAccess } from '../utils/feature-detect.js';
import { state } from '../state/app-state.js';
import { idb } from '../storage/idb.js';
import { localFS } from '../storage/local-fs.js';
import { createGalleryItemDOM } from '../ui/gallery.js';
import { showToast } from '../ui/toast.js';
import { bus } from '../utils/event-bus.js';
import { syncModelInput, updatePreview } from '../ui/engine.js';

export function initDataLoader() {
  // 本地文件夹存储 - 使用能力检测替代 innerWidth
  const pickBtn = $('pickFolderBtn'), clearFolderBtnEl = $('clearFolderBtn');
  if (!supportsFileSystemAccess()) {
    const fsSection = $('localFsSection');
    if (fsSection) fsSection.style.display = 'none';
    if (pickBtn) pickBtn.disabled = true;
  } else {
    if (pickBtn) pickBtn.onclick = () => localFS.pick(showToast, syncModelInput, updatePreview);
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
  const loadInitialData = async () => {
    // 使用能力检测而非屏幕宽度来判断是否恢复本地文件夹
    const hasLocal = supportsFileSystemAccess() ? await localFS.restore() : false;

    if (hasLocal) {
      state.promptLib = await localFS.loadJSON('prompts.json', []);
      state.historyData = await localFS.loadJSON('history.json', []);
      const list = $('historyList');
      const enriched = await Promise.all(state.historyData.map(renderHistoryItem));
      state.historyData = enriched;
      bus.emit('historyData:change');

      const galleryMeta = await localFS.loadJSON('gallery.json', []);
      if (galleryMeta.length) {
        const gallery = $('imageGallery'); if (gallery) gallery.innerHTML = '';
        for (const meta of galleryMeta) {
          if (!meta.imageFile) continue;
          const src = await localFS.getImageURL(meta.imageFile, 'originals').catch(() => '');
          if (!src) continue;
          state.currentGalleryData.push({ src, sec: meta.sec, ratio: meta.ratio, quality: meta.quality, prompt: meta.prompt, imageFile: meta.imageFile });
          if (gallery) gallery.appendChild(createGalleryItemDOM(src, meta.sec, meta.ratio, meta.quality));
        }
        if (state.currentGalleryData.length && $('emptyState')) {
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
        // 恢复蒙版
        const savedMasks = await localFS.loadJSON('current_masks.json', []);
        if (savedMasks.length) {
          state.selectedMasks = savedMasks;
        }
        const savedRoles = await localFS.loadJSON('current_ref_roles.json', []);
        if (Array.isArray(savedRoles) && savedRoles.length) {
          state.selectedRefRoles = savedRoles;
        }
        if (state.selectedFiles.length) bus.emit('selectedFiles:change');
      }
      await localFS.loadConfig(syncModelInput, updatePreview);
    } else {
      idb.get('nanscript_prompt_lib').then(d => { if (Array.isArray(d) && d.length) state.promptLib = d; }).catch(() => {});
      idb.get('nanscript_history_db').then(d => {
        if (Array.isArray(d) && d.length) state.historyData = d;
        else try { const o = JSON.parse(ls('nanscript_history_db') || '[]'); if (o.length) { state.historyData = o; idb.set('nanscript_history_db', o); } } catch {}
        bus.emit('historyData:change');
      }).catch(() => bus.emit('historyData:change'));
      
      idb.get('nanscript_current_refs').then(async d => {
        if (Array.isArray(d) && d.length) {
          d.forEach((src, idx) => {
            if (src.startsWith('data:')) {
              const blob = base64ToBlob(src);
              if (blob) state.selectedFiles.push(new File([blob], `ref${idx}.png`, { type: blob.type }));
            }
          });
          // 恢复蒙版
          const savedMasks = await idb.get('nanscript_current_masks').catch(() => null);
          if (Array.isArray(savedMasks) && savedMasks.length) {
            state.selectedMasks = savedMasks;
          }
          const savedRoles = await idb.get('nanscript_current_ref_roles').catch(() => null);
          if (Array.isArray(savedRoles) && savedRoles.length) {
            state.selectedRefRoles = savedRoles;
          }
          bus.emit('selectedFiles:change');
        }
      }).catch(() => {});
      
      idb.get('nanscript_current_gallery').then(d => {
        if (Array.isArray(d) && d.length) {
          state.currentGalleryData = d;
          const gallery = $('imageGallery'); if (gallery) gallery.innerHTML = '';
          state.currentGalleryData.forEach(item => {
            if (gallery) gallery.appendChild(createGalleryItemDOM(item.src, item.sec, item.ratio, item.quality));
          });
          if ($('emptyState')) {
            $('emptyState').style.display = 'none';
            $('resultArea').style.display = 'block';
            $('textResultSection').style.display = 'none';
          }
        }
      }).catch(() => {});
    }
  };
  loadInitialData();

  // 清空画廊
  const clearGalleryBtn = $('clearGalleryBtn');
  if (clearGalleryBtn) {
    clearGalleryBtn.onclick = () => {
      if (!confirm('确定要清空当前的画廊吗？（历史记录不会受影响）')) return;
      state.currentGalleryData = [];
      if (localFS.isActive()) localFS.saveJSON('gallery.json', []).catch(() => {});
      else idb.set('nanscript_current_gallery', []);
      const gallery = $('imageGallery'); if (gallery) gallery.innerHTML = '';
      if ($('resultArea')) $('resultArea').style.display = 'none';
      if ($('emptyState')) $('emptyState').style.display = 'block';
      showToast('画廊已清空');
    };
  }
}
