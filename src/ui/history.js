/**
 * history.js — 历史记录模块
 *
 * 管理生成记录的保存、渲染和详情展示。
 * 使用 createElement 安全构建所有 DOM 结构。
 */

import { $, escHtml, base64ToBlob } from '../utils/helpers.js';
import { el, icon, clearChildren } from '../utils/dom.js';
import { idb } from '../storage/idb.js';
import { localFS } from '../storage/local-fs.js';
import { state } from '../state/app-state.js';
import { showToast } from './toast.js';
import { bus } from '../utils/event-bus.js';

const historyFilters = {
  query: '',
  engine: 'all',
  favoriteOnly: false,
};

export function persistHistoryData() {
  if (localFS.isActive()) {
    const toSave = state.historyData.map(({ _thumbSrc, ...rest }) => rest);
    return localFS.saveJSON('history.json', toSave).catch(() => {});
  }
  return idb.set('nanscript_history_db', state.historyData);
}

function normalizeText(value = '') {
  return String(value || '').trim().toLowerCase();
}

function historySearchHaystack(item) {
  return [
    item.prompt,
    item.model,
    item.aspectRatio,
    item.quality,
    item.apiType,
    item.date,
  ].map(normalizeText).join(' ');
}

function matchesHistoryFilters(item) {
  if (historyFilters.favoriteOnly && !item.favorite) return false;
  if (historyFilters.engine !== 'all' && (item.apiType || '') !== historyFilters.engine) return false;
  if (historyFilters.query && !historySearchHaystack(item).includes(historyFilters.query)) return false;
  return true;
}

function updateHistoryFilterSummary(total, visible) {
  const summary = $('historyFilterSummary');
  if (!summary) return;
  const activeFilters = [];
  if (historyFilters.query) activeFilters.push(`关键词“${historyFilters.query}”`);
  if (historyFilters.engine !== 'all') activeFilters.push(historyFilters.engine === 'openai' ? 'GPT Image-2' : 'Banana');
  if (historyFilters.favoriteOnly) activeFilters.push('只看收藏');
  summary.textContent = activeFilters.length ? `已筛选 ${visible} / ${total} 条 · ${activeFilters.join(' · ')}` : `共 ${total} 条记录`;
}

function createEmptyHistoryMessage(text) {
  return el('div', {
    style: 'text-align:center;color:var(--text-muted);font-size:0.85rem;margin-top:40px;line-height:1.8',
    textContent: text,
  });
}

/**
 * 保存一条历史记录
 * @param {Object} params - 生成参数
 * @param {string} b64Img - 原图 Base64
 * @param {string[]} refImages - 参考图 Base64 数组
 * @param {string|null} presetId - 预设 ID（用于共享 gallery 和 history 的文件名）
 */
export function saveHistory(params, b64Img, refImages = [], presetId = null) {
  const originalImageSrc = b64Img;
  const img = new Image();
  img.crossOrigin = 'anonymous';

  img.onload = () => {
    let thumbStr = originalImageSrc;
    try {
      const c = document.createElement('canvas');
      const s = 400 / img.width;
      c.width = 400;
      c.height = img.height * s;
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      thumbStr = c.toDataURL('image/jpeg', 0.85);
    } catch (e) {
      console.warn('Canvas Taint, using original src for thumb');
    }
    _doSave(thumbStr);
  };
  img.onerror = () => _doSave(originalImageSrc);
  img.src = originalImageSrc;

  async function _doSave(thumb) {
    const id = presetId || Date.now().toString();
    const date = (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    })();

    if (localFS.isActive()) {
      // 本地模式：原图存 originals/，缩略图存 thumbs/
      const imageFile = `${id}.png`;
      const thumbFile = `${id}_thumb.jpg`;
      try { await localFS.saveImage(imageFile, originalImageSrc, 'originals'); } catch (e) { console.warn('写入原图失败', e); }
      try { await localFS.saveImage(thumbFile, thumb, 'thumbs'); } catch (e) { console.warn('写入缩略图失败', e); }

      // 将垫图存入 refs/ 子目录
      const refFiles = [];
      if (Array.isArray(refImages) && refImages.length) {
        for (let i = 0; i < refImages.length; i++) {
          const refFname = `${id}_ref${i}.png`;
          try {
            await localFS.saveImage(refFname, refImages[i], 'refs');
            refFiles.push(refFname);
          } catch (e) { console.warn('写入垫图失败', e); }
        }
      }

      const maskFiles = [];
      if (Array.isArray(params.masks) && params.masks.length) {
        for (let i = 0; i < params.masks.length; i++) {
          if (!params.masks[i]) {
            maskFiles.push(null);
            continue;
          }
          const maskFname = `${id}_mask${i}.png`;
          try {
            await localFS.saveImage(maskFname, params.masks[i], 'refs');
            maskFiles.push(maskFname);
          } catch (e) { console.warn('写入蒙版失败', e); maskFiles.push(null); }
        }
      }

      state.historyData.unshift({
        id, date, prompt: params.prompt || '纯图生成', model: params.model,
        aspectRatio: params.aspectRatio, quality: params.quality,
        batchCount: params.batchCount, apiType: $('apiTypeSelect')?.value || 'gemini',
        imageFile, thumbFile, _thumbSrc: thumb, refFiles, refImages: [],
        maskFiles, maskImages: [], favorite: false
      });

      if (state.historyData.length > 100) state.historyData = state.historyData.slice(0, 100);
      await persistHistoryData();
    } else {
      state.historyData.unshift({
        id, date, prompt: params.prompt || '纯图生成', model: params.model,
        aspectRatio: params.aspectRatio, quality: params.quality,
        batchCount: params.batchCount, apiType: $('apiTypeSelect')?.value || 'gemini',
        thumb, fullImage: originalImageSrc, refImages,
        maskImages: params.masks || [], favorite: false
      });

      if (state.historyData.length > 100) state.historyData = state.historyData.slice(0, 100);
      persistHistoryData();
    }
    bus.emit('historyData:change');
  }
}

/**
 * 渲染历史记录列表（安全 DOM 构建）
 */
export function renderHistory() {
  const list = $('historyList');
  if (!list) return;

  const total = state.historyData.length;

  if (!state.historyData.length) {
    clearChildren(list);
    updateHistoryFilterSummary(0, 0);
    list.appendChild(createEmptyHistoryMessage('暂无历史记录'));
    return;
  }

  clearChildren(list);

  const filteredHistory = state.historyData
    .map((item, idx) => ({ item, idx }))
    .filter(({ item }) => matchesHistoryFilters(item));

  updateHistoryFilterSummary(total, filteredHistory.length);

  if (!filteredHistory.length) {
    list.appendChild(createEmptyHistoryMessage('没有匹配的历史记录\n试试更换关键词或筛选条件'));
    return;
  }

  filteredHistory.forEach(({ item, idx }) => {
    const thumbSrc = item._thumbSrc || item.thumb || '';

    // 缩略图
    const thumbImg = el('img', {
      src: thumbSrc,
      className: 'w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity',
    });

    const thumbBox = el('div', {
      className: 'w-16 h-16 rounded-lg bg-surface-container overflow-hidden flex-shrink-0 border border-outline-variant/50 relative',
    }, thumbImg);

    // 标题（安全使用 textContent）
    const title = el('span', {
      className: 'text-[11px] text-primary uppercase tracking-widest font-bold mb-1.5 line-clamp-1',
      textContent: item.prompt,
    });

    // 参数标签
    const badges = [item.aspectRatio, item.quality, item.batchCount > 1 ? `x${item.batchCount}` : '']
      .filter(Boolean)
      .map(b => el('span', {
        className: 'bg-surface-container text-on-surface-variant px-1.5 py-0.5 rounded text-[9px] border border-outline-variant uppercase tracking-widest',
        textContent: b,
      }));

    const badgeRow = el('div', { className: 'flex gap-1.5 flex-wrap mb-1.5' }, ...badges);

    // 日期
    const dateText = el('span', {
      className: 'text-[9px] text-on-surface-variant/60 italic',
      textContent: item.date,
    });

    // 信息区
    const info = el('div', {
      className: 'flex flex-col justify-center flex-1 min-w-0',
    }, title, badgeRow, dateText);

    const favBtn = el('button', {
      className: `shrink-0 p-1.5 rounded-lg transition-all ${item.favorite ? 'text-amber-400 bg-amber-400/10' : 'text-on-surface-variant/60 group-hover:text-on-surface-variant hover:text-amber-400 hover:bg-amber-400/10'}`,
      title: item.favorite ? '取消收藏' : '收藏这条记录',
      'aria-label': item.favorite ? '取消收藏' : '收藏这条记录',
    }, icon(item.favorite ? 'star' : 'star_border', 'text-[16px]'));

    // 删除按钮
    const delBtn = el('button', {
      className: 'hd shrink-0 p-1.5 text-on-surface-variant/60 group-hover:text-error hover:text-error hover:bg-error/10 rounded-lg transition-all',
    }, icon('delete', 'text-[16px]'));

    const actionCol = el('div', {
      className: 'flex flex-col items-center justify-start gap-1 pt-1 shrink-0',
    }, favBtn, delBtn);

    // 行容器
    const row = el('div', {
      className: 'flex gap-3 group cursor-pointer hover:bg-surface-container-high/40 p-2 rounded-xl transition-all duration-300 relative border border-transparent hover:border-outline-variant/30',
    }, thumbBox, info, actionCol);

    // 绑定事件
    row.onclick = () => showHistoryDetail(item, idx);

    favBtn.onclick = (e) => {
      e.stopPropagation();
      item.favorite = !item.favorite;
      persistHistoryData();
      bus.emit('historyData:change');
      showToast(item.favorite ? '已收藏' : '已取消收藏');
    };

    delBtn.onclick = (e) => {
      e.stopPropagation();
      const currentIdx = state.historyData.indexOf(item);
      if (currentIdx === -1) return;
      state.historyData.splice(currentIdx, 1);
      persistHistoryData();
      bus.emit('historyData:change');
    };

    list.appendChild(row);
  });
}

export function initHistoryFilters() {
  const search = $('historySearchInput');
  const engine = $('historyEngineFilter');
  const favorite = $('historyFavoriteFilter');

  if (search && !search.dataset.bound) {
    search.addEventListener('input', () => {
      historyFilters.query = normalizeText(search.value);
      renderHistory();
    });
    search.dataset.bound = 'true';
  }

  if (engine && !engine.dataset.bound) {
    engine.addEventListener('change', () => {
      historyFilters.engine = engine.value || 'all';
      renderHistory();
    });
    engine.dataset.bound = 'true';
  }

  if (favorite && !favorite.dataset.bound) {
    favorite.addEventListener('click', () => {
      historyFilters.favoriteOnly = !historyFilters.favoriteOnly;
      favorite.classList.toggle('text-amber-400', historyFilters.favoriteOnly);
      favorite.classList.toggle('border-amber-400/40', historyFilters.favoriteOnly);
      favorite.classList.toggle('bg-amber-400/10', historyFilters.favoriteOnly);
      favorite.title = historyFilters.favoriteOnly ? '显示全部历史' : '只看收藏';
      renderHistory();
    });
    favorite.dataset.bound = 'true';
  }
}

/**
 * 显示历史记录详情
 * @param {Object} item - 历史记录项
 * @param {number} idx - 索引
 * @param {'history'|'library'} mode - 来源模式
 */
export async function showHistoryDetail(item, idx, mode = 'history') {
  state.currentHistoryIdx = idx;
  state.currentDetailMode = mode;

  // 本地模式：从 originals/ 加载原图
  let imgSrc = '';
  if (localFS.isActive() && item.imageFile) {
    imgSrc = await localFS.getImageURL(item.imageFile, 'originals').catch(() => '');
  }
  // 浏览器模式：直接用 fullImage
  if (!imgSrc) imgSrc = item.fullImage || item._thumbSrc || item.thumb || '';

  if (imgSrc && !imgSrc.endsWith('index.html')) {
    $('hdImage').src = imgSrc;
    $('hdImage').style.display = 'block';
  } else {
    $('hdImage').style.display = 'none';
  }

  // 移动端成品图同步填充
  const hdMobileImg = $('hdMobileImage');
  const hdMobileImgWrap = $('hdMobileGeneratedImg');
  if (hdMobileImgWrap) {
    if (imgSrc && !imgSrc.endsWith('index.html')) {
      hdMobileImg.src = imgSrc;
      hdMobileImgWrap.style.display = '';
      hdMobileImgWrap.onclick = () => {
        $('lightboxImg').src = imgSrc;
        $('lightbox').style.display = 'flex';
      };
    } else {
      hdMobileImgWrap.style.display = 'none';
    }
  }

  $('hdDate').textContent = mode === 'library' ? `🔖 ${item.name}` : item.date;
  $('hdModel').textContent = item.model || '';
  $('hdPrompt').value = item.content || (item.prompt === '纯图生成' ? '' : item.prompt) || '';
  $('hdRatio').textContent = item.aspectRatio || '';
  $('hdQuality').textContent = item.quality || '';

  $('hdRatio').style.display = item.aspectRatio ? 'inline-block' : 'none';
  $('hdQuality').style.display = item.quality ? 'inline-block' : 'none';
  $('hdAddLibBtn').style.display = mode === 'library' ? 'none' : 'inline-block';

  $('hdImage').onclick = () => {
    if ($('hdImage').src) {
      $('lightboxImg').src = $('hdImage').src;
      $('lightbox').style.display = 'flex';
    }
  };

  // 参考图区域
  const refGroup = $('hdRefImagesGroup');
  const refList = $('hdRefImages');
  const hasRefFiles = localFS.isActive() && Array.isArray(item.refFiles) && item.refFiles.length;
  const hasRefImages = Array.isArray(item.refImages) && item.refImages.length;
  const hasMaskFiles = localFS.isActive() && Array.isArray(item.maskFiles) && item.maskFiles.some(m => m);
  const hasMaskImages = Array.isArray(item.maskImages) && item.maskImages.some(m => m);

  const refSrcs = [];

  if (hasRefFiles || hasRefImages || hasMaskFiles || hasMaskImages) {
    refGroup.style.display = 'block';
    clearChildren(refList);

    if (hasRefFiles) {
      for (const fname of item.refFiles) {
        const src = await localFS.getImageURL(fname, 'refs').catch(() => '');
        if (!src) continue;
        refSrcs.push(src);
        const div = el('div', { className: 'preview-item' },
          el('img', { src })
        );
        refList.appendChild(div);
      }
    } else if (hasRefImages) {
      item.refImages.forEach(src => {
        refSrcs.push(src);
        const div = el('div', { className: 'preview-item' },
          el('img', { src })
        );
        refList.appendChild(div);
      });
    }

    if (hasMaskFiles) {
      for (const fname of item.maskFiles) {
        if (!fname) continue;
        const src = await localFS.getImageURL(fname, 'refs').catch(() => '');
        if (!src) continue;
        refSrcs.push(src);
        const div = el('div', { className: 'preview-item relative group' },
          el('img', { src, className: 'opacity-80 group-hover:opacity-100', style: 'border: 2px dashed var(--color-primary);' })
        );
        refList.appendChild(div);
      }
    } else if (hasMaskImages) {
      item.maskImages.forEach(src => {
        if (!src) return;
        refSrcs.push(src);
        const div = el('div', { className: 'preview-item relative group' },
          el('img', { src, className: 'opacity-80 group-hover:opacity-100', style: 'border: 2px dashed var(--color-primary);' })
        );
        refList.appendChild(div);
      });
    }
  } else {
    refGroup.style.display = 'none';
  }

  // 移动端顶部垫图缩略栏
  const mobileRefBar = $('hdMobileRefBar');
  if (mobileRefBar) {
    clearChildren(mobileRefBar);
    if (refSrcs.length) {
      refSrcs.forEach(src => {
        const refImg = el('img', { src, alt: '垫图' });
        refImg.onclick = () => {
          $('lightboxImg').src = src;
          $('lightbox').style.display = 'flex';
        };
        mobileRefBar.appendChild(refImg);
      });
      mobileRefBar.style.display = '';
    } else {
      mobileRefBar.style.display = 'none';
    }
  }

  $('historyDetailModal').style.display = 'flex';
}

// 订阅事件总线
bus.on('historyData:change', renderHistory);
