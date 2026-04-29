/**
 * gallery.js — 画廊渲染模块
 *
 * 使用 createElement 安全构建画廊项 DOM，
 * 消除原 createGalleryItemDOM 中的 innerHTML XSS 风险。
 *
 * 功能变更：
 *  - 新增单张图片删除按钮
 *  - 移动端操作栏常驻显示（替代 hover 逻辑）
 */

import { $ } from '../utils/helpers.js';
import { el, icon } from '../utils/dom.js';
import { state } from '../state/app-state.js';
import { localFS } from '../storage/local-fs.js';
import { idb } from '../storage/idb.js';
import { showToast } from './toast.js';
import { supportsClipboardWrite } from '../utils/feature-detect.js';

/**
 * 持久化当前画廊数据
 * @private
 */
function _persistGallery() {
  if (localFS.isActive()) {
    localFS.saveJSON('gallery.json', state.currentGalleryData.map(i => ({
      sec: i.sec, ratio: i.ratio, quality: i.quality, prompt: i.prompt, imageFile: i.imageFile,
    }))).catch(() => {});
  } else {
    idb.set('nanscript_current_gallery', state.currentGalleryData);
  }
}

/**
 * 安全创建单个画廊图片项的 DOM
 * @param {string} src - 图片 src（Base64 或 Blob URL）
 * @param {string} sec - 生成耗时（秒）
 * @param {string} ratio - 画幅比例
 * @param {string} quality - 图像质量
 * @param {number} [index] - 在 currentGalleryData 中的索引（用于删除）
 * @returns {HTMLDivElement}
 */
export function createGalleryItemDOM(src, sec, ratio, quality, index) {
  // 图片元素
  const img = el('img', {
    src,
    className: 'w-full object-cover gallery-img transition-transform duration-500 group-hover:scale-105',
    style: 'cursor: zoom-in;',
  });

  // ===== 操作按钮 =====
  const zoomBtn = el('button', {
    className: 'gallery-action-btn',
    title: '放大',
  }, icon('zoom_in', 'text-[18px]'));

  const copyBtn = el('button', {
    className: 'gallery-action-btn',
    title: '复制',
  }, icon('content_copy', 'text-[18px]'));

  const downBtn = el('button', {
    className: 'gallery-action-btn',
    title: '保存',
  }, icon('download', 'text-[18px]'));

  // 删除按钮（新增功能）
  const delBtn = el('button', {
    className: 'gallery-action-btn gallery-del-btn',
    title: '删除',
  }, icon('delete', 'text-[18px]'));

  const redrawBtn = el('button', {
    className: 'gallery-redraw-btn',
  }, icon('brush', 'text-[14px]'), ' 重绘');

  // 工具面板 — 移动端通过 CSS 常驻显示，桌面端 hover 显示
  const toolPanel = el('div', {
    className: 'gallery-tool-panel glass-panel p-2 rounded-xl flex justify-between items-center gap-2 pointer-events-auto',
  },
    el('div', { className: 'flex gap-1' }, zoomBtn, copyBtn, downBtn, delBtn),
    redrawBtn
  );

  // 悬浮蒙层
  const overlay = el('div', {
    className: 'gallery-overlay absolute inset-0 bg-black/40 flex flex-col justify-end p-3 pointer-events-none transition-opacity duration-300',
  }, toolPanel);

  // 耗时标签
  const timeLabel = el('div', {
    className: 'absolute top-3 left-3 bg-black/50 backdrop-blur-md text-white px-2.5 py-1 rounded-md text-[10px] font-bold tracking-widest uppercase pointer-events-none shadow-sm border border-white/10',
    textContent: `⏱️ ${sec}秒`,
  });

  // 容器
  const container = el('div', {
    className: 'masonry-item gallery-item relative group rounded-xl overflow-hidden bg-surface-container border border-outline-variant/30',
  }, img, overlay, timeLabel);

  // ===== 事件绑定 =====
  const openZoom = () => {
    $('lightboxImg').src = src;
    $('lightbox').style.display = 'flex';
  };

  img.onclick = openZoom;
  zoomBtn.onclick = openZoom;

  copyBtn.onclick = async () => {
    if (!supportsClipboardWrite()) {
      showToast('浏览器不支持复制图片', 'error');
      return;
    }
    try {
      const blob = await (await fetch(src)).blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      showToast('已复制 📋');
    } catch (e) {
      showToast('复制失败', 'error');
    }
  };

  downBtn.onclick = () => {
    const a = document.createElement('a');
    a.href = src;
    a.download = `${(ratio || 'Auto').replace(':', 'x')}_${quality}_${Math.random().toString(36).slice(2, 10)}.png`;
    a.click();
  };

  // 删除单张图
  delBtn.onclick = (e) => {
    e.stopPropagation();
    // 从数据中删除
    const idx = state.currentGalleryData.findIndex(item => item.src === src);
    if (idx > -1) {
      state.currentGalleryData.splice(idx, 1);
      _persistGallery();
    }
    // DOM 淡出移除
    container.style.transition = 'opacity 0.3s, transform 0.3s';
    container.style.opacity = '0';
    container.style.transform = 'scale(0.9)';
    setTimeout(() => {
      container.remove();
      // 如果画廊为空，显示空状态
      if (!state.currentGalleryData.length) {
        $('resultArea').style.display = 'none';
        $('emptyState').style.display = 'block';
      }
    }, 300);
  };

  redrawBtn.onclick = () => {
    $('redrawSourceThumb').src = src;
    $('redrawPrompt').value = '';
    $('redrawModal').style.display = 'flex';
  };

  return container;
}
