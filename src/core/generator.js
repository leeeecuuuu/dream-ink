/**
 * generator.js — 核心图像生成模块
 *
 * 包含 executeGeneration 主函数，负责：
 * - 构建 API 请求（Gemini / OpenAI）
 * - 管理并发批量生成
 * - 骨架屏占位与计时器
 * - 生成结果写入画廊和历史记录
 *
 * 使用安全 DOM 构建骨架屏占位元素。
 */

import { $, fileToB64, ls } from '../utils/helpers.js';
import { el, icon } from '../utils/dom.js';
import { state } from '../state/app-state.js';
import { localFS } from '../storage/local-fs.js';
import { idb } from '../storage/idb.js';
import { getModel } from '../ui/engine.js';
import { createGalleryItemDOM } from '../ui/gallery.js';
import { saveHistory } from '../ui/history.js';
import { showToast } from '../ui/toast.js';

/** 防改写前缀（参考自 gpt-image-playground） */
const PROMPT_REWRITE_GUARD_PREFIX = 'Use the following text as the complete prompt. Do not rewrite it:';

/**
 * 执行图像生成
 * @param {Object} custom - 自定义参数覆盖
 */
export async function executeGeneration(custom = {}) {
  // 如果正在生成，点击则终止
  if (state.isGenerating) {
    if (state.abortCtrl) {
      state.abortCtrl.abort();
      showToast('已终止生成');
    }
    return;
  }

  const key = $('apiKey').value.trim();
  const base = $('baseUrl').value.trim();
  if (!key || !base) return showToast('API Key 或 Base URL 缺失', 'error');

  state.isGenerating = true;
  state.abortCtrl = new AbortController();
  const signal = state.abortCtrl.signal;

  const count = Math.max(1, Math.min(parseInt(custom.batchCount || $('batchSelect').value) || 1, 20));
  const t0 = Date.now();
  const btn = $('runBtn');
  const status = $('statusBox');
  const results = $('resultArea');
  const empty = $('emptyState');

  // 更新按钮状态（安全 DOM）
  btn.replaceChildren(icon('sync'), ' 创造中... (点击终止)');
  status.className = 'text-center mt-4 text-xs font-medium text-primary h-4 loading-dots';
  status.textContent = '神笔正在与绘画之神通讯...';
  status.style.display = 'block';
  empty.style.display = 'none';
  results.style.display = 'block';

  const textSec = $('textResultSection');
  if (textSec) textSec.style.display = 'none';

  const gallery = $('imageGallery');

  // 安全创建骨架屏占位元素（使用 createElement 替代 innerHTML）
  const placeholders = [];
  for (let i = 0; i < count; i++) {
    const timerLabel = el('span', {
      className: 'text-[11px] font-bold text-primary tracking-widest uppercase placeholder-timer',
      textContent: '正在生成... 0s',
    });

    const placeholder = el('div', {
      className: 'masonry-item relative rounded-xl overflow-hidden bg-surface-container border border-outline-variant flex items-center justify-center min-h-[300px] shadow-sm animate-pulse',
    },
      el('div', { className: 'absolute inset-0 bg-gradient-to-tr from-primary/5 to-transparent' }),
      el('div', { className: 'flex flex-col items-center justify-center gap-3 relative z-10' },
        icon('sync', 'text-4xl text-primary animate-spin'),
        timerLabel
      )
    );

    gallery.prepend(placeholder);
    placeholders.push(placeholder);
  }

  // 计时器
  let _timerSec = 0;
  const _timerInterval = setInterval(() => {
    _timerSec++;
    // 安全更新状态文本
    status.textContent = '';
    status.appendChild(document.createTextNode('神笔正在与绘画之神通讯…  '));
    const timeSpan = el('span', {
      className: 'font-mono font-bold text-primary',
      textContent: `${_timerSec}s`,
    });
    status.appendChild(timeSpan);

    placeholders.forEach((p) => {
      const lbl = p.querySelector('.placeholder-timer');
      if (lbl) lbl.textContent = `正在生成... ${_timerSec}s`;
    });
  }, 1000);

  try {
    let imgs = custom.imageDatas || [];
    if (!custom.imageDatas && state.selectedFiles.length) {
      imgs = await Promise.all(state.selectedFiles.map(fileToB64));
    }

    const prompt = custom.prompt ?? $('promptInput').value;
    if (!imgs.length && !prompt.trim()) throw new Error('请输入提示词或提供底图');

    const ratioSelectVal = $('ratioSelect').value;
    let ratio = custom.aspectRatio || ratioSelectVal;
    if (ratioSelectVal === 'custom') {
      const w = $('customWidth').value.trim() || '1024';
      const h = $('customHeight').value.trim() || '1024';
      ratio = `${w}x${h}`;
    }
    if (!ratio) ratio = '1024x1024';

    if (ratio.includes('x')) {
      let [w, h] = ratio.split('x').map(Number);
      if (w && h) {
        if (w > 3840 || h > 3840) {
          const max = Math.max(w, h);
          w = Math.round(w / max * 3840);
          h = Math.round(h / max * 3840);
        }
        while (w * h > 8294400) { w = Math.round(w * 0.95); h = Math.round(h * 0.95); }
        while (w * h < 655360 && w < 3840 && h < 3840) { w = Math.round(w * 1.05); h = Math.round(h * 1.05); }
        if (w / h > 3) w = h * 3;
        if (h / w > 3) h = w * 3;
        w = Math.max(16, Math.round(w / 16) * 16);
        h = Math.max(16, Math.round(h / 16) * 16);
        ratio = `${w}x${h}`;
      }
    }

    const model = custom.model || getModel();
    const quality = custom.quality || $('qualitySelect').value;
    const outputFormat = $('outputFormat')?.value || 'png';
    const bgStyle = $('bgStyle')?.value || '';
    const mimeType = outputFormat === 'jpeg' ? 'image/jpeg' : outputFormat === 'webp' ? 'image/webp' : 'image/png';

    const enhance = {
      high: ', high details, clear, 4k resolution',
      ultra: ', masterpiece, best quality, ultra detailed, 8k resolution, cinematic lighting',
    };
    const sizeMap = { ultra: '4K', high: '2K', standard: '1K' };
    const basePrompt = (prompt || 'Generate an image') + (enhance[quality] || '');
    const apiType = $('apiTypeSelect')?.value || 'gemini';

    // 防改写：仅对 OpenAI 格式生效
    const rewriteGuardEnabled = apiType === 'openai' && $('rewriteGuardToggle')?.checked;
    const finalPrompt = rewriteGuardEnabled
      ? `${PROMPT_REWRITE_GUARD_PREFIX}\n${basePrompt}`
      : basePrompt;

    /**
     * 单次生成请求
     * @returns {Promise<{text: string, image: string}>}
     */
    const genOne = async (_, pIdx) => {
      if (apiType === 'openai') {
        // ===== OpenAI 兼容请求 =====
        const cleanBase = base.replace(/\/+$/, '');
        const baseUrlForOpenAI = cleanBase.endsWith('/v1') ? cleanBase : `${cleanBase}/v1`;
        const gptFormat = $('gptApiFormat')?.value || 'images';

        let fetchOptions = {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}` },
          signal,
        };

        const _b64ToBlob = (b64) => {
          const parts = b64.split(',');
          const mime = parts[0].match(/:(.*?);/)[1] || 'image/png';
          const bstr = atob(parts[1]);
          const u8arr = new Uint8Array(bstr.length);
          for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
          return new Blob([u8arr], { type: mime });
        };

        let url;
        let openaiSize = ratio;
        const moderation = $('moderationSelect')?.value || 'auto';

        if (gptFormat === 'chat') {
          // ===== Chat Completions 模式 =====
          url = `${baseUrlForOpenAI}/chat/completions`;
          
          const contentParts = [];
          if (imgs.length) {
            imgs.forEach(img => {
              const imgData = img.includes(',') ? img : `data:image/png;base64,${img}`;
              contentParts.push({ type: 'image_url', image_url: { url: imgData } });
            });
          }
          contentParts.push({ type: 'text', text: finalPrompt });

          const reqBody = { model, messages: [{ role: 'user', content: contentParts }] };
          if (openaiSize && openaiSize !== '') reqBody.size = openaiSize;
          if (moderation !== 'auto') reqBody.moderation = moderation;

          fetchOptions.headers['Content-Type'] = 'application/json';
          fetchOptions.body = JSON.stringify(reqBody);
        } else {
          // ===== Images API 模式（默认） =====
          const endpoint = imgs.length ? '/images/edits' : '/images/generations';
          url = `${baseUrlForOpenAI}${endpoint}`;

          if (imgs.length) {
            const fd = new FormData();
            fd.append('model', model);
            fd.append('prompt', finalPrompt);
            fd.append('response_format', 'b64_json');
            if (openaiSize && openaiSize !== '') fd.append('size', openaiSize);
            if (outputFormat) fd.append('output_format', outputFormat);
            if (bgStyle) fd.append('background', bgStyle);
            if (moderation !== 'auto') fd.append('moderation', moderation);

            imgs.forEach((img, i) => {
               fd.append('image', _b64ToBlob(img), `image${i}.png`);
               if (state.selectedMasks && state.selectedMasks[i]) {
                 fd.append('mask', _b64ToBlob(state.selectedMasks[i]), `mask${i}.png`);
               }
            });
            fetchOptions.body = fd;
          } else {
            const reqBody = { model, prompt: finalPrompt, response_format: 'b64_json' };
            if (openaiSize && openaiSize !== '') reqBody.size = openaiSize;
            if (outputFormat) reqBody.output_format = outputFormat;
            if (bgStyle) reqBody.background = bgStyle;
            if (moderation !== 'auto') reqBody.moderation = moderation;
            fetchOptions.headers['Content-Type'] = 'application/json';
            fetchOptions.body = JSON.stringify(reqBody);
          }
        }

        const res = await fetch(url, fetchOptions);
        if (!res.ok) {
           const data = await res.json().catch(() => ({}));
           throw new Error(data.error?.message || data.message || `API Error: ${res.status}`);
        }

        let src = '';

        const data = await res.json().catch(() => ({}));
          // ===== 智能响应格式检测（瀑布式，互不冲突） =====
          const items = Array.isArray(data?.data) ? data.data : [];
          if (items.length) {
            // 优先使用 b64_json
            if (items[0].b64_json) {
                src = `data:${mimeType};base64,${items[0].b64_json}`;
            } else if (items[0].url) {
                src = items[0].url;
            }
          }

          if (!src && Array.isArray(data?.output)) {
            const imgOutput = data.output.find(o => o.type === 'image_generation_call' && o.result);
            if (imgOutput) {
              src = imgOutput.result.startsWith('data:') ? imgOutput.result : `data:${mimeType};base64,${imgOutput.result}`;
            }
          }

          if (!src && Array.isArray(data?.choices)) {
            const msg = data.choices[0]?.message;
            if (msg && msg.content) {
              const urlMatch = msg.content.match(/(https?:\/\/[^\s)]+)/);
              if (urlMatch) src = urlMatch[1];
            }
          }

        if (!src) throw new Error('API 返回成功但无法从响应中提取图像（已尝试 Images / Responses / Chat 三种格式）');

        if (src && !src.startsWith('data:')) {
          try {
            const baseUrlObj = new URL(base);
            if (src.startsWith('/')) {
              src = baseUrlObj.origin + src;
            } else if (!src.startsWith('http')) {
              src = baseUrlObj.origin + (baseUrlObj.pathname.endsWith('/') ? baseUrlObj.pathname : baseUrlObj.pathname + '/') + src;
            } else {
              const srcUrl = new URL(src);
              if (['127.0.0.1', 'localhost', '0.0.0.0'].includes(srcUrl.hostname) && baseUrlObj.hostname !== srcUrl.hostname) {
                srcUrl.protocol = baseUrlObj.protocol;
                srcUrl.hostname = baseUrlObj.hostname;
                srcUrl.port = baseUrlObj.port;
                src = srcUrl.toString();
              }
            }
          } catch (e) { console.warn('URL 解析失败', e); }

          try {
            const imgRes = await fetch(src, { headers: { 'Authorization': `Bearer ${key}` } });
            if (imgRes.ok) {
              const blob = await imgRes.blob();
              src = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });
            } else {
              console.warn('带 Auth 头获取图片失败，状态码:', imgRes.status);
            }
          } catch (e) {
            console.warn('获取图片异常:', e);
          }
        }

        return { text: finalPrompt, image: src };
      } else {
        // ===== Gemini 请求 =====
        const parts = imgs.map((i) => ({
          inline_data: { mime_type: 'image/jpeg', data: i.includes(',') ? i.split(',')[1] : i },
        }));
        parts.push({ text: finalPrompt });

        const imageConfig = {};
        if (sizeMap[quality]) imageConfig.imageSize = sizeMap[quality];

        // 转换宽高尺寸为 Gemini 原生支持的宽高比
        let geminiRatio = ratio;
        if (ratio && ratio.includes('x')) {
          const [w, h] = ratio.split('x').map(Number);
          if (w && h) {
            const r = w / h;
            if (Math.abs(r - 16 / 9) < 0.1) geminiRatio = '16:9';
            else if (Math.abs(r - 9 / 16) < 0.1) geminiRatio = '9:16';
            else if (Math.abs(r - 4 / 3) < 0.15) geminiRatio = '4:3';
            else if (Math.abs(r - 3 / 4) < 0.15) geminiRatio = '3:4';
            else if (Math.abs(r - 3 / 2) < 0.1) geminiRatio = '4:3';
            else if (Math.abs(r - 2 / 3) < 0.1) geminiRatio = '3:4';
            else geminiRatio = '1:1';
          }
        }
        if (geminiRatio && geminiRatio !== '') imageConfig.aspectRatio = geminiRatio;

        const payload = {
          contents: [{ role: 'user', parts }],
          generationConfig: {
            responseModalities: ['IMAGE'],
            ...(Object.keys(imageConfig).length ? { imageConfig } : {}),
          },
        };

        const fullModel = model.startsWith('models/') ? model : `models/${model}`;
        const url = `${base.replace(/\/$/, '')}/v1beta/${fullModel}:generateContent?key=${key}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || `API Error: ${res.status}`);

        let text = '', image = '';
        for (const p of data.candidates?.[0]?.content?.parts || []) {
          if (p.text) text += p.text + '\n';
          const inl = p.inlineData || p.inline_data;
          if (inl?.data) image = `data:${inl.mimeType || inl.mime_type || 'image/png'};base64,${inl.data}`;
        }
        if (!image) {
          const reason = data.candidates?.[0]?.finishReason || data.promptFeedback?.blockReason || '未知原因';
          throw new Error(`Gemini 未返回图像 (${reason})`);
        }
        return { text, image };
      }
    };

    // 并发生成
    const all = await Promise.allSettled(Array.from({ length: count }, genOne));
    const valid = all.filter((r) => r.status === 'fulfilled' && r.value.image).map((r) => r.value.image);
    if (!valid.length) {
      throw new Error('API 生成失败: ' + all.filter((r) => r.status === 'rejected').map((r) => r.reason?.message).join(' | '));
    }

    const firstText = all.find((r) => r.status === 'fulfilled' && r.value.text)?.value.text.trim() || '';
    const textSecEl = $('textResultSection');
    textSecEl.style.display = 'none';
    if (firstText && $('textOutput')) $('textOutput').textContent = firstText;

    // 移除骨架屏
    placeholders.forEach((p) => p.remove());

    const galleryEl = $('imageGallery');
    // prepend backwards so valid[0] is at the very top
    valid.reverse().forEach((src) => {
      const sec = ((Date.now() - t0) / 1000).toFixed(1);
      const imageId = Date.now().toString() + '_' + Math.random().toString(36).slice(2, 6);
      const imageFile = localFS.isActive() ? `${imageId}.png` : null;
      const galleryItem = createGalleryItemDOM(src, sec, ratio, quality);
      galleryEl.prepend(galleryItem);
      state.currentGalleryData.unshift({ src, sec, ratio, quality, prompt: firstText, imageFile });
      saveHistory({ prompt, model, aspectRatio: ratio, quality, batchCount: count, masks: state.selectedMasks || [] }, src, imgs, imageId);
    });

    // 限制本地存储数量
    state.currentGalleryData = state.currentGalleryData.slice(0, 50);

    if (localFS.isActive()) {
      localFS.saveJSON('gallery.json', state.currentGalleryData.map((i) => ({
        sec: i.sec, ratio: i.ratio, quality: i.quality, prompt: i.prompt, imageFile: i.imageFile,
      }))).catch(() => {});
    } else {
      idb.set('nanscript_current_gallery', state.currentGalleryData);
    }

    showToast(`成功生成 ${valid.length} 张图像`);
    results.style.display = 'block';
    status.style.display = 'none';
  } catch (e) {
    if (e.name === 'AbortError') {
      showToast('生成已终止', 'error');
      clearQueue(); // 终止时清空队列，防止立刻开始下一个
    } else {
      console.error(e);
      showToast(e.message, 'error');
    }
    status.style.display = 'none';
    placeholders.forEach((p) => p.remove());
    if (!state.currentGalleryData.length) {
      results.style.display = 'none';
      empty.style.display = 'block';
    }
  } finally {
    clearInterval(_timerInterval);
    state.isGenerating = false;
    state.abortCtrl = null;
    btn.replaceChildren(icon('auto_awesome'), ' 开始创造');
    status.textContent = '';

    // 队列中还有任务，自动执行下一个
    if (taskQueue.length > 0) {
      const next = taskQueue.shift();
      updateQueueBadge();
      showToast(`🔄 开始第 ${next._queueIndex} 个排队任务...`);
      // 短暂延迟以让 UI 更新
      setTimeout(() => executeGeneration(next), 500);
    }
  }
}

// ========== 任务队列系统 ==========
/** 排队中的任务列表 */
const taskQueue = [];

/** 内部计数器 */
let _queueCounter = 0;

/**
 * 更新队列状态徽章
 * @private
 */
function updateQueueBadge() {
  let badge = document.getElementById('queueBadge');
  if (taskQueue.length > 0) {
    if (!badge) {
      badge = el('span', {
        id: 'queueBadge',
        className: 'ml-2 text-[10px] font-bold bg-primary/20 text-primary px-2 py-0.5 rounded-full animate-pulse',
      });
      $('statusBox')?.parentElement?.insertBefore(badge, $('statusBox'));
    }
    badge.textContent = `📋 队列: ${taskQueue.length} 个任务等待中`;
    badge.style.display = 'inline-block';
  } else {
    if (badge) badge.style.display = 'none';
  }
}

/**
 * 将任务加入队列
 * 如果当前没有正在执行的任务，直接执行；否则加入队列等待。
 * @param {Object} [custom={}] - 自定义参数覆盖
 */
export function enqueueTask(custom = {}) {
  if (!state.isGenerating) {
    // 没有正在执行的任务，直接生成
    executeGeneration(custom);
  } else {
    // 正在生成中，加入队列
    _queueCounter++;
    custom._queueIndex = _queueCounter;
    taskQueue.push(custom);
    updateQueueBadge();
    showToast(`📋 任务已排队 (第 ${taskQueue.length} 个)`);
  }
}

/**
 * 批量提交多个任务
 * @param {number} taskCount - 任务数量
 * @param {Object} [custom={}] - 每个任务共享的自定义参数
 */
export function enqueueMultiple(taskCount, custom = {}) {
  const count = Math.max(1, Math.min(taskCount, 50));
  for (let i = 0; i < count; i++) {
    enqueueTask({ ...custom });
  }
  showToast(`📋 已提交 ${count} 个任务`);
}

/**
 * 清空任务队列
 */
export function clearQueue() {
  taskQueue.length = 0;
  updateQueueBadge();
  showToast('任务队列已清空');
}

/**
 * 获取当前队列长度
 * @returns {number}
 */
export function getQueueLength() {
  return taskQueue.length;
}
