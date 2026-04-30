/**
 * preview.js — 图片预览模块
 *
 * 处理上传垫图的预览、悬浮放大及持久化逻辑。
 */

import { $, fileToB64 } from '../utils/helpers.js';
import { el, icon } from '../utils/dom.js';
import { state } from '../state/app-state.js';
import { localFS } from '../storage/local-fs.js';
import { idb } from '../storage/idb.js';
import { bus } from '../utils/event-bus.js';

export function renderPreviews() {
  const list = $('imagePreviewList');
  if (!list) return;
  list.innerHTML = '';
  state.selectedFiles.forEach((f, i) => {
    const wrapper = el('div', { className: 'relative group w-20 h-20 rounded-md mt-2' });

    // 缩略图 canvas（80x80，使用 object-cover 裁剪保持比例）
    const previewCanvas = el('canvas', {
      className: 'rounded-md border border-outline-variant/50 relative z-10',
      style: 'display: block; width: 80px; height: 80px;',
    });
    // 使用 devicePixelRatio 保证 retina 清晰
    const dpr = window.devicePixelRatio || 1;
    previewCanvas.width = 80 * dpr;
    previewCanvas.height = 80 * dpr;
    const pCtx = previewCanvas.getContext('2d');
    pCtx.scale(dpr, dpr);

    const objectUrl = URL.createObjectURL(f);

    // object-cover 裁剪辅助函数
    function drawCover(ctx, img, dw, dh) {
      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;
      const scale = Math.max(dw / iw, dh / ih);
      const sw = dw / scale;
      const sh = dh / scale;
      const sx = (iw - sw) / 2;
      const sy = (ih - sh) / 2;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
    }

    // 在高分辨率 canvas 上合成原图+蒙版（用于悬停预览）
    function buildHiResComposite(baseImg, maskDataUrl, callback) {
      const iw = baseImg.naturalWidth || baseImg.width;
      const ih = baseImg.naturalHeight || baseImg.height;
      // 保持原图宽高比，限制最大边为 640
      const maxSide = 640;
      const ratio = Math.min(maxSide / iw, maxSide / ih);
      const hiW = Math.round(iw * ratio);
      const hiH = Math.round(ih * ratio);

      const hiCanvas = document.createElement('canvas');
      hiCanvas.width = hiW;
      hiCanvas.height = hiH;
      const hiCtx = hiCanvas.getContext('2d');
      // 使用 cover 裁剪（整块 canvas 铺满原图，无透明边缘）
      hiCtx.drawImage(baseImg, 0, 0, hiW, hiH);

      if (!maskDataUrl) {
        callback(hiCanvas.toDataURL('image/png'));
        return;
      }
      const maskImg = new Image();
      maskImg.onload = () => {
        // 临时 canvas 解析蒙版
        const tmpCanvas = document.createElement('canvas');
        tmpCanvas.width = hiW;
        tmpCanvas.height = hiH;
        const tmpCtx = tmpCanvas.getContext('2d');
        tmpCtx.drawImage(maskImg, 0, 0, hiW, hiH);
        const maskData = tmpCtx.getImageData(0, 0, hiW, hiH);
        // 红色叠加
        const overlayData = hiCtx.createImageData(hiW, hiH);
        for (let p = 0; p < maskData.data.length; p += 4) {
          if (maskData.data[p + 3] < 128) {
            overlayData.data[p]     = 239;
            overlayData.data[p + 1] = 68;
            overlayData.data[p + 2] = 68;
            overlayData.data[p + 3] = 160;
          }
        }
        const tmpOv = document.createElement('canvas');
        tmpOv.width = hiW; tmpOv.height = hiH;
        tmpOv.getContext('2d').putImageData(overlayData, 0, 0);
        hiCtx.drawImage(tmpOv, 0, 0);
        callback(hiCanvas.toDataURL('image/png'));
      };
      maskImg.src = maskDataUrl;
    }

    const baseImg = new Image();
    let hiResDataUrl = ''; // 缓存高清合成图供悬停用

    baseImg.onload = () => {
      // 1. 绘制缩略图（object-cover 裁剪）
      pCtx.clearRect(0, 0, 80, 80);
      drawCover(pCtx, baseImg, 80, 80);

      const maskDataUrl = state.selectedMasks && state.selectedMasks[i];

      // 2. 有蒙版时，缩略图叠加红色遮罩
      if (maskDataUrl) {
        const maskImg = new Image();
        maskImg.onload = () => {
          const iw = baseImg.naturalWidth || baseImg.width;
          const ih = baseImg.naturalHeight || baseImg.height;
          const scale = Math.max(80 / iw, 80 / ih);
          const sw = 80 / scale;
          const sh = 80 / scale;
          const sx = (iw - sw) / 2;
          const sy = (ih - sh) / 2;

          const tmpCanvas = document.createElement('canvas');
          tmpCanvas.width = 80; tmpCanvas.height = 80;
          const tmpCtx = tmpCanvas.getContext('2d');
          tmpCtx.drawImage(maskImg, sx, sy, sw, sh, 0, 0, 80, 80);
          const maskData = tmpCtx.getImageData(0, 0, 80, 80);

          const overlayData = pCtx.createImageData(80, 80);
          for (let p = 0; p < maskData.data.length; p += 4) {
            if (maskData.data[p + 3] < 128) {
              overlayData.data[p]     = 239;
              overlayData.data[p + 1] = 68;
              overlayData.data[p + 2] = 68;
              overlayData.data[p + 3] = 160;
            }
          }
          const tmpOv = document.createElement('canvas');
          tmpOv.width = 80; tmpOv.height = 80;
          tmpOv.getContext('2d').putImageData(overlayData, 0, 0);
          pCtx.drawImage(tmpOv, 0, 0);

          // 角标
          const badge = el('div', {
            className: 'absolute top-0.5 left-0.5 w-2.5 h-2.5 rounded-full bg-red-500 border border-white z-[65] shadow-sm',
            title: '已设置蒙版，将局部重绘',
          });
          wrapper.appendChild(badge);
        };
        maskImg.src = maskDataUrl;
      }

      // 3. 预构建高清合成图（供悬停预览用）
      buildHiResComposite(baseImg, maskDataUrl, (dataUrl) => {
        hiResDataUrl = dataUrl;
      });
    };
    baseImg.src = objectUrl;

    // 悬停放大预览
    previewCanvas.onmouseenter = () => {
      let hp = document.getElementById('globalHoverPreview');
      if (!hp) {
        hp = el('img', {
          id: 'globalHoverPreview',
          className: 'fixed object-cover bg-surface rounded-lg shadow-[0_10px_40px_rgba(0,0,0,0.5)] pointer-events-none transition-opacity duration-200 z-[9999] border border-outline-variant/30',
        });
        document.body.appendChild(hp);
      }
      // 使用高清合成图，fallback 到原图
      hp.src = hiResDataUrl || objectUrl;
      const rect = previewCanvas.getBoundingClientRect();
      hp.style.left = `${rect.right + 16}px`;

      // 动态计算预览图的实际显示尺寸
      const iw = baseImg.naturalWidth || baseImg.width || 1;
      const ih = baseImg.naturalHeight || baseImg.height || 1;
      
      // 目标：宽度基准 320px，高度上限 500px，保持比例
      let displayWidth = 320;
      let displayHeight = 320 * (ih / iw);
      
      // 如果按 320 宽计算出的高度超过了 500，则以 500 高度为基准反推宽度
      if (displayHeight > 500) {
        displayHeight = 500;
        displayWidth = 500 * (iw / ih);
      }
      
      // 精确赋值给 img，使其边框完全贴合图片边缘（消除黑边）
      hp.style.width = `${displayWidth}px`;
      hp.style.height = `${displayHeight}px`;
      
      // 默认与缩略图垂直居中对齐
      let topPos = rect.top + (rect.height / 2) - (displayHeight / 2);
      
      // 上下边界碰撞检测
      if (topPos < 20) {
        topPos = 20;
      }
      if (topPos + displayHeight + 20 > window.innerHeight) {
        topPos = window.innerHeight - displayHeight - 20;
      }
      
      hp.style.top = `${topPos}px`;
      hp.style.opacity = '1';
    };

    previewCanvas.onmouseleave = () => {
      const hp = document.getElementById('globalHoverPreview');
      if (hp) hp.style.opacity = '0';
    };

    const brushBtn = el('button', {
      className: 'absolute bottom-1 right-1 bg-surface-container/80 text-primary hover:text-white hover:bg-primary backdrop-blur-md rounded px-1.5 py-0.5 z-[60] shadow-sm transition-colors opacity-0 group-hover:opacity-100 flex items-center gap-1',
      title: '涂抹编辑蒙版'
    }, icon('brush', 'text-[12px]'));

    brushBtn.onclick = (e) => {
      e.stopPropagation();
      if (window._openMaskEditor) {
        // 传 objectUrl 让编辑器加载（data URL 和 blob URL 均支持）
        window._openMaskEditor(objectUrl, i);
      }
    };

    const closeBtn = el('button', {
      className: 'absolute -top-2 -right-2 bg-error text-white rounded-full w-5 h-5 flex items-center justify-center z-[60] shadow-md hover:bg-red-600 transition-transform hover:scale-110',
    }, icon('close', 'text-[14px]'));

    closeBtn.onclick = () => { 
      state.selectedFiles.splice(i, 1); 
      // 清理相关 mask
      if (state.selectedMasks && state.selectedMasks[i]) {
        state.selectedMasks.splice(i, 1);
      }
      URL.revokeObjectURL(objectUrl);
      bus.emit('selectedFiles:change'); 
    };
    wrapper.append(previewCanvas, brushBtn, closeBtn);
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
      // 同时持久化蒙版（data URL 字符串数组）
      await localFS.saveJSON('current_masks.json', state.selectedMasks || []).catch(() => {});
    } else {
      idb.set('nanscript_current_refs', b64s);
      // 同时持久化蒙版
      idb.set('nanscript_current_masks', state.selectedMasks || []);
    }
  }).catch(() => {});
}

// 订阅事件总线
bus.on('selectedFiles:change', renderPreviews);
