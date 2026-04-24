// ========== BanavelAi Image 1.0 - 应用逻辑 ==========

// ========== 工具函数 ==========
const $ = id => document.getElementById(id);
const safeParse = (k, fb) => { try { return JSON.parse(localStorage.getItem(k) || fb); } catch { return JSON.parse(fb); } };
const escHtml = s => s ? String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : '';
const ls = (k, v) => v !== undefined ? localStorage.setItem(k, v) : localStorage.getItem(k);

// ========== IndexedDB 封装 ==========
const idb = {
    _open() {
        return new Promise((ok, no) => {
            const r = indexedDB.open('BananaKingDB', 1);
            r.onerror = e => no(e.target.error);
            r.onsuccess = e => ok(e.target.result);
            r.onupgradeneeded = e => { const db = e.target.result; if (!db.objectStoreNames.contains('appData')) db.createObjectStore('appData'); };
        });
    },
    async set(k, v) { const db = await this._open(); return new Promise((ok, no) => { const r = db.transaction('appData', 'readwrite').objectStore('appData').put(v, k); r.onsuccess = () => ok(); r.onerror = e => no(e.target.error); }); },
    async get(k) { const db = await this._open(); return new Promise((ok, no) => { const r = db.transaction('appData', 'readonly').objectStore('appData').get(k); r.onsuccess = () => ok(r.result); r.onerror = e => no(e.target.error); }); }
};

// ========== 状态 ==========
let isGenerating = false, selectedFiles = [], promptLib = [], historyData = [], curFolder = 0;
let apiProfiles = safeParse('nanscript_api_profiles', '[]'), pendingThumb = null;
let currentGalleryData = [];
let abortCtrl = null; // 用于终止正在进行的生成请求

function createGalleryItemDOM(src, sec, ratio, quality) {
    const el = document.createElement('div'); 
    el.className = 'masonry-item relative group rounded-xl overflow-hidden bg-surface-container border border-outline-variant/30';
    el.innerHTML = `<img src="${src}" class="w-full object-cover gallery-img transition-transform duration-500 group-hover:scale-105" style="cursor: zoom-in;">
        <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4 pointer-events-none">
            <div class="glass-panel p-2 rounded-xl flex justify-between items-center gap-2 pointer-events-auto">
                <div class="flex gap-1">
                    <button class="action-zoom p-2 hover:bg-white/20 rounded-lg text-white transition-colors" title="放大"><span class="material-symbols-outlined text-[18px]">zoom_in</span></button>
                    <button class="action-copy p-2 hover:bg-white/20 rounded-lg text-white transition-colors" title="复制"><span class="material-symbols-outlined text-[18px]">content_copy</span></button>
                    <button class="action-down p-2 hover:bg-white/20 rounded-lg text-white transition-colors" title="保存"><span class="material-symbols-outlined text-[18px]">download</span></button>
                </div>
                <button class="action-redraw bg-primary text-on-primary-container px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 hover:brightness-110 transition-all shadow-md">
                    <span class="material-symbols-outlined text-[14px]">brush</span> 重绘
                </button>
            </div>
        </div>
        <div class="absolute top-3 left-3 bg-black/50 backdrop-blur-md text-white px-2.5 py-1 rounded-md text-[10px] font-bold tracking-widest uppercase pointer-events-none shadow-sm border border-white/10">⏱️ ${sec}秒</div>`;
    
    const openZoom = () => { $('lightboxImg').src = src; $('lightbox').style.display = 'flex'; };
    el.querySelector('.gallery-img').onclick = openZoom;
    el.querySelector('.action-zoom').onclick = openZoom;

    el.querySelector('.action-copy').onclick = async () => { try { const b = await (await fetch(src)).blob(); await navigator.clipboard.write([new ClipboardItem({ [b.type]: b })]); showToast('已复制 📋'); } catch (e) { showToast('复制失败', 'error'); } };
    el.querySelector('.action-down').onclick = () => { const a = document.createElement('a'); a.href = src; a.download = `${(ratio || 'Auto').replace(':', 'x')}_${quality}_${Math.random().toString(36).slice(2, 10)}.png`; a.click(); };
    el.querySelector('.action-redraw').onclick = () => { $('redrawSourceThumb').src = src; $('redrawPrompt').value = ''; $('redrawModal').style.display = 'flex'; };
    return el;
}

const errMap = { '401': 'API Key 无效或已过期', '403': 'API Key 无效或已过期', '402': '点数不足', '429': '请求频率过高，稍后再试', '404': '未找到模型', '500': '服务器错误' };

function showToast(msg, type = 'success') {
    const c = $('toastContainer'); if (!c) return;
    const s = typeof msg === 'string' ? msg : (msg?.message || String(msg));
    let d = s;
    if (type === 'error') for (const k in errMap) { if (s.includes(k)) { d = errMap[k]; break; } }
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<div style="font-size:1.2rem">${type === 'success' ? '✅' : '❌'}</div><div style="font-size:0.9rem">${d}</div>`;
    c.appendChild(t);
    setTimeout(() => { t.classList.add('fade-out'); setTimeout(() => t.remove(), 300); }, 5000);
}
window.alert = msg => showToast(msg, 'error');

// ========== 辅助 ==========
const fileToB64 = f => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(f); });
const urlToFile = async (u, n, t) => new File([await (await fetch(u)).blob()], n, { type: t });
const getModel = () => { const s = $('modelSelect'), i = $('modelInput'); return (!s?.classList.contains('hidden') && s?.value) ? s.value : i?.value || ''; };

function updatePreview() {
    const r = $('ratioSelect'), q = $('qualitySelect'), b = $('batchSelect');
    if (!r || !q || !b) return;
    $('paramPreview').textContent = `${r.value || 'Auto'} | ${q.options[q.selectedIndex]?.text.split(' ')[0] || 'Standard'} | x${b.value} | ${getModel() || 'No Model'}`;
}

// ========== 模型获取 ==========
async function fetchModels() {
    const base = $('baseUrl').value.trim(), key = $('apiKey').value.trim(), st = $('modelStatus'), btn = $('fetchModelsBtn');
    const apiType = $('apiTypeSelect')?.value || 'gemini';
    if (!key || !base) { st.className = 'model-status fail'; st.textContent = !key ? '❌ 缺少 API Key' : '❌ 缺少 Base URL'; return; }
    btn.classList.add('loading'); btn.disabled = true; st.className = 'model-status'; st.textContent = 'Fetching...';
    try {
        let res, list = [];
        if (apiType === 'openai') {
            res = await fetch(`${base.replace(/\/$/, '')}/v1/models`, { headers: { 'Authorization': `Bearer ${key}` } });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            list = (await res.json()).data || [];
        } else {
            res = await fetch(`${base.replace(/\/$/, '')}/v1beta/models?key=${key}`, { headers: { 'Content-Type': 'application/json' } });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            list = (await res.json()).models || [];
        }
        if (!list.length) throw new Error('No models');
        const sel = $('modelSelect'); sel.innerHTML = '';
        list.forEach(m => { const o = document.createElement('option'); o.value = (m.name || m.id).replace('models/', ''); o.textContent = m.displayName || m.id || o.value; sel.appendChild(o); });
        const cur = $('modelInput').value;
        if (cur && Array.from(sel.options).some(o => o.value === cur)) sel.value = cur;
        else if (sel.options.length > 0) $('modelInput').value = sel.value; // Sync the first option
        $('modelInput').classList.add('hidden'); sel.classList.remove('hidden');
        updatePreview(); st.className = 'model-status ok'; st.textContent = `✅ ${list.length} models loaded`;
    } catch (e) {
        $('modelInput').classList.remove('hidden'); $('modelSelect').classList.add('hidden');
        st.className = 'model-status fail'; st.textContent = '⚠️ ' + e.message;
    } finally { btn.classList.remove('loading'); btn.disabled = false; }
}

// ========== 核心生成 ==========
async function executeGeneration(custom = {}) {
    // 如果正在生成，点击则终止
    if (isGenerating) { if (abortCtrl) { abortCtrl.abort(); showToast('已终止生成'); } return; }
    const key = $('apiKey').value.trim(), base = $('baseUrl').value.trim();
    if (!key || !base) return showToast('API Key 或 Base URL 缺失', 'error');
    isGenerating = true;
    abortCtrl = new AbortController();
    const signal = abortCtrl.signal;
    const count = Math.min(parseInt(custom.batchCount || $('batchSelect').value) || 1, 4);
    const t0 = Date.now(), btn = $('runBtn'), status = $('statusBox'), results = $('resultArea'), empty = $('emptyState');
    btn.innerHTML = '<span class="material-symbols-outlined">sync</span> 创造中... (点击终止)';
    status.className = 'text-center mt-4 text-xs font-medium text-primary h-4 loading-dots'; status.innerHTML = '神笔正在与绘画之神通讯...';
    status.style.display = 'block';
    empty.style.display = 'none'; 
    results.style.display = 'block';
    const textSec = $('textResultSection');
    if (textSec) textSec.style.display = 'none';
    const gallery = $('imageGallery');
    const placeholders = [];
    for (let i = 0; i < count; i++) {
        const el = document.createElement('div');
        el.className = 'masonry-item relative rounded-xl overflow-hidden bg-surface-container border border-outline-variant flex items-center justify-center min-h-[300px] shadow-sm animate-pulse';
        el.innerHTML = `
            <div class="absolute inset-0 bg-gradient-to-tr from-primary/5 to-transparent"></div>
            <div class="flex flex-col items-center justify-center gap-3 relative z-10">
                <span class="material-symbols-outlined text-4xl text-primary animate-spin">sync</span>
                <span class="text-[11px] font-bold text-primary tracking-widest uppercase">正在生成...</span>
            </div>
        `;
        gallery.prepend(el);
        placeholders.push(el);
    }
    
    try {
        let imgs = custom.imageDatas || [];
        if (!custom.imageDatas && selectedFiles.length) imgs = await Promise.all(selectedFiles.map(fileToB64));
        const prompt = custom.prompt ?? $('promptInput').value;
        if (!imgs.length && !prompt.trim()) throw new Error('请输入提示词或提供底图');
        const model = custom.model || getModel(), ratio = custom.aspectRatio || $('ratioSelect').value;
        const quality = custom.quality || $('qualitySelect').value;
        const outputFormat = $('outputFormat')?.value || 'png';
        const bgStyle = $('bgStyle')?.value || '';
        const mimeType = outputFormat === 'jpeg' ? 'image/jpeg' : outputFormat === 'webp' ? 'image/webp' : 'image/png';
        const enhance = { high: ', high details, clear, 4k resolution', ultra: ', masterpiece, best quality, ultra detailed, 8k resolution, cinematic lighting' };
        const sizeMap = { ultra: '4K', high: '2K', standard: '1K' };
        const finalPrompt = (prompt || 'Generate an image') + (enhance[quality] || '');

        const apiType = $('apiTypeSelect')?.value || 'gemini';

        const genOne = async () => {
            if (apiType === 'openai') {
                const baseUrlForOpenAI = base.endsWith('/v1') ? base.replace(/\/$/, '') : base.replace(/\/$/, '') + '/v1';
                const endpoint = imgs.length ? '/images/edits' : '/images/generations';
                const url = `${baseUrlForOpenAI}${endpoint}`;

                let fetchOptions = {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${key}` },
                    signal
                };

                const base64ToBlob = (b64) => {
                    const parts = b64.split(',');
                    const mime = parts[0].match(/:(.*?);/)[1] || 'image/png';
                    const bstr = atob(parts[1]);
                    const u8arr = new Uint8Array(bstr.length);
                    for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
                    return new Blob([u8arr], { type: mime });
                };

                let openaiSize = '1024x1024';
                if (ratio === '16:9') openaiSize = '1792x1024';
                else if (ratio === '9:16') openaiSize = '1024x1792';

                if (imgs.length) {
                    const fd = new FormData();
                    fd.append('model', model);
                    fd.append('prompt', finalPrompt);
                    if (ratio && ratio !== '') fd.append('size', openaiSize);
                    if (outputFormat) fd.append('output_format', outputFormat);
                    if (bgStyle) fd.append('background', bgStyle);
                    imgs.forEach((img, i) => fd.append('image', base64ToBlob(img), `image${i}.png`));
                    fetchOptions.body = fd;
                } else {
                    const reqBody = { model: model, prompt: finalPrompt };
                    if (ratio && ratio !== '') reqBody.size = openaiSize;
                    if (outputFormat) reqBody.output_format = outputFormat;
                    if (bgStyle) reqBody.background = bgStyle;
                    fetchOptions.headers['Content-Type'] = 'application/json';
                    fetchOptions.body = JSON.stringify(reqBody);
                }

                const res = await fetch(url, fetchOptions);
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error?.message || data.message || `API Error: ${res.status}`);
                
                const items = Array.isArray(data?.data) ? data.data : [];
                if (!items.length) throw new Error('API 返回成功但无图像数据');
                
                let src = items[0].url || '';
                if (!src && items[0].b64_json) src = `data:${mimeType};base64,${items[0].b64_json}`;
                if (!src) throw new Error('API 未返回有效的 url 或 b64_json');

                return { text: finalPrompt, image: src };
            } else {
                const parts = imgs.map(i => ({ inline_data: { mime_type: 'image/jpeg', data: i.includes(',') ? i.split(',')[1] : i } }));
                parts.push({ text: finalPrompt });
                const imageConfig = {};
                if (sizeMap[quality]) imageConfig.imageSize = sizeMap[quality];
                if (ratio && ratio !== '') imageConfig.aspectRatio = ratio;
                const payload = {
                    contents: [{ role: 'user', parts }],
                    generationConfig: {
                        responseModalities: ['IMAGE'],
                        ...(Object.keys(imageConfig).length ? { imageConfig } : {})
                    }
                };
                const fullModel = model.startsWith('models/') ? model : `models/${model}`;
                const url = `${base.replace(/\/$/, '')}/v1beta/${fullModel}:generateContent?key=${key}`;
                const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal });
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

        const all = await Promise.allSettled(Array.from({ length: count }, genOne));
        const valid = all.filter(r => r.status === 'fulfilled' && r.value.image).map(r => r.value.image);
        if (!valid.length) throw new Error('API 生成失败: ' + all.filter(r => r.status === 'rejected').map(r => r.reason?.message).join(' | '));

        const firstText = all.find(r => r.status === 'fulfilled' && r.value.text)?.value.text.trim() || '';
        const textSec = $('textResultSection');
        if (firstText) { textSec.style.display = 'block'; $('textOutput').textContent = firstText; } else textSec.style.display = 'none';

        placeholders.forEach(p => p.remove());

        const gallery = $('imageGallery');
        // prepend backwards so valid[0] is at the very top
        valid.reverse().forEach(src => {
            const sec = ((Date.now() - t0) / 1000).toFixed(1);
            const el = createGalleryItemDOM(src, sec, ratio, quality);
            gallery.prepend(el);
            currentGalleryData.unshift({ src, sec, ratio, quality, prompt: firstText });
            saveHistory({ prompt, model, aspectRatio: ratio, quality, batchCount: count }, src, imgs);
        });
        // 限制本地存储数量，防止过大
        currentGalleryData = currentGalleryData.slice(0, 50);
        idb.set('nanscript_current_gallery', currentGalleryData);
        
        showToast(`成功生成 ${valid.length} 张图像`);
        results.style.display = 'block'; status.style.display = 'none';
    } catch (e) {
        if (e.name === 'AbortError') { showToast('生成已终止', 'error'); }
        else { console.error(e); showToast(e.message, 'error'); }
        status.style.display = 'none'; 
        if (typeof placeholders !== 'undefined') placeholders.forEach(p => p.remove());
        if (!currentGalleryData.length) {
            results.style.display = 'none';
            empty.style.display = 'block';
        }
    } finally { isGenerating = false; abortCtrl = null; btn.innerHTML = '<span class="material-symbols-outlined">auto_awesome</span> 开始创造'; status.innerHTML = ''; }
}

// ========== 历史记录 ==========
function saveHistory(params, b64Img, refImages = []) {
    const originalImageSrc = b64Img;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
        let thumbStr = originalImageSrc;
        try {
            const c = document.createElement('canvas'), s = 150 / img.width;
            c.width = 150; c.height = img.height * s;
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            thumbStr = c.toDataURL('image/jpeg', 0.4);
        } catch(e) {
            console.warn("Canvas Taint, using original src for thumb");
        }
        _doSave(thumbStr);
    };
    img.onerror = () => _doSave(originalImageSrc);
    img.src = originalImageSrc;

    function _doSave(thumb) {
        historyData.unshift({
            id: Date.now().toString(),
            date: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; })(),
            prompt: params.prompt || '纯图生成',
            model: params.model,
            aspectRatio: params.aspectRatio,
            quality: params.quality,
            batchCount: params.batchCount,
            apiType: $('apiTypeSelect')?.value || 'gemini',
            thumb: thumb,
            fullImage: originalImageSrc,
            refImages: refImages
        });
        if (historyData.length > 100) historyData = historyData.slice(0, 100);
        idb.set('nanscript_history_db', historyData); renderHistory();
    }
}

let currentHistoryIdx = -1;
let currentDetailMode = 'history';

function showHistoryDetail(item, idx, mode = 'history') {
    currentHistoryIdx = idx;
    currentDetailMode = mode;
    
    const imgSrc = item.fullImage || item.thumb || '';
    if (imgSrc && !imgSrc.endsWith('index.html')) {
        $('hdImage').src = imgSrc;
        $('hdImage').style.display = 'block';
    } else {
        $('hdImage').style.display = 'none';
    }

    $('hdDate').textContent = mode === 'library' ? `🔖 ${item.name}` : item.date;
    $('hdModel').textContent = item.model || '';
    $('hdPrompt').value = item.content || (item.prompt === '纯图生成' ? '' : item.prompt) || '';
    $('hdRatio').textContent = item.aspectRatio || '';
    $('hdQuality').textContent = item.quality || '';
    
    $('hdRatio').style.display = item.aspectRatio ? 'inline-block' : 'none';
    $('hdQuality').style.display = item.quality ? 'inline-block' : 'none';
    $('hdAddLibBtn').style.display = mode === 'library' ? 'none' : 'inline-block';
    
    $('hdImage').onclick = () => { if($('hdImage').src) { $('lightboxImg').src = $('hdImage').src; $('lightbox').style.display = 'flex'; } };

    const refGroup = $('hdRefImagesGroup'), refList = $('hdRefImages');
    if (item.refImages && item.refImages.length) {
        refGroup.style.display = 'block';
        refList.innerHTML = '';
        item.refImages.forEach(src => {
            const div = document.createElement('div'); div.className = 'preview-item';
            div.innerHTML = `<img src="${src}">`;
            refList.appendChild(div);
        });
    } else {
        refGroup.style.display = 'none';
    }

    $('historyDetailModal').style.display = 'flex';
}

function renderHistory() {
    const list = $('historyList'); if (!list) return;
    if (!historyData.length) { list.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:0.85rem;margin-top:40px">暂无历史记录</div>'; return; }
    list.innerHTML = '';
    historyData.forEach((item, idx) => {
        const el = document.createElement('div'); el.className = 'flex gap-3 group cursor-pointer hover:bg-surface-container-high/40 p-2 rounded-xl transition-all duration-300 relative border border-transparent hover:border-outline-variant/30';
        const badges = [item.aspectRatio, item.quality, item.batchCount > 1 ? `x${item.batchCount}` : ''].filter(Boolean).map(b => `<span class="bg-surface-container text-on-surface-variant px-1.5 py-0.5 rounded text-[9px] border border-outline-variant uppercase tracking-widest">${escHtml(b)}</span>`).join('');
        el.innerHTML = `<div class="w-16 h-16 rounded-lg bg-surface-container overflow-hidden flex-shrink-0 border border-outline-variant/50 relative">
            <img src="${item.thumb}" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity">
        </div>
        <div class="flex flex-col justify-center flex-1 min-w-0 pr-6">
            <span class="text-[11px] text-primary uppercase tracking-widest font-bold mb-1.5 line-clamp-1">${escHtml(item.prompt)}</span>
            <div class="flex gap-1.5 flex-wrap mb-1.5">${badges}</div>
            <span class="text-[9px] text-on-surface-variant/60 italic">${escHtml(item.date)}</span>
        </div>
        <button class="hd absolute top-2 right-2 p-1 text-error/0 group-hover:text-error hover:bg-error/10 rounded transition-all material-symbols-outlined text-[16px]">delete</button>`;
        
        el.onclick = () => showHistoryDetail(item, idx);
        
        el.querySelector('.hd').onclick = e => { e.stopPropagation(); historyData.splice(idx, 1); idb.set('nanscript_history_db', historyData); renderHistory(); };
        list.appendChild(el);
    });
}

// ========== 咒语书 ==========
const saveLib = () => idb.set('nanscript_prompt_lib', promptLib);

function renderFolders() {
    const list = $('folderList'); if (!list) return; list.innerHTML = '';
    promptLib.forEach((f, i) => {
        const el = document.createElement('div'); el.className = `group flex justify-between items-center p-2.5 rounded-lg cursor-pointer text-sm font-medium transition-colors ${i === curFolder ? 'bg-primary/10 text-primary' : 'text-on-surface hover:bg-surface-container-high'}`;
        el.innerHTML = `<span class="flex items-center gap-2 line-clamp-1"><span class="material-symbols-outlined text-[18px]">folder</span> ${escHtml(f.folderName)}</span>
                    <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button class="ef material-symbols-outlined text-[16px] p-1 hover:text-on-surface text-on-surface-variant transition-colors" title="重命名">edit</button><button class="df material-symbols-outlined text-[16px] p-1 text-error hover:bg-error/10 rounded transition-colors" title="删除">close</button></div>`;
        el.onclick = () => { curFolder = i; renderFolders(); };
        el.querySelector('.ef').onclick = e => {
            e.stopPropagation();
            const n = prompt('重命名分类:', f.folderName);
            if (n && n.trim()) { f.folderName = n.trim(); saveLib(); renderFolders(); showToast('分类已重命名'); }
        };
        el.querySelector('.df').onclick = e => {
            e.stopPropagation();
            if (confirm(`删除分类 [${f.folderName}]？`)) { promptLib.splice(i, 1); curFolder = Math.max(0, curFolder - 1); saveLib(); renderFolders(); }
        };
        list.appendChild(el);
    });
    renderPrompts();
}

function renderPrompts() {
    const grid = $('promptGrid'), title = $('currentFolderName');
    if (!grid || !title) return;
    if (!promptLib.length) { title.textContent = '暂无分类'; grid.innerHTML = '<div style="color:var(--text-muted)">请先创建分类</div>'; return; }
    const folder = promptLib[curFolder]; title.textContent = `📂 ${folder.folderName}`; grid.innerHTML = '';
    folder.prompts.forEach((p, i) => {
        const card = document.createElement('div'); card.className = 'bg-surface-container border border-outline-variant rounded-xl overflow-hidden cursor-pointer hover:-translate-y-1 hover:shadow-lg hover:border-primary transition-all group';
        const imgSrc = p.fullImage || p.thumb || '';
        card.innerHTML = `<div class="h-32 bg-surface-container-lowest overflow-hidden"><img src="${imgSrc}" class="w-full h-full object-cover" style="display:${imgSrc ? 'block' : 'none'}"></div>
                        <div class="p-4 relative">
                            <div class="font-bold text-sm text-on-surface mb-2 truncate pr-6">${escHtml(p.name)}</div>
                            <div class="text-xs text-on-surface-variant line-clamp-2 leading-relaxed">${escHtml(p.content)}</div>
                            <div class="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-surface-container rounded-md p-0.5 shadow border border-outline-variant">
                                <button class="ep material-symbols-outlined text-[14px] p-1 text-on-surface-variant hover:text-on-surface transition-colors">edit</button>
                                <button class="dp material-symbols-outlined text-[14px] p-1 text-error hover:bg-error/10 rounded transition-colors">delete</button>
                            </div>
                        </div>`;
        card.onclick = () => { showHistoryDetail(p, i, 'library'); };
        card.querySelector('.ep').onclick = e => {
            e.stopPropagation();
            const nn = prompt('修改名称:', p.name); if (nn === null) return;
            const nc = prompt('修改内容:', p.content); if (nc === null) return;
            if (!nn.trim() || !nc.trim()) return showToast('不能为空', 'error');
            p.name = nn.trim(); p.content = nc.trim(); saveLib(); renderPrompts(); showToast('已更新');
        };
        card.querySelector('.dp').onclick = e => { e.stopPropagation(); folder.prompts.splice(i, 1); saveLib(); renderPrompts(); };
        grid.appendChild(card);
    });
}

// ========== 预览列表 ==========
function renderPreviews() {
    const list = $('imagePreviewList'); list.innerHTML = '';
    selectedFiles.forEach((f, i) => {
        const el = document.createElement('div'); 
        el.className = 'relative group w-20 h-20 rounded-md mt-2';
        
        const img = document.createElement('img'); 
        img.src = URL.createObjectURL(f);
        img.className = 'w-20 h-20 object-cover rounded-md border border-outline-variant/50 relative z-10';
        
        img.onmouseenter = () => {
            let hp = document.getElementById('globalHoverPreview');
            if (!hp) {
                hp = document.createElement('img');
                hp.id = 'globalHoverPreview';
                hp.className = 'fixed w-[320px] max-w-none h-auto max-h-[500px] object-cover bg-surface rounded-lg shadow-[0_10px_40px_rgba(0,0,0,0.5)] pointer-events-none transition-opacity duration-200 z-[9999] border border-outline-variant/30';
                document.body.appendChild(hp);
            }
            hp.src = img.src;
            const rect = img.getBoundingClientRect();
            hp.style.left = `${rect.right + 16}px`;
            
            // Adjust vertical position to stay within viewport
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
        
        const btn = document.createElement('button'); 
        btn.innerHTML = '<span class="material-symbols-outlined text-[14px]">close</span>';
        btn.className = 'absolute -top-2 -right-2 bg-error text-white rounded-full w-5 h-5 flex items-center justify-center z-[60] shadow-md hover:bg-red-600 transition-transform hover:scale-110';
        btn.onclick = () => { selectedFiles.splice(i, 1); renderPreviews(); };
        
        el.append(img, btn); 
        list.appendChild(el);
    });
    Promise.all(selectedFiles.map(fileToB64)).then(b64s => idb.set('nanscript_current_refs', b64s)).catch(() => {});
}

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', () => {
    // 模态框通用绑定
    [['infoBtn', 'infoModal', 'closeInfoBtn'], ['apiConfigBtn', 'apiConfigModal', 'closeApiConfigBtn'], ['openLibraryBtn', 'libraryModal', 'closeLibraryBtn']].forEach(([b, m, c]) => {
        const modal = $(m);
        if ($(b) && modal) $(b).onclick = () => { modal.style.display = 'flex'; if (m === 'libraryModal') { if (!promptLib.length) promptLib.push({ folderName: 'Default', prompts: [] }); renderFolders(); } };
        if ($(c) && modal) $(c).onclick = () => modal.style.display = 'none';
        if (modal) modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });
    });

    // 历史详情模态框绑定
    $('hdCloseBtn').onclick = () => $('historyDetailModal').style.display = 'none';
    $('historyDetailModal').addEventListener('click', e => { if (e.target.id === 'historyDetailModal') $('historyDetailModal').style.display = 'none'; });

    $('hdDelBtn').onclick = () => {
        if (currentHistoryIdx > -1) {
            if (currentDetailMode === 'history') {
                historyData.splice(currentHistoryIdx, 1);
                idb.set('nanscript_history_db', historyData);
                renderHistory();
            } else {
                promptLib[curFolder].prompts.splice(currentHistoryIdx, 1);
                saveLib();
                renderPrompts();
            }
            $('historyDetailModal').style.display = 'none';
            showToast('记录已删除');
        }
    };



    const _hdCopyBtn = $('hdCopyBtn');
    if (_hdCopyBtn) _hdCopyBtn.onclick = async () => {
        const text = $('hdPrompt').value;
        if (!text) return;
        try { await navigator.clipboard.writeText(text); showToast('提示词已复制'); } catch(e) { showToast('复制失败', 'error'); }
    };

    $('hdAddLibBtn').onclick = () => {
        const text = $('hdPrompt').value;
        if (!text) return showToast('无提示词可存', 'error');
        const name = prompt('为这组咒语起个名字:', '历史收藏');
        if (!name) return;
        if (!promptLib.length) promptLib.push({ folderName: 'Default', prompts: [] });
        
        const histItem = historyData[currentHistoryIdx];
        promptLib[curFolder].prompts.unshift({ 
            name, 
            content: text, 
            thumb: histItem.thumb,
            fullImage: histItem.fullImage,
            model: histItem.model,
            aspectRatio: histItem.aspectRatio,
            quality: histItem.quality,
            batchCount: histItem.batchCount,
            apiType: histItem.apiType,
            refImages: histItem.refImages
        });
        saveLib(); renderFolders(); showToast('已加入当前分类');
    };

    const base64ToBlob2 = (b64) => {
        const parts = b64.split(',');
        if (parts.length < 2) return null; // Handle URLs that might accidentally slip here if not base64
        const mime = parts[0].match(/:(.*?);/)[1] || 'image/png';
        const bstr = atob(parts[1]);
        const u8arr = new Uint8Array(bstr.length);
        for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
        return new Blob([u8arr], { type: mime });
    };

    const _hdApplyBtn = $('hdApplyBtn');
    if (_hdApplyBtn) _hdApplyBtn.onclick = () => {
        const item = currentDetailMode === 'history' ? historyData[currentHistoryIdx] : promptLib[curFolder].prompts[currentHistoryIdx];
        if (!item) return;
        $('promptInput').value = item.content || (item.prompt === '纯图生成' ? '' : item.prompt) || '';
        if (item.aspectRatio) $('ratioSelect').value = item.aspectRatio;
        if (item.quality) $('qualitySelect').value = item.quality;
        if (item.batchCount) { $('batchSelect').value = item.batchCount; $('batchValue').textContent = item.batchCount; }
        if (item.apiType) { $('apiTypeSelect').value = item.apiType; $('apiTypeSelect').dispatchEvent(new Event('change')); }
        if (item.model) { const s = $('modelSelect'), i = $('modelInput'); Array.from(s?.options || []).some(o => o.value === item.model) && s?.style.display !== 'none' ? s.value = item.model : i.value = item.model; }
        
        selectedFiles = [];
        if (item.refImages && item.refImages.length) {
            item.refImages.forEach((src, idx) => {
                if (src.startsWith('data:')) {
                    const blob = base64ToBlob2(src);
                    if(blob) selectedFiles.push(new File([blob], `ref${idx}.png`, { type: blob.type }));
                }
            });
        }
        renderPreviews();
        updatePreview();
        $('historyDetailModal').style.display = 'none';
        if (currentDetailMode === 'library') $('libraryModal').style.display = 'none';
        showToast('参数与垫图已导入！');
    };


    // 指南 Tab 切换
    document.querySelectorAll('.info-tab').forEach(tab => {
        tab.onclick = () => {
            document.querySelectorAll('.info-tab').forEach(t => {
                t.classList.remove('active', 'text-primary', 'border-primary', 'font-bold');
                t.classList.add('text-on-surface-variant', 'border-transparent', 'font-medium');
            });
            document.querySelectorAll('.info-pane').forEach(p => p.classList.add('hidden'));
            tab.classList.add('active', 'text-primary', 'border-primary', 'font-bold');
            tab.classList.remove('text-on-surface-variant', 'border-transparent', 'font-medium');
            const target = $(tab.dataset.target);
            if (target) target.classList.remove('hidden');
        };
    });

    // 主题切换 (自动/深色/亮色)
    const html = document.documentElement, tBtn = $('themeToggle');
    const setTheme = t => { 
        html.setAttribute('data-theme', t); 
        ls('theme', t); 
        
        let isDark = false;
        if (t === 'auto') {
            isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            tBtn.innerHTML = '<span class="material-symbols-outlined text-[18px]">hdr_auto</span> 自动';
        } else if (t === 'dark') {
            isDark = true;
            tBtn.innerHTML = '<span class="material-symbols-outlined text-[18px]">dark_mode</span> 深色';
        } else {
            isDark = false;
            tBtn.innerHTML = '<span class="material-symbols-outlined text-[18px]">light_mode</span> 亮色';
        }
        
        if (isDark) html.classList.add('dark'); else html.classList.remove('dark');
    };
    
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        if (ls('theme') === 'auto') {
            if (e.matches) html.classList.add('dark'); else html.classList.remove('dark');
        }
    });

    setTheme(ls('theme') || 'auto');
    tBtn.onclick = () => {
        const cur = ls('theme') || 'auto';
        if (cur === 'auto') setTheme('dark');
        else if (cur === 'dark') setTheme('light');
        else setTheme('auto');
    };

    // 表单字段持久化
    ['baseUrl', 'apiKey', 'modelInput', 'ratioSelect', 'qualitySelect', 'promptInput', 'batchSelect', 'apiTypeSelect'].forEach(id => {
        const el = $(id); if (!el) return;
        const saved = ls('nanscript_' + id); if (saved) { el.value = saved; if (id === 'batchSelect') $('batchValue').textContent = saved; }
        const sync = () => { ls('nanscript_' + id, el.value); if (id === 'batchSelect') $('batchValue').textContent = el.value; updatePreview(); };
        el.oninput = el.onchange = sync;
    });

    // 绑定 modelSelect 同步
    const mSel = $('modelSelect');
    if (mSel) {
        mSel.addEventListener('change', (e) => {
            $('modelInput').value = e.target.value;
            ls('nanscript_modelInput', e.target.value);
            updatePreview();
        });
    }

    // 垫图
    const imgInput = $('imageInput');
    if (imgInput) {
        imgInput.onchange = e => {
            const nf = Array.from(e.target.files);
            if (selectedFiles.length + nf.length > 10) return alert('最多 10 张！');
            selectedFiles = selectedFiles.concat(nf); renderPreviews(); e.target.value = '';
        };
        // 拖拽
        const panel = imgInput.closest('.panel');
        if (panel) {
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(e => panel.addEventListener(e, ev => { ev.preventDefault(); ev.stopPropagation(); }));
            ['dragenter', 'dragover'].forEach(e => panel.addEventListener(e, () => panel.classList.add('drag-active')));
            ['dragleave', 'drop'].forEach(e => panel.addEventListener(e, () => panel.classList.remove('drag-active')));
            panel.ondrop = e => {
                const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
                if (files.length) { const dt = new DataTransfer();[...(imgInput.files || []), ...files].forEach(f => dt.items.add(f)); imgInput.files = dt.files; imgInput.dispatchEvent(new Event('change')); }
            };
        }
    }

    // API 配置存档
    const profSel = $('apiProfileSelect'), loadProfiles = () => {
        profSel.innerHTML = '<option value="">-- 选择配置 --</option>';
        apiProfiles.forEach(p => { const o = document.createElement('option'); o.value = o.textContent = p.name; profSel.appendChild(o); });
    };
    if (profSel) {
        loadProfiles();
        profSel.onchange = e => {
            const p = apiProfiles.find(x => x.name === e.target.value); if (!p) return;
            $('baseUrl').value = p.baseUrl || ''; ls('nanscript_baseUrl', p.baseUrl || '');
            $('apiKey').value = p.apiKey || ''; ls('nanscript_apiKey', p.apiKey || '');
            $('modelInput').value = p.modelInput || ''; ls('nanscript_modelInput', p.modelInput || '');
            const s = $('modelSelect');
            if (s && !s.classList.contains('hidden')) {
                if (Array.from(s.options).some(o => o.value === p.modelInput)) s.value = p.modelInput;
                else { s.classList.add('hidden'); $('modelInput').classList.remove('hidden'); }
            }
            if (p.apiTypeSelect) { $('apiTypeSelect').value = p.apiTypeSelect; ls('nanscript_apiTypeSelect', p.apiTypeSelect); }
            $('apiProfileName').value = p.name;
            updatePreview(); showToast(`已加载: ${p.name}（可修改后保存覆盖）`);
        };
    }
    $('saveProfileBtn').onclick = () => {
        const name = $('apiProfileName').value.trim(); if (!name) return alert('请输入配置名称');
        const cfg = { name, baseUrl: $('baseUrl').value, apiKey: $('apiKey').value, modelInput: getModel(), apiTypeSelect: $('apiTypeSelect')?.value || 'gemini' };
        const i = apiProfiles.findIndex(p => p.name === name);
        i > -1 ? apiProfiles[i] = cfg : apiProfiles.push(cfg);
        ls('nanscript_api_profiles', JSON.stringify(apiProfiles));
        loadProfiles(); profSel.value = name; showToast(`配置 [${name}] 已保存`);
    };
    $('delProfileBtn').onclick = () => {
        const name = profSel.value; if (!name || !confirm(`删除 [${name}]？`)) return;
        apiProfiles = apiProfiles.filter(p => p.name !== name);
        ls('nanscript_api_profiles', JSON.stringify(apiProfiles));
        loadProfiles(); $('apiProfileName').value = ''; showToast('已删除');
    };

    // ✅ 应用并关闭按钮
    $('applyApiConfigBtn').onclick = () => {
        ['baseUrl', 'apiKey', 'modelInput', 'apiTypeSelect'].forEach(id => { 
            if ($(id)) {
                let val = $(id).value;
                if (id === 'modelInput') val = getModel();
                ls('nanscript_' + id, val); 
                if (id === 'modelInput') $('modelInput').value = val;
            }
        });
        updatePreview();
        $('apiConfigModal').style.display = 'none';
        showToast(`已应用配置 · 模型: ${getModel() || '未设置'}`);
    };

    // 按钮绑定
    $('fetchModelsBtn').onclick = fetchModels;
    $('runBtn').onclick = () => executeGeneration();
    $('toggleCompareBtn').onclick = e => {
        const g = $('imageGallery'), on = g.classList.toggle('compare-grid');
        e.target.textContent = on ? '[ 退出对比 ]' : '[ 切换对比模式 ]';
    };

    // 咒语书 - 添加文件夹
    $('addFolderBtn').onclick = () => {
        const n = $('newFolderInput').value.trim(); if (!n) return;
        promptLib.push({ folderName: n, prompts: [] }); $('newFolderInput').value = '';
        curFolder = promptLib.length - 1; saveLib(); renderFolders();
    };
    // 咒语书 - 附图
    $('newPromptImg').onchange = e => {
        const file = e.target.files[0]; if (!file) return;
        const img = new Image();
        img.onload = () => { const c = document.createElement('canvas'), s = 250 / img.width; c.width = 250; c.height = img.height * s; c.getContext('2d').drawImage(img, 0, 0, 250, c.height); pendingThumb = c.toDataURL('image/jpeg', 0.6); $('thumbStatus').style.display = 'block'; };
        img.src = URL.createObjectURL(file);
    };
    // 咒语书 - 保存
    $('addPromptBtn').onclick = () => {
        if (!promptLib.length) return alert('请先创建分类');
        const n = $('newPromptName').value.trim(), c = $('newPromptContent').value.trim();
        if (!n || !c) return alert('名称和内容必填');
        promptLib[curFolder].prompts.unshift({ name: n, content: c, thumb: pendingThumb });
        $('newPromptName').value = $('newPromptContent').value = $('newPromptImg').value = '';
        $('thumbStatus').style.display = 'none'; pendingThumb = null; saveLib(); renderPrompts();
    };

    // 历史记录
    $('clearHistoryBtn').onclick = () => { if (confirm('清空所有历史？')) { historyData = []; idb.set('nanscript_history_db', historyData); renderHistory(); } };
    
    $('exportImagesBtn').onclick = async () => {
        if (!historyData.length) return showToast('无记录可导出', 'error');
        if (typeof JSZip === 'undefined') return showToast('打包组件未加载，请检查网络', 'error');
        
        showToast('正在为您打包图片，请稍等...', 'success');
        const btn = $('exportImagesBtn');
        btn.disabled = true;
        
        try {
            const zip = new JSZip();
            let count = 0;
            const folder = zip.folder("BanavelAi_生成图");
            
            for (let i = 0; i < historyData.length; i++) {
                const item = historyData[i];
                const imgSrc = item.fullImage || item.thumb;
                if (!imgSrc) continue;
                
                try {
                    let blob;
                    if (imgSrc.startsWith('data:')) {
                        blob = base64ToBlob2(imgSrc);
                    } else {
                        const res = await fetch(imgSrc);
                        blob = await res.blob();
                    }
                    if (blob) {
                        const dateStr = (item.date || '').replace(/\//g, '');
                        const promptStr = (item.prompt && item.prompt !== '纯图生成') ? item.prompt.slice(0, 15).replace(/[\\/:*?"<>|]/g, '').trim() : '图片';
                        folder.file(`${String(i+1).padStart(3, '0')}_${dateStr}_${promptStr}.png`, blob);
                        count++;
                    }
                } catch(e) {
                    console.warn("打包单张图片失败:", e);
                }
            }
            
            if (count === 0) {
                btn.disabled = false;
                return showToast('没有可打包的有效图片', 'error');
            }
            
            const content = await zip.generateAsync({ type: "blob" });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(content);
            a.download = `GBanavelAi_画作合集_${Date.now()}.zip`;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
            }, 100);
            showToast(`🎉 成功打包 ${count} 张图片！`);
        } catch(e) {
            console.error(e);
            showToast('打包过程出错', 'error');
        } finally {
            btn.disabled = false;
        }
    };

    $('exportHistoryBtn').onclick = () => {
        if (!historyData.length) return showToast('无记录', 'error');
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(historyData, null, 2)], { type: 'application/json' }));
        a.download = `history_${Date.now()}.json`; a.click(); showToast('已导出');
    };
    $('importHistoryBtn').onclick = () => $('importHistoryInput').click();
    $('importHistoryInput').onchange = e => {
        const file = e.target.files[0]; if (!file) return;
        const r = new FileReader();
        r.onload = ev => {
            try {
                const imp = JSON.parse(ev.target.result); if (!Array.isArray(imp)) throw 1;
                if (historyData.length && confirm('与现有记录合并？')) {
                    const m = new Map(historyData.map(i => [i.id, i])); imp.forEach(i => m.set(i.id, i));
                    historyData = [...m.values()].sort((a, b) => b.id - a.id).slice(0, 100);
                } else historyData = imp.slice(0, 100);
                idb.set('nanscript_history_db', historyData); renderHistory(); showToast('导入成功');
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
            selectedFiles = [await urlToFile(src, 'redraw.png', 'image/png')]; renderPreviews();
            $('promptInput').value = p; $('redrawModal').style.display = 'none'; executeGeneration();
        } catch { showToast('图片加载失败', 'error'); }
        finally { btn.disabled = false; btn.textContent = '确认重绘'; }
    };

    // 从 IndexedDB 恢复数据
    idb.get('nanscript_prompt_lib').then(d => { if (Array.isArray(d) && d.length) promptLib = d; }).catch(() => { });
    idb.get('nanscript_history_db').then(d => {
        if (Array.isArray(d) && d.length) historyData = d;
        else try { const o = JSON.parse(ls('nanscript_history_db') || '[]'); if (o.length) { historyData = o; idb.set('nanscript_history_db', o); } } catch { }
        renderHistory();
    }).catch(() => renderHistory());
    idb.get('nanscript_current_refs').then(d => {
        if (Array.isArray(d) && d.length) {
            d.forEach((src, idx) => {
                if (src.startsWith('data:')) {
                    const blob = base64ToBlob2(src);
                    if(blob) selectedFiles.push(new File([blob], `ref${idx}.png`, { type: blob.type }));
                }
            });
            renderPreviews();
        }
    }).catch(() => {});

    // 恢复工坊画廊内容
    idb.get('nanscript_current_gallery').then(d => {
        if (Array.isArray(d) && d.length) {
            currentGalleryData = d;
            const gallery = $('imageGallery');
            gallery.innerHTML = '';
            currentGalleryData.forEach(item => {
                const el = createGalleryItemDOM(item.src, item.sec, item.ratio, item.quality);
                gallery.appendChild(el);
            });
            $('emptyState').style.display = 'none';
            $('resultArea').style.display = 'block';
            if (d[0] && d[0].prompt) {
                $('textResultSection').style.display = 'block';
                $('textOutput').textContent = d[0].prompt;
            } else {
                $('textResultSection').style.display = 'none';
            }
        }
    }).catch(() => {});

    // 清空画廊
    if ($('clearGalleryBtn')) {
        $('clearGalleryBtn').onclick = () => {
            if (!confirm('确定要清空当前的创意工坊吗？（历史记录不会受影响）')) return;
            currentGalleryData = [];
            idb.set('nanscript_current_gallery', []);
            $('imageGallery').innerHTML = '';
            $('resultArea').style.display = 'none';
            $('emptyState').style.display = 'block';
            showToast('创意工坊已清空');
        };
    }

    updatePreview();
});

// --- Lightbox Zoom & Pan Logic ---
(function initLightbox() {
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
    
    // reset on open
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((m) => {
            if (m.attributeName === 'style' && lb.style.display !== 'none') {
                scale = 1; pointX = 0; pointY = 0;
                img.style.transition = 'transform 0.2s ease';
                setTransform();
                setTimeout(() => img.style.transition = 'none', 200);
            }
        });
    });
    observer.observe(lb, { attributes: true });
    
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
    
    lb.addEventListener('wheel', (e) => {
        if (lb.style.display === 'none') return;
        e.preventDefault();
        
        const oldScale = scale;
        const delta = (e.wheelDelta ? e.wheelDelta : -e.deltaY) > 0 ? 1.2 : 0.8;
        scale *= delta;
        scale = Math.min(Math.max(1, scale), 4); // clamp 1 to 4
        
        if (scale === 1) { 
            pointX = 0; pointY = 0; 
        } else if (scale !== oldScale) {
            const cx = window.innerWidth / 2;
            const cy = window.innerHeight / 2;
            pointX += (1 - scale / oldScale) * (e.clientX - cx - pointX);
            pointY += (1 - scale / oldScale) * (e.clientY - cy - pointY);
        }
        setTransform();
    }, { passive: false });
    
    lb.addEventListener('click', (e) => {
        if (hasDragged) {
            hasDragged = false;
            return;
        }
        // Always close on click (if not dragged)
        lb.style.display = 'none';
        scale = 1; pointX = 0; pointY = 0;
        setTransform();
    });
})();
