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

// ========== 本地文件夹存储 (File System Access API) ==========
const localFS = {
    handle: null,
    _supported: typeof window !== 'undefined' && 'showDirectoryPicker' in window,

    isActive() { return !!this.handle; },

    _updateUI() {
        const badge = $('localFsBadge'), path = $('localFsPath'), clearBtn = $('clearFolderBtn'), notSup = $('localFsNotSupported');
        if (!this._supported) { if (notSup) notSup.classList.remove('hidden'); return; }
        if (this.handle) {
            if (badge) { badge.textContent = '✅ 已绑定'; badge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full border bg-success/10 text-success border-success/20'; badge.classList.remove('hidden'); }
            if (path) { path.textContent = `📁 ${this.handle.name}`; path.classList.remove('hidden'); }
            if (clearBtn) clearBtn.classList.remove('hidden');
        } else {
            if (badge) badge.classList.add('hidden');
            if (path) path.classList.add('hidden');
            if (clearBtn) clearBtn.classList.add('hidden');
        }
    },

    async pick() {
        if (!this._supported) return;
        try {
            this.handle = await window.showDirectoryPicker({ mode: 'readwrite', startIn: 'pictures' });
            await idb.set('nanscript_fs_handle', this.handle);
            this._updateUI();
            // 立即将当前 API 配置写入本地文件夹
            try { await this.saveConfig(); } catch(e) { console.error('saveConfig 失败:', e); }
            showToast(`✅ 已绑定本地文件夹：${this.handle.name}`);
        } catch (e) {
            if (e.name !== 'AbortError') showToast('选择文件夹失败', 'error');
        }
    },

    async restore() {
        if (!this._supported) return false;
        try {
            const h = await idb.get('nanscript_fs_handle');
            if (!h || typeof h.queryPermission !== 'function') return false;
            const perm = await h.queryPermission({ mode: 'readwrite' });
            if (perm === 'granted') { this.handle = h; this._updateUI(); return true; }
            if (perm === 'prompt') {
                const granted = await h.requestPermission({ mode: 'readwrite' });
                if (granted === 'granted') { this.handle = h; this._updateUI(); return true; }
            }
        } catch (e) { console.warn('localFS.restore:', e); }
        return false;
    },

    async clear() {
        this.handle = null;
        await idb.set('nanscript_fs_handle', null);
        this._updateUI();
        showToast('本地文件夹已解除绑定，切换为浏览器存储模式');
    },

    // 获取/创建子目录 handle（支持 'originals', 'thumbs', 'refs'）
    async _getSubDir(name) {
        const images = await this.handle.getDirectoryHandle('images', { create: true });
        return await images.getDirectoryHandle(name, { create: true });
    },

    // 写入图片文件 (base64 → file)，subDir: 'originals' | 'thumbs' | 'refs'
    async saveImage(filename, b64Data, subDir = 'originals') {
        const parts = b64Data.split(',');
        const bstr = atob(parts[1]);
        const u8 = new Uint8Array(bstr.length);
        for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
        const dir = await this._getSubDir(subDir);
        const fh = await dir.getFileHandle(filename, { create: true });
        const w = await fh.createWritable();
        await w.write(u8); await w.close();
    },

    // 获取图片的 blob URL，subDir: 'originals' | 'thumbs' | 'refs'
    async getImageURL(filename, subDir = 'originals') {
        try {
            const dir = await this._getSubDir(subDir);
            const fh = await dir.getFileHandle(filename);
            return URL.createObjectURL(await fh.getFile());
        } catch { return ''; }
    },

    // 写入 JSON
    async saveJSON(filename, data) {
        const fh = await this.handle.getFileHandle(filename, { create: true });
        const w = await fh.createWritable();
        await w.write(JSON.stringify(data, null, 2)); await w.close();
    },

    // 读取 JSON
    async loadJSON(filename, fallback = []) {
        try {
            const fh = await this.handle.getFileHandle(filename);
            const file = await fh.getFile();
            return JSON.parse(await file.text());
        } catch { return fallback; }
    },

    // 保存 API 配置到 config.json
    async saveConfig() {
        const cfg = {
            baseUrl: $('baseUrl')?.value || '',
            apiKey: $('apiKey')?.value || '',
            modelGemini: $('modelGemini')?.value || '',
            modelOpenai: $('modelOpenai')?.value || '',
            currentEngine: ls('nanscript_currentEngine') || 'gemini'
        };
        await this.saveJSON('config.json', cfg);
    },

    // 从 config.json 读取 API 配置并应用
    async loadConfig() {
        const cfg = await this.loadJSON('config.json', null);
        if (!cfg) return;
        if (cfg.baseUrl && $('baseUrl')) { $('baseUrl').value = cfg.baseUrl; ls('nanscript_baseUrl', cfg.baseUrl); }
        if (cfg.apiKey && $('apiKey')) { $('apiKey').value = cfg.apiKey; ls('nanscript_apiKey', cfg.apiKey); }
        if (cfg.modelGemini && $('modelGemini')) { $('modelGemini').value = cfg.modelGemini; ls('nanscript_modelGemini', cfg.modelGemini); }
        if (cfg.modelOpenai && $('modelOpenai')) { $('modelOpenai').value = cfg.modelOpenai; ls('nanscript_modelOpenai', cfg.modelOpenai); }
        if (cfg.currentEngine) ls('nanscript_currentEngine', cfg.currentEngine);
        // 同步 UI
        if (typeof syncModelInput === 'function') syncModelInput();
        if (typeof updatePreview === 'function') updatePreview();
    }
};

// ========== 引擎预设 (Provider Defaults) ==========
// 在这里直接修改两个方案的默认模型名称
const PROVIDER_DEFAULTS = {
    gemini: {
        label: 'Banana · Gemini',
        model: 'gemini-2.0-flash-preview-image-generation',
        apiType: 'gemini',
        badgeClass: 'gemini',
        badgeText: '✦ Banana · Gemini',
    },
    openai: {
        label: 'GPT Image-2',
        model: 'gpt-image-1',
        apiType: 'openai',
        badgeClass: 'openai',
        badgeText: '⬡ GPT Image-2',
    }
};

// ========== 状态 ==========
let isGenerating = false, selectedFiles = [], promptLib = [], historyData = [], curFolder = 0;
let apiProfiles = safeParse('nanscript_api_profiles', '[]'), pendingThumb = null;
let currentGalleryData = [];
let abortCtrl = null; // 用于终止正在进行的生成请求
let currentEngine = ls('nanscript_currentEngine') || 'gemini'; // 当前激活引擎

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
// getModel() 根据当前激活引擎读取对应的模型输入框
const getModel = () => {
    if (currentEngine === 'openai') {
        return $('modelOpenai')?.value?.trim() || PROVIDER_DEFAULTS.openai.model;
    }
    return $('modelGemini')?.value?.trim() || PROVIDER_DEFAULTS.gemini.model;
};
// 同步隐藏桥接字段，确保 executeGeneration 读取正确
const syncModelInput = () => { const mi = $('modelInput'); if (mi) mi.value = getModel(); };

function updatePreview() {
    const r = $('ratioSelect'), q = $('qualitySelect'), b = $('batchSelect');
    if (!r || !q || !b) return;
    syncModelInput();
    $('paramPreview').textContent = `${r.value || 'Auto'} | ${q.options[q.selectedIndex]?.text.split(' ')[0] || 'Standard'} | x${b.value} | ${getModel() || 'No Model'}`;
    // 同步 hint 文字
    const hint = $('engineModelHintText');
    if (hint) hint.textContent = `当前模型: ${getModel()}`;
}

// ========== 引擎切换 ==========
function switchEngine(engineKey, silent = false) {
    const cfg = PROVIDER_DEFAULTS[engineKey];
    if (!cfg) return;
    currentEngine = engineKey;
    ls('nanscript_currentEngine', engineKey);

    // 更新隐藏的 apiTypeSelect（由引擎决定，不暴露给用户）
    const apiSel = $('apiTypeSelect');
    if (apiSel) { apiSel.value = cfg.apiType; ls('nanscript_apiTypeSelect', cfg.apiType); }

    // 若对应引擎的模型输入框为空，填入预设默认值
    if (engineKey === 'gemini') {
        const mg = $('modelGemini');
        if (mg && !mg.value.trim()) { mg.value = cfg.model; ls('nanscript_modelGemini', cfg.model); }
    } else {
        const mo = $('modelOpenai');
        if (mo && !mo.value.trim()) { mo.value = cfg.model; ls('nanscript_modelOpenai', cfg.model); }
    }

    // 同步隐藏桥接字段
    syncModelInput();

    // 更新 UI 状态
    document.querySelectorAll('.engine-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.engine === engineKey);
    });
    const badge = $('engineBadge');
    if (badge) { badge.textContent = cfg.badgeText; badge.className = cfg.badgeClass; }
    const hint = $('engineModelHintText');
    if (hint) hint.textContent = `当前模型: ${getModel()}`;

    updatePreview();
    if (!silent) showToast(`已切换至 ${cfg.label}`);
}

// ========== 模型获取 (同时拉取 Gemini + OpenAI 两个引擎列表) ==========
async function fetchModels() {
    const base = $('baseUrl').value.trim(), key = $('apiKey').value.trim(), st = $('modelStatus'), btn = $('fetchModelsBtn');
    if (!key || !base) { st.className = 'model-status fail'; st.textContent = !key ? '❌ 缺少 API Key' : '❌ 缺少 Base URL'; return; }
    btn.classList.add('loading'); btn.disabled = true;
    st.className = 'model-status'; st.textContent = '正在获取模型列表...';

    // 辅助：填充某个 select，并把值写回对应的 input
    const fillSelect = (sel, inp, lsKey, models, curVal) => {
        sel.innerHTML = '';
        models.forEach(name => {
            const o = document.createElement('option');
            o.value = o.textContent = name;
            sel.appendChild(o);
        });
        // 优先恢复已填值，否则优先选 image 相关
        if (curVal && Array.from(sel.options).some(o => o.value === curVal)) sel.value = curVal;
        else {
            const imgOpt = Array.from(sel.options).find(o => o.value.includes('image'));
            if (imgOpt) sel.value = imgOpt.value;
        }
        if (inp) { inp.value = sel.value; ls(lsKey, sel.value); }
        inp?.classList.add('hidden'); sel.classList.remove('hidden');
        sel.onchange = () => { if (inp) { inp.value = sel.value; ls(lsKey, sel.value); } syncModelInput(); updatePreview(); };
        syncModelInput(); updatePreview();
    };

    const results = await Promise.allSettled([
        // Gemini 模型列表
        fetch(`${base.replace(/\/$/, '')}/v1beta/models?key=${key}`, { headers: { 'Content-Type': 'application/json' } })
            .then(r => { if (!r.ok) throw new Error(`Gemini HTTP ${r.status}`); return r.json(); })
            .then(d => (d.models || []).map(m => (m.name || m.id).replace('models/', ''))),
        // OpenAI 兼容模型列表
        fetch(`${base.replace(/\/$/, '')}/v1/models`, { headers: { 'Authorization': `Bearer ${key}` } })
            .then(r => { if (!r.ok) throw new Error(`OpenAI HTTP ${r.status}`); return r.json(); })
            .then(d => (d.data || []).map(m => m.id || m.name))
    ]);

    const [geminiRes, openaiRes] = results;
    const msgs = [];

    if (geminiRes.status === 'fulfilled' && geminiRes.value.length) {
        fillSelect($('modelGeminiSelect'), $('modelGemini'), 'nanscript_modelGemini', geminiRes.value, $('modelGemini')?.value?.trim());
        msgs.push(`Banana: ${geminiRes.value.length} 个模型`);
    } else {
        msgs.push(`Banana: ❌ ${geminiRes.reason?.message || '获取失败'}`);
        $('modelGemini')?.classList.remove('hidden'); $('modelGeminiSelect')?.classList.add('hidden');
    }

    if (openaiRes.status === 'fulfilled' && openaiRes.value.length) {
        fillSelect($('modelOpenaiSelect'), $('modelOpenai'), 'nanscript_modelOpenai', openaiRes.value, $('modelOpenai')?.value?.trim());
        msgs.push(`Image-2: ${openaiRes.value.length} 个模型`);
    } else {
        msgs.push(`Image-2: ❌ ${openaiRes.reason?.message || '获取失败'}`);
        $('modelOpenai')?.classList.remove('hidden'); $('modelOpenaiSelect')?.classList.add('hidden');
    }

    st.className = 'model-status ok'; st.textContent = '✅ ' + msgs.join(' | ');
    btn.classList.remove('loading'); btn.disabled = false;
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
                <span class="text-[11px] font-bold text-primary tracking-widest uppercase placeholder-timer">正在生成... 0s</span>
            </div>
        `;
        gallery.prepend(el);
        placeholders.push(el);
    }

    // 计时器：每秒更新 statusBox 和占位卡片
    let _timerSec = 0;
    const _timerInterval = setInterval(() => {
        _timerSec++;
        status.innerHTML = `神笔正在与绘画之神通讯…  <span class="font-mono font-bold text-primary">${_timerSec}s</span>`;
        placeholders.forEach(p => {
            const lbl = p.querySelector('.placeholder-timer');
            if (lbl) lbl.textContent = `正在生成... ${_timerSec}s`;
        });
    }, 1000);
    
    try {
        let imgs = custom.imageDatas || [];
        if (!custom.imageDatas && selectedFiles.length) imgs = await Promise.all(selectedFiles.map(fileToB64));
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

        const model = custom.model || getModel();
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

                let openaiSize = ratio; // 例如 "1024x1024"

                if (imgs.length) {
                    const fd = new FormData();
                    fd.append('model', model);
                    fd.append('prompt', finalPrompt);
                    if (openaiSize && openaiSize !== '') fd.append('size', openaiSize);
                    if (outputFormat) fd.append('output_format', outputFormat);
                    if (bgStyle) fd.append('background', bgStyle);
                    imgs.forEach((img, i) => fd.append('image', base64ToBlob(img), `image${i}.png`));
                    fetchOptions.body = fd;
                } else {
                    const reqBody = { model: model, prompt: finalPrompt };
                    if (openaiSize && openaiSize !== '') reqBody.size = openaiSize;
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
                
                // 将具体的宽高尺寸转换回 Gemini 原生支持的宽高比
                let geminiRatio = ratio;
                if (ratio && ratio.includes('x')) {
                    const [w, h] = ratio.split('x').map(Number);
                    if (w && h) {
                        const r = w / h;
                        if (Math.abs(r - 16/9) < 0.1) geminiRatio = "16:9";
                        else if (Math.abs(r - 9/16) < 0.1) geminiRatio = "9:16";
                        else if (Math.abs(r - 4/3) < 0.15) geminiRatio = "4:3";
                        else if (Math.abs(r - 3/4) < 0.15) geminiRatio = "3:4";
                        else if (Math.abs(r - 3/2) < 0.1) geminiRatio = "4:3"; // 3:2 映射到最接近的 4:3
                        else if (Math.abs(r - 2/3) < 0.1) geminiRatio = "3:4"; // 2:3 映射到最接近的 3:4
                        else geminiRatio = "1:1";
                    }
                }
                if (geminiRatio && geminiRatio !== '') imageConfig.aspectRatio = geminiRatio;
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
        // 始终隐藏文字描述区域，不自动弹出
        textSec.style.display = 'none';
        if (firstText && $('textOutput')) $('textOutput').textContent = firstText;

        placeholders.forEach(p => p.remove());

        const gallery = $('imageGallery');
        // prepend backwards so valid[0] is at the very top
        valid.reverse().forEach(src => {
            const sec = ((Date.now() - t0) / 1000).toFixed(1);
            // 预生成 imageId 共享给 gallery 和 history，确保文件名一致
            const imageId = Date.now().toString() + '_' + Math.random().toString(36).slice(2,6);
            const imageFile = localFS.isActive() ? `${imageId}.png` : null;
            const el = createGalleryItemDOM(src, sec, ratio, quality);
            gallery.prepend(el);
            currentGalleryData.unshift({ src, sec, ratio, quality, prompt: firstText, imageFile });
            saveHistory({ prompt, model, aspectRatio: ratio, quality, batchCount: count }, src, imgs, imageId);
        });
        // 限制本地存储数量，防止过大
        currentGalleryData = currentGalleryData.slice(0, 50);
        if (localFS.isActive()) {
            // 本地模式：存元数据（含 imageFile 引用），不存 Base64
            localFS.saveJSON('gallery.json', currentGalleryData.map(i => ({ sec: i.sec, ratio: i.ratio, quality: i.quality, prompt: i.prompt, imageFile: i.imageFile }))).catch(() => {});
        } else {
            idb.set('nanscript_current_gallery', currentGalleryData);
        }
        
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
    } finally {
        clearInterval(_timerInterval);
        isGenerating = false; abortCtrl = null;
        btn.innerHTML = '<span class="material-symbols-outlined">auto_awesome</span> 开始创造';
        status.innerHTML = '';
    }
}

// ========== 历史记录 ==========
function saveHistory(params, b64Img, refImages = [], presetId = null) {
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

    async function _doSave(thumb) {
        const id = presetId || Date.now().toString();
        const date = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; })();

        if (localFS.isActive()) {
            // 本地模式：原图存 originals/，缩略图存 thumbs/
            const imageFile = `${id}.png`;
            const thumbFile = `${id}_thumb.jpg`;
            try { await localFS.saveImage(imageFile, originalImageSrc, 'originals'); } catch(e) { console.warn('写入原图失败', e); }
            try { await localFS.saveImage(thumbFile, thumb, 'thumbs'); } catch(e) { console.warn('写入缩略图失败', e); }

            // 将实际垂图存入 refs/ 子目录
            const refFiles = [];
            if (Array.isArray(refImages) && refImages.length) {
                for (let i = 0; i < refImages.length; i++) {
                    const refFname = `${id}_ref${i}.png`;
                    try {
                        await localFS.saveImage(refFname, refImages[i], 'refs');
                        refFiles.push(refFname);
                    } catch(e) { console.warn('写入垂图失败', e); }
                }
            }
            // 内存中保留 _thumbSrc（base64），供当升的 renderHistory 显示使用，刷新后改由文件加载
            historyData.unshift({ id, date, prompt: params.prompt || '纯图生成', model: params.model, aspectRatio: params.aspectRatio, quality: params.quality, batchCount: params.batchCount, apiType: $('apiTypeSelect')?.value || 'gemini', imageFile, thumbFile, _thumbSrc: thumb, refFiles, refImages: [] });
            if (historyData.length > 100) historyData = historyData.slice(0, 100);
            // 写 JSON 时不带 _thumbSrc（临时内存字段，不应持久化）
            const toSave = historyData.map(({ _thumbSrc, ...rest }) => rest);
            await localFS.saveJSON('history.json', toSave);
        } else {
            historyData.unshift({ id, date, prompt: params.prompt || '纯图生成', model: params.model, aspectRatio: params.aspectRatio, quality: params.quality, batchCount: params.batchCount, apiType: $('apiTypeSelect')?.value || 'gemini', thumb, fullImage: originalImageSrc, refImages });
            if (historyData.length > 100) historyData = historyData.slice(0, 100);
            idb.set('nanscript_history_db', historyData);
        }
        renderHistory();
    }
}

let currentHistoryIdx = -1;
let currentDetailMode = 'history';

async function showHistoryDetail(item, idx, mode = 'history') {
    currentHistoryIdx = idx;
    currentDetailMode = mode;

    // 本地模式：始终从 originals/ 加载原图（用于放大）
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
    const hdMobileImg = $('hdMobileImage'), hdMobileImgWrap = $('hdMobileGeneratedImg');
    if (hdMobileImgWrap) {
        if (imgSrc && !imgSrc.endsWith('index.html')) {
            hdMobileImg.src = imgSrc;
            hdMobileImgWrap.style.display = ''; // CSS 媒体查询控制显隐
            hdMobileImgWrap.onclick = () => { $('lightboxImg').src = imgSrc; $('lightbox').style.display = 'flex'; };
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
    
    $('hdImage').onclick = () => { if($('hdImage').src) { $('lightboxImg').src = $('hdImage').src; $('lightbox').style.display = 'flex'; } };

    const refGroup = $('hdRefImagesGroup'), refList = $('hdRefImages');
    // 支持本地模式：优先用 refFiles 字段，降级用 refImages
    const hasRefFiles = localFS.isActive() && Array.isArray(item.refFiles) && item.refFiles.length;
    const hasRefImages = Array.isArray(item.refImages) && item.refImages.length;

    const refSrcs = []; // 收集垫图 src，同时填充移动端顶部缩略栏

    if (hasRefFiles || hasRefImages) {
        refGroup.style.display = 'block';
        refList.innerHTML = '';
        if (hasRefFiles) {
            for (const fname of item.refFiles) {
                const src = await localFS.getImageURL(fname, 'refs').catch(() => '');
                if (!src) continue;
                refSrcs.push(src);
                const div = document.createElement('div'); div.className = 'preview-item';
                div.innerHTML = `<img src="${src}">`;
                refList.appendChild(div);
            }
        } else {
            item.refImages.forEach(src => {
                refSrcs.push(src);
                const div = document.createElement('div'); div.className = 'preview-item';
                div.innerHTML = `<img src="${src}">`;
                refList.appendChild(div);
            });
        }
    } else {
        refGroup.style.display = 'none';
    }

    // 移动端顶部垫图缩略栏
    const mobileRefBar = $('hdMobileRefBar');
    if (mobileRefBar) {
        mobileRefBar.innerHTML = '';
        if (refSrcs.length) {
            refSrcs.forEach(src => {
                const img = document.createElement('img');
                img.src = src;
                img.alt = '垫图';
                // 点击打开 lightbox
                img.onclick = () => { $('lightboxImg').src = src; $('lightbox').style.display = 'flex'; };
                mobileRefBar.appendChild(img);
            });
            mobileRefBar.style.display = ''; // 由 CSS 媒体查询控制显隐
        } else {
            mobileRefBar.style.display = 'none';
        }
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
        const thumbSrc = item._thumbSrc || item.thumb || '';
        el.innerHTML = `<div class="w-16 h-16 rounded-lg bg-surface-container overflow-hidden flex-shrink-0 border border-outline-variant/50 relative">
            <img src="${thumbSrc}" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity">
        </div>
        <div class="flex flex-col justify-center flex-1 min-w-0 pr-6">
            <span class="text-[11px] text-primary uppercase tracking-widest font-bold mb-1.5 line-clamp-1">${escHtml(item.prompt)}</span>
            <div class="flex gap-1.5 flex-wrap mb-1.5">${badges}</div>
            <span class="text-[9px] text-on-surface-variant/60 italic">${escHtml(item.date)}</span>
        </div>
        <button class="hd absolute top-2 right-2 p-1 text-error/0 group-hover:text-error hover:bg-error/10 rounded transition-all material-symbols-outlined text-[16px]">delete</button>`;
        
        el.onclick = () => showHistoryDetail(item, idx);
        
        el.querySelector('.hd').onclick = e => {
            e.stopPropagation();
            historyData.splice(idx, 1);
            if (localFS.isActive()) localFS.saveJSON('history.json', historyData).catch(() => {});
            else idb.set('nanscript_history_db', historyData);
            renderHistory();
        };
        list.appendChild(el);
    });
}

// ========== 咒语书 ==========
const saveLib = async () => {
    if (localFS.isActive()) await localFS.saveJSON('prompts.json', promptLib);
    else idb.set('nanscript_prompt_lib', promptLib);
};

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

async function renderPrompts() {
    const grid = $('promptGrid'), title = $('currentFolderName');
    if (!grid || !title) return;
    if (!promptLib.length) { title.textContent = '暂无分类'; grid.innerHTML = '<div style="color:var(--text-muted)">请先创建分类</div>'; return; }
    const folder = promptLib[curFolder]; title.textContent = `📂 ${folder.folderName}`; grid.innerHTML = '';
    for (let i = 0; i < folder.prompts.length; i++) {
        const p = folder.prompts[i];
        const card = document.createElement('div'); card.className = 'bg-surface-container border border-outline-variant rounded-xl overflow-hidden cursor-pointer hover:-translate-y-1 hover:shadow-lg hover:border-primary transition-all group';
        // 冒泡图源：支持本地模式的 thumbFile
        let imgSrc = p.thumb || p.fullImage || '';
        if (!imgSrc && p.thumbFile && localFS.isActive()) {
            imgSrc = await localFS.getImageURL(p.thumbFile, 'thumbs').catch(() => '');
        }
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
    }
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
    Promise.all(selectedFiles.map(fileToB64)).then(async b64s => {
        if (localFS.isActive()) {
            // 本地模式：将当前垂图存入 refs/ 子目录
            const refFiles = [];
            for (let i = 0; i < b64s.length; i++) {
                const fname = `current_ref_${i}.png`;
                await localFS.saveImage(fname, b64s[i], 'refs').catch(e => console.warn('写垂图失败', e));
                refFiles.push(fname);
            }
            await localFS.saveJSON('current_refs.json', refFiles).catch(() => {});
        } else {
            idb.set('nanscript_current_refs', b64s);
        }
    }).catch(() => {});
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
        const histItem = currentDetailMode === 'history' ? historyData[currentHistoryIdx] : null;
        promptLib[curFolder].prompts.unshift({
            name,
            content: text,
            // blob URL 刷新后失效，只保留 data: base64；本地 FS 模式靠 thumbFile 在 renderPrompts 中按需加载
            thumb: (() => {
                const safeThumb = src => (src && src.startsWith('data:')) ? src : '';
                return safeThumb(histItem?.thumb) || safeThumb(histItem?._thumbSrc) || '';
            })(),
            fullImage: histItem?.fullImage || '',
            imageFile: histItem?.imageFile || null,
            thumbFile: histItem?.thumbFile || null,
            model: histItem?.model, aspectRatio: histItem?.aspectRatio,
            quality: histItem?.quality, batchCount: histItem?.batchCount,
            apiType: histItem?.apiType, refImages: histItem?.refImages
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
            tBtn.innerHTML = '<span class="material-symbols-outlined text-[20px]">hdr_auto</span>';
        } else if (t === 'dark') {
            isDark = true;
            tBtn.innerHTML = '<span class="material-symbols-outlined text-[20px]">dark_mode</span>';
        } else {
            isDark = false;
            tBtn.innerHTML = '<span class="material-symbols-outlined text-[20px]">light_mode</span>';
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

    // ==========================================
    // 自定义画幅尺寸下拉组件逻辑
    // ==========================================
    const initRatioDropdown = () => {
        const presets = [
            { group: '标清 (SD)', items: [
                { val: '512x512', label: '512 x 512 (1:1)' },
                { val: '768x512', label: '768 x 512 (3:2)' },
                { val: '512x768', label: '512 x 768 (2:3)' }
            ]},
            { group: '高清 (HD)', items: [
                { val: '1024x1024', label: '1024 x 1024 (1:1 高清)' },
                { val: '1024x576', label: '1024 x 576 (16:9)' },
                { val: '576x1024', label: '576 x 1024 (9:16)' },
                { val: '1024x768', label: '1024 x 768 (4:3)' },
                { val: '768x1024', label: '768 x 1024 (3:4)' }
            ]},
            { group: '超清 (2K)', items: [
                { val: '2048x2048', label: '2048 x 2048 (1:1)' },
                { val: '1920x1080', label: '1920 x 1080 (16:9)' },
                { val: '1080x1920', label: '1080 x 1920 (9:16)' }
            ]},
            { group: '极致 (4K)', items: [
                { val: '2880x2880', label: '2880 x 2880 (1:1)' },
                { val: '3840x2160', label: '3840 x 2160 (16:9)' },
                { val: '2160x3840', label: '2160 x 3840 (9:16)' }
            ]},
            { group: '其他', items: [
                { val: 'custom', label: '自定义尺寸...' }
            ]}
        ];

        const btn = $('ratioSelectBtn'), text = $('ratioSelectText'), hiddenInput = $('ratioSelect'), drop = $('ratioDropdown'), customBox = $('customRatioContainer');
        if (!btn) return;

        // 渲染列表
        drop.innerHTML = presets.map(g => `
            <div class="px-3 py-1.5 text-[10px] font-bold text-primary bg-primary/5 uppercase tracking-widest sticky top-0 backdrop-blur-md z-10">${g.group}</div>
            <div class="py-1">
                ${g.items.map(i => `<div class="ratio-opt px-3 py-2 text-xs text-on-surface hover:bg-surface-container cursor-pointer transition-colors font-mono flex justify-between items-center" data-val="${i.val}"><span>${i.label}</span></div>`).join('')}
            </div>
        `).join('');

        // 根据值更新 UI
        const updateUI = (val) => {
            hiddenInput.value = val;
            let foundLabel = val === 'custom' ? '自定义尺寸...' : val;
            for(const g of presets) {
                const f = g.items.find(i => i.val === val);
                if (f) { foundLabel = f.label; break; }
            }
            text.textContent = foundLabel;
            
            drop.querySelectorAll('.ratio-opt').forEach(el => {
                if (el.dataset.val === val) el.classList.add('bg-primary/10', 'text-primary', 'font-bold');
                else el.classList.remove('bg-primary/10', 'text-primary', 'font-bold');
            });

            if (val === 'custom') {
                customBox.classList.remove('hidden');
                customBox.classList.add('flex');
            } else {
                customBox.classList.add('hidden');
                customBox.classList.remove('flex');
            }
        };

        // 绑定事件
        btn.onclick = (e) => { e.stopPropagation(); drop.classList.toggle('hidden'); };
        drop.querySelectorAll('.ratio-opt').forEach(opt => {
            opt.onclick = () => {
                updateUI(opt.dataset.val);
                drop.classList.add('hidden');
                hiddenInput.dispatchEvent(new Event('change'));
            };
        });
        document.addEventListener('click', (e) => {
            if (!btn.contains(e.target) && !drop.contains(e.target)) drop.classList.add('hidden');
        });

        window._updateRatioUI = updateUI;
    };
    initRatioDropdown();

    // 表单字段持久化（modelGemini/modelOpenai 独立保存，apiTypeSelect 由引擎切换器驱动不持久化）
    ['baseUrl', 'apiKey', 'modelGemini', 'modelOpenai', 'ratioSelect', 'customWidth', 'customHeight', 'qualitySelect', 'promptInput', 'batchSelect'].forEach(id => {
        const el = $(id); if (!el) return;
        const saved = ls('nanscript_' + id); if (saved) { el.value = saved; if (id === 'batchSelect') $('batchValue').textContent = saved; }
        const sync = () => {
            ls('nanscript_' + id, el.value);
            if (id === 'batchSelect') $('batchValue').textContent = el.value;
            // 模型变更时同步桥接字段
            if (id === 'modelGemini' || id === 'modelOpenai') syncModelInput();
            if (id === 'ratioSelect' && window._updateRatioUI) {
                window._updateRatioUI(el.value);
            }
            updatePreview();
        };
        el.oninput = el.onchange = sync;
    });
    // 初始化时同步UI状态
    if (window._updateRatioUI) window._updateRatioUI($('ratioSelect').value || '1024x1024');

    // 垫图
    const imgInput = $('imageInput');
    if (imgInput) {
        imgInput.onchange = e => {
            const nf = Array.from(e.target.files);
            if (selectedFiles.length + nf.length > 10) return alert('最多 10 张！');
            selectedFiles = selectedFiles.concat(nf); renderPreviews(); e.target.value = '';
        };
        // 拖拽
        const panel = imgInput.parentElement;
        if (panel) {
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(e => panel.addEventListener(e, ev => { ev.preventDefault(); ev.stopPropagation(); }));
            ['dragenter', 'dragover'].forEach(e => panel.addEventListener(e, () => panel.classList.add('bg-surface-container-highest', 'border-primary')));
            ['dragleave', 'drop'].forEach(e => panel.addEventListener(e, () => panel.classList.remove('bg-surface-container-highest', 'border-primary')));
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
            // 恢复双引擎模型
            if (p.modelGemini && $('modelGemini')) { $('modelGemini').value = p.modelGemini; ls('nanscript_modelGemini', p.modelGemini); }
            if (p.modelOpenai && $('modelOpenai')) { $('modelOpenai').value = p.modelOpenai; ls('nanscript_modelOpenai', p.modelOpenai); }
            $('apiProfileName').value = p.name;
            syncModelInput(); updatePreview(); showToast(`已加载: ${p.name}（可修改后保存覆盖）`);
        };
    }
    $('saveProfileBtn').onclick = () => {
        const name = $('apiProfileName').value.trim(); if (!name) return alert('请输入配置名称');
        const cfg = {
            name,
            baseUrl: $('baseUrl').value,
            apiKey: $('apiKey').value,
            modelGemini: $('modelGemini')?.value || PROVIDER_DEFAULTS.gemini.model,
            modelOpenai: $('modelOpenai')?.value || PROVIDER_DEFAULTS.openai.model,
        };
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
        // 保存公共字段
        ['baseUrl', 'apiKey'].forEach(id => { if ($(id)) ls('nanscript_' + id, $(id).value); });
        // 保存双引擎模型字段
        const mg = $('modelGemini')?.value || PROVIDER_DEFAULTS.gemini.model;
        const mo = $('modelOpenai')?.value || PROVIDER_DEFAULTS.openai.model;
        ls('nanscript_modelGemini', mg); ls('nanscript_modelOpenai', mo);
        syncModelInput(); updatePreview();
        $('apiConfigModal').style.display = 'none';
        // 本地模式：同步写入 config.json
        if (localFS.isActive()) {
            localFS.saveConfig()
                .then(() => console.log('[localFS] config.json 已写入'))
                .catch(e => { console.error('[localFS] saveConfig 失败:', e); showToast('配置写入本地失败', 'error'); });
        }
        showToast(`已应用 · Banana: ${mg} | Image-2: ${mo}`);
    };

    // ========== 引擎切换器初始化 ==========
    document.querySelectorAll('.engine-btn').forEach(btn => {
        btn.onclick = () => switchEngine(btn.dataset.engine);
    });
    // 恢复上次引擎选择（静默初始化）
    (function restoreEngine() {
        const eng = currentEngine;
        const cfg = PROVIDER_DEFAULTS[eng];
        if (!cfg) return;
        // 若 Gemini 模型框为空则填预设
        const mg = $('modelGemini');
        if (mg && !mg.value.trim()) { mg.value = PROVIDER_DEFAULTS.gemini.model; ls('nanscript_modelGemini', PROVIDER_DEFAULTS.gemini.model); }
        // 若 OpenAI 模型框为空则填预设
        const mo = $('modelOpenai');
        if (mo && !mo.value.trim()) { mo.value = PROVIDER_DEFAULTS.openai.model; ls('nanscript_modelOpenai', PROVIDER_DEFAULTS.openai.model); }
        // 同步隐藏桥接字段 & apiTypeSelect
        const apiSel = $('apiTypeSelect');
        if (apiSel) apiSel.value = cfg.apiType;
        syncModelInput();
        // 更新按钮激活态
        document.querySelectorAll('.engine-btn').forEach(b => b.classList.toggle('active', b.dataset.engine === eng));
        // 更新徽章
        const badge = $('engineBadge');
        if (badge) { badge.textContent = cfg.badgeText; badge.className = cfg.badgeClass; }
        const hint = $('engineModelHintText');
        if (hint) hint.textContent = `当前模型: ${getModel()}`;
    })();

    // 按钮绑定
    $('fetchModelsBtn').onclick = fetchModels;
    $('runBtn').onclick = () => executeGeneration();

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
            setTimeout(() => { document.body.removeChild(a); }, 100);
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
    const pickBtn = $('pickFolderBtn'), clearFolderBtnEl = $('clearFolderBtn');
    const mobileEnv = window.innerWidth <= 768;
    if (!localFS._supported || mobileEnv) {
        // 移动端或不支持的环境：隐藏整个本地文件夹区域
        const fsSection = $('localFsSection');
        if (fsSection) fsSection.style.display = 'none';
        if (pickBtn) pickBtn.disabled = true;
    } else {
        if (pickBtn) pickBtn.onclick = () => localFS.pick();
        if (clearFolderBtnEl) clearFolderBtnEl.onclick = async () => {
            if (!confirm('解除绑定后，将切换回浏览器缓存模式。确定解除吗？')) return;
            await localFS.clear();
        };
    }

    // 应用渲染参数（历史记录列表支持本地模式）
    const renderHistoryItem = async (item) => {
        let thumbSrc = item.thumb || '';
        if (!thumbSrc && item.thumbFile && localFS.isActive()) {
            thumbSrc = await localFS.getImageURL(item.thumbFile, 'thumbs').catch(() => '');
        }
        return { ...item, _thumbSrc: thumbSrc || item.thumb || '' };
    };

    // 启动加载：移动端强制走 IndexedDB，桌面端优先尝试本地文件夹
    const initData = async () => {
        const mobileDevice = window.innerWidth <= 768;
        const hasLocal = mobileDevice ? false : await localFS.restore();

        if (hasLocal) {
            // 本地模式：从 JSON 文件加载
            promptLib = await localFS.loadJSON('prompts.json', []);
            historyData = await localFS.loadJSON('history.json', []);

            // 渲染历史记录（异步加载缩略图地址）
            const list = $('historyList'); if (list) list.innerHTML = '<div class="text-center text-outline text-xs mt-8">正在从本地加载...</div>';
            const enriched = await Promise.all(historyData.map(renderHistoryItem));
            historyData = enriched;
            renderHistory();

            // 从 gallery.json + images/ 恢复画廊
            const galleryMeta = await localFS.loadJSON('gallery.json', []);
            if (galleryMeta.length) {
                const gallery = $('imageGallery');
                gallery.innerHTML = '';
                for (const meta of galleryMeta) {
                    // 直接使用 gallery.json 中存储的 imageFile 引用
                    if (!meta.imageFile) continue;
                    const src = await localFS.getImageURL(meta.imageFile, 'originals').catch(() => '');
                    if (!src) continue;
                    currentGalleryData.push({ src, sec: meta.sec, ratio: meta.ratio, quality: meta.quality, prompt: meta.prompt, imageFile: meta.imageFile });
                    const el = createGalleryItemDOM(src, meta.sec, meta.ratio, meta.quality);
                    gallery.appendChild(el);
                }
                if (currentGalleryData.length) {
                    $('emptyState').style.display = 'none';
                    $('resultArea').style.display = 'block';
                    $('textResultSection').style.display = 'none';
                }
            }
            // 恢复当前垂图列表（current_refs.json）
            const refFiles = await localFS.loadJSON('current_refs.json', []);
            if (refFiles.length) {
                for (const fname of refFiles) {
                    try {
                        const url = await localFS.getImageURL(fname, 'refs');
                        if (!url) continue;
                        const resp = await fetch(url);
                        const blob = await resp.blob();
                        selectedFiles.push(new File([blob], fname, { type: blob.type }));
                    } catch(e) { console.warn('恢复垂图失败:', fname, e); }
                }
                if (selectedFiles.length) renderPreviews();
            }
            // 加载本地配置（API Key / URL / 模型）
            await localFS.loadConfig();
        } else {
            // 浏览器模式：从 IDB 加载
            idb.get('nanscript_prompt_lib').then(d => { if (Array.isArray(d) && d.length) promptLib = d; }).catch(() => {});
            idb.get('nanscript_history_db').then(d => {
                if (Array.isArray(d) && d.length) historyData = d;
                else try { const o = JSON.parse(ls('nanscript_history_db') || '[]'); if (o.length) { historyData = o; idb.set('nanscript_history_db', o); } } catch {}
                renderHistory();
            }).catch(() => renderHistory());
            idb.get('nanscript_current_refs').then(d => {
                if (Array.isArray(d) && d.length) {
                    d.forEach((src, idx) => {
                        if (src.startsWith('data:')) {
                            const blob = base64ToBlob2(src);
                            if (blob) selectedFiles.push(new File([blob], `ref${idx}.png`, { type: blob.type }));
                        }
                    });
                    renderPreviews();
                }
            }).catch(() => {});
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
            currentGalleryData = [];
            if (localFS.isActive()) localFS.saveJSON('gallery.json', []).catch(() => {});
            else idb.set('nanscript_current_gallery', []);
            $('imageGallery').innerHTML = '';
            $('resultArea').style.display = 'none';
            $('emptyState').style.display = 'block';
            showToast('画廊已清空');
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

// ========== 移动端适配逻辑 ==========
(function initMobile() {
    const isMobile = () => window.innerWidth <= 768;

    // ---------- 面板切换 ----------
    const panels = {
        left:   document.querySelector('aside.left-panel'),
        center: document.querySelector('section.center-panel'),
        right:  document.querySelector('aside.right-panel'),
    };

    function switchPanel(target) {
        if (!isMobile()) return;
        Object.entries(panels).forEach(([key, el]) => {
            if (!el) return;
            el.classList.toggle('panel-active', key === target);
        });
        // 更新 TabBar 激活状态（排除 tab-generate 按钮）
        document.querySelectorAll('.tab-btn[data-panel]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.panel === target);
        });
    }

    // 初始化：移动端默认显示左侧参数面板
    function initPanelState() {
        if (isMobile()) {
            switchPanel('left');
        } else {
            // 桌面端清除 panel-active，让 CSS 中的桌面样式生效
            Object.values(panels).forEach(el => {
                if (el) el.classList.remove('panel-active');
            });
        }
    }

    // 监听 TabBar 点击
    document.querySelectorAll('.tab-btn[data-panel]').forEach(btn => {
        btn.addEventListener('click', () => switchPanel(btn.dataset.panel));
    });

    // 窗口 resize 时重置面板状态
    window.addEventListener('resize', initPanelState);
    initPanelState();

    // ---------- 生成完成后自动跳转画廊（移动端） ----------
    // 劫持 showToast：当成功生成图像时，切换到画廊面板
    const _origShowToast = window.showToast || showToast;
    // 监听 runBtn 状态变化（GenerateGeneration 执行完毕后会还原按钮文字）
    const runBtnEl = document.getElementById('runBtn');
    if (runBtnEl) {
        const runObserver = new MutationObserver(() => {
            // 按钮恢复"开始创造"说明生成完毕
            if (isMobile() && runBtnEl.textContent.includes('开始创造')) {
                // 只有在结果区有内容时才跳
                const resultArea = document.getElementById('resultArea');
                if (resultArea && resultArea.style.display !== 'none') {
                    setTimeout(() => switchPanel('center'), 300);
                }
            }
        });
        runObserver.observe(runBtnEl, { childList: true, subtree: true });
    }

    // ---------- Lightbox 双指触摸缩放 ----------
    const lb = document.getElementById('lightbox');
    const lbImg = document.getElementById('lightboxImg');
    if (!lb || !lbImg) return;

    let touchStartDist = 0;
    let touchStartScale = 1;
    let lbScale = 1;
    let lbX = 0, lbY = 0;
    let touchStartX = 0, touchStartY = 0;
    let touchStartLbX = 0, touchStartLbY = 0;
    let isDraggingTouch = false;

    const clamp = (v, mn, mx) => Math.max(mn, Math.min(mx, v));

    function applyLbTransform() {
        lbImg.style.transform = `translate(${lbX}px, ${lbY}px) scale(${lbScale})`;
        lbImg.style.transformOrigin = 'center center';
        lbImg.style.transition = 'none';
    }

    function resetLbTransform() {
        lbScale = 1; lbX = 0; lbY = 0;
        lbImg.style.transform = '';
        lbImg.style.transition = '';
    }

    function getDist(t) {
        const dx = t[0].clientX - t[1].clientX;
        const dy = t[0].clientY - t[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    lb.addEventListener('touchstart', e => {
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
    }, { passive: false });

    lb.addEventListener('touchmove', e => {
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
    }, { passive: false });

    lb.addEventListener('touchend', e => {
        if (e.touches.length === 0 && !isDraggingTouch && lbScale === 1) {
            // 单指单击关闭（未拖拽、未缩放）
            lb.style.display = 'none';
            resetLbTransform();
        }
        isDraggingTouch = false;
    });

    // lightbox 打开时重置 transform
    const lbObserver = new MutationObserver(() => {
        if (lb.style.display === 'none') resetLbTransform();
    });
    lbObserver.observe(lb, { attributes: true, attributeFilter: ['style'] });
})();
