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

    closeBtn.onclick = () => { 
      state.selectedFiles.splice(i, 1); 
      bus.emit('selectedFiles:change'); 
    };
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

// 订阅事件总线
bus.on('selectedFiles:change', renderPreviews);
