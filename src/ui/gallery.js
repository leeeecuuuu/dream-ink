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

import { $, base64ToBlob } from '../utils/helpers.js';
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

  const btnClass = 'p-1.5 text-white/80 hover:text-white hover:bg-white/20 active:bg-white/30 rounded-lg transition-all pointer-events-auto touch-manipulation';
  
  // ===== 操作按钮 =====
  const zoomBtn = el('button', {
    className: btnClass,
    title: '放大',
  }, icon('zoom_in', 'text-[18px] md:text-[20px] drop-shadow-md'));

  const copyBtn = el('button', {
    className: btnClass,
    title: '复制',
  }, icon('content_copy', 'text-[18px] md:text-[20px] drop-shadow-md'));

  const downBtn = el('button', {
    className: btnClass,
    title: '保存',
  }, icon('download', 'text-[18px] md:text-[20px] drop-shadow-md'));

  // 删除按钮
  const delBtn = el('button', {
    className: btnClass + ' hover:text-error hover:bg-error/20',
    title: '删除',
  }, icon('delete', 'text-[18px] md:text-[20px] drop-shadow-md'));

  const redrawBtn = el('button', {
    className: 'ml-auto px-3 py-1.5 text-[11px] md:text-[12px] font-bold text-white bg-white/10 hover:bg-white/20 active:bg-white/30 border border-white/20 rounded-lg transition-all pointer-events-auto touch-manipulation flex items-center gap-1 backdrop-blur-md drop-shadow-sm',
  }, icon('brush', 'text-[14px] md:text-[16px] drop-shadow-md'), ' 重绘');

  // 工具面板
  const toolPanel = el('div', {
    className: 'flex items-center gap-0.5 md:gap-1 w-full',
  }, zoomBtn, copyBtn, downBtn, delBtn, redrawBtn);

  // 悬浮蒙层 - 使用 gallery-overlay 并在 style.css 控制显隐
  const overlay = el('div', {
    className: 'gallery-overlay absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-2 md:p-3 pointer-events-none transition-all duration-300',
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
      let blob;
      if (src.startsWith('data:')) {
        blob = base64ToBlob(src);
      } else {
        blob = await (await fetch(src)).blob();
      }
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      showToast('已复制 📋');
    } catch (e) {
      showToast('复制失败: ' + e.message, 'error');
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
    // 自动将画幅尺寸设置为参考图尺寸
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const ratioStr = `${w}x${h}`;
      const ratioSel = $('ratioSelect');
      const customW = $('customWidth');
      const customH = $('customHeight');
      
      let isPreset = false;
      const drop = $('ratioDropdown');
      if (drop) {
        drop.querySelectorAll('.ratio-opt').forEach(opt => {
          if (opt.dataset.val === ratioStr) isPreset = true;
        });
      }

      if (ratioSel) {
        if (isPreset) {
          ratioSel.value = ratioStr;
          if (window._updateRatioUI) window._updateRatioUI(ratioStr);
        } else {
          ratioSel.value = 'custom';
          if (customW) customW.value = w;
          if (customH) customH.value = h;
          if (window._updateRatioUI) window._updateRatioUI('custom');
        }
        // 触发持久化保存与底部预览文本更新
        if (ratioSel.onchange) ratioSel.onchange({ target: ratioSel });
        if (customW && customW.onchange) customW.onchange({ target: customW });
        if (customH && customH.onchange) customH.onchange({ target: customH });
      }
      showToast(`已将生成画幅自动设为原图尺寸: ${w}x${h}`);
    };
    img.src = src;

    // 直接用 src (data: URL) 打开蒙版编辑器，无需额外转换
    state.selectedMasks = [];
    if (window._openMaskEditor) {
      window._openMaskEditor(src, 0, true /* fromGallery */);
    } else {
      showToast('蒙版编辑器未初始化', 'error');
    }
  };

  return container;
}
