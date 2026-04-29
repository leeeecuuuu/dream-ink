/**
 * lightbox.js — 图片查看器（Zoom & Pan）
 *
 * 支持桌面端鼠标滚轮缩放 + 拖拽漫游，
 * 移动端双指缩放 + 单指拖拽。
 */

import { $ } from '../utils/helpers.js';

/**
 * 初始化 Lightbox 交互逻辑
 */
export function initLightbox() {
  const lb = $('lightbox');
  const img = $('lightboxImg');
  if (!lb || !img) return;

  let scale = 1;
  let pointX = 0;
  let pointY = 0;
  let start = { x: 0, y: 0 };
  let panning = false;
  let hasDragged = false;

  const setTransform = () => {
    img.style.transform = `translate(${pointX}px, ${pointY}px) scale(${scale})`;
    img.style.cursor = scale > 1 ? (panning ? 'grabbing' : 'grab') : 'zoom-in';
  };

  // 打开时重置状态
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((m) => {
      if (m.attributeName === 'style' && lb.style.display !== 'none') {
        scale = 1;
        pointX = 0;
        pointY = 0;
        img.style.transition = 'transform 0.2s ease';
        setTransform();
        setTimeout(() => (img.style.transition = 'none'), 200);
      }
    });
  });
  observer.observe(lb, { attributes: true });

  // 鼠标拖拽
  lb.addEventListener('mousedown', (e) => {
    if (e.target !== img || scale === 1) return;
    e.preventDefault();
    start = { x: e.clientX - pointX, y: e.clientY - pointY };
    panning = true;
    hasDragged = false;
    img.style.cursor = 'grabbing';
  });

  window.addEventListener('mousemove', (e) => {
    if (!panning) return;
    e.preventDefault();
    pointX = e.clientX - start.x;
    pointY = e.clientY - start.y;
    hasDragged = true;
    setTransform();
  });

  window.addEventListener('mouseup', () => {
    if (!panning) return;
    panning = false;
    img.style.cursor = scale > 1 ? 'grab' : 'zoom-in';
  });

  // 鼠标滚轮缩放
  lb.addEventListener(
    'wheel',
    (e) => {
      if (lb.style.display === 'none') return;
      e.preventDefault();

      const oldScale = scale;
      const delta = (e.wheelDelta ? e.wheelDelta : -e.deltaY) > 0 ? 1.2 : 0.8;
      scale *= delta;
      scale = Math.min(Math.max(1, scale), 4);

      if (scale === 1) {
        pointX = 0;
        pointY = 0;
      } else if (scale !== oldScale) {
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        pointX += (1 - scale / oldScale) * (e.clientX - cx - pointX);
        pointY += (1 - scale / oldScale) * (e.clientY - cy - pointY);
      }
      setTransform();
    },
    { passive: false }
  );

  // 点击关闭
  lb.addEventListener('click', (e) => {
    if (hasDragged) {
      hasDragged = false;
      return;
    }
    lb.style.display = 'none';
    scale = 1;
    pointX = 0;
    pointY = 0;
    setTransform();
  });

  // ========== 移动端触摸缩放 ==========
  let touchStartDist = 0;
  let touchStartScale = 1;
  let lbScale = 1;
  let lbX = 0, lbY = 0;
  let touchStartX = 0, touchStartY = 0;
  let touchStartLbX = 0, touchStartLbY = 0;
  let isDraggingTouch = false;

  const clamp = (v, mn, mx) => Math.max(mn, Math.min(mx, v));

  function applyLbTransform() {
    img.style.transform = `translate(${lbX}px, ${lbY}px) scale(${lbScale})`;
    img.style.transformOrigin = 'center center';
    img.style.transition = 'none';
  }

  function resetLbTransform() {
    lbScale = 1;
    lbX = 0;
    lbY = 0;
    img.style.transform = '';
    img.style.transition = '';
  }

  function getDist(t) {
    const dx = t[0].clientX - t[1].clientX;
    const dy = t[0].clientY - t[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  lb.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        touchStartDist = getDist(e.touches);
        touchStartScale = lbScale;
      } else if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchStartLbX = lbX;
        touchStartLbY = lbY;
        isDraggingTouch = false;
      }
    },
    { passive: false }
  );

  lb.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dist = getDist(e.touches);
        lbScale = clamp(touchStartScale * (dist / touchStartDist), 1, 8);
        applyLbTransform();
      } else if (e.touches.length === 1 && lbScale > 1) {
        e.preventDefault();
        const dx = e.touches[0].clientX - touchStartX;
        const dy = e.touches[0].clientY - touchStartY;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) isDraggingTouch = true;
        lbX = touchStartLbX + dx;
        lbY = touchStartLbY + dy;
        applyLbTransform();
      }
    },
    { passive: false }
  );

  lb.addEventListener('touchend', (e) => {
    if (e.touches.length === 0 && !isDraggingTouch && lbScale === 1) {
      lb.style.display = 'none';
      resetLbTransform();
    }
    isDraggingTouch = false;
  });

  // lightbox 关闭时重置 transform
  const lbObserver = new MutationObserver(() => {
    if (lb.style.display === 'none') resetLbTransform();
  });
  lbObserver.observe(lb, { attributes: true, attributeFilter: ['style'] });
}
