/**
 * webdav.js — 坚果云 WebDAV 云存储模块
 *
 * 通过 WebDAV 协议将历史记录、咒语书、配置等数据
 * 同步到坚果云（或任何支持 WebDAV 的云盘）。
 *
 * 安全注意：
 *  - WebDAV 凭据存储在 localStorage 中（仅限本地）
 *  - 坚果云需要使用「应用密码」而非账户密码
 *  - 所有请求通过 HTTPS 加密传输
 *
 * 同步策略：
 *  - 仅同步元数据 JSON（历史记录、咒语书、配置）
 *  - 不同步图片二进制（避免云盘空间浪费和请求超时）
 *  - 支持手动触发同步（上传 / 下载）
 */

import { $, ls } from '../utils/helpers.js';
import { normalizeApiConfig, setApiConfig } from '../api/api-config.js';
import { el, icon } from '../utils/dom.js';
import { idb } from './idb.js';
import { state } from '../state/app-state.js';
import { showToast } from '../ui/toast.js';

/** WebDAV 同步文件清单 */
const SYNC_FILES = [
  { key: 'history', filename: 'dreamink_history.json', getLocal: () => state.historyData },
  { key: 'library', filename: 'dreamink_library.json', getLocal: () => state.promptLib },
  {
    key: 'config',
    filename: 'dreamink_config.json',
    getLocal: () => ({
      geminiBaseUrl: $('geminiBaseUrl')?.value || '',
      geminiApiKey: $('geminiApiKey')?.value || '',
      openaiBaseUrl: $('openaiBaseUrl')?.value || '',
      openaiApiKey: $('openaiApiKey')?.value || '',
      modelGemini: $('modelGemini')?.value || '',
      modelOpenai: $('modelOpenai')?.value || '',
      customModelsGemini: $('customModelsGemini')?.value || '',
      customModelsOpenai: $('customModelsOpenai')?.value || '',
      bananaApiFormat: $('bananaApiFormat')?.value || 'gemini',
      gptApiFormat: $('gptApiFormat')?.value || 'images',
      moderationSelect: $('moderationSelect')?.value || 'auto',
      apiProfiles: Array.isArray(state.apiProfiles) ? state.apiProfiles : [],
      currentEngine: ls('nanscript_currentEngine') || 'gemini',
    }),
  },
];

/** WebDAV 云存储管理器 */
export const webdav = {
  /** @returns {string} WebDAV 服务器地址 */
  get url() { return ls('nanscript_webdav_url') || ''; },
  /** @returns {string} 用户名 */
  get user() { return ls('nanscript_webdav_user') || ''; },
  /** @returns {string} 密码/应用密码 */
  get pass() { return ls('nanscript_webdav_pass') || ''; },
  /** @returns {string} CORS 代理地址 */
  get proxy() { return ls('nanscript_webdav_proxy') || ''; },

  /** 是否已配置 WebDAV 连接 */
  isConfigured() {
    return !!(this.url && this.user && this.pass);
  },

  /**
   * 构建 WebDAV 请求头（Basic Auth）
   * @returns {Object} HTTP 请求头
   * @private
   */
  _headers(targetUrl = null) {
    const headers = {
      Authorization: 'Basic ' + btoa(unescape(encodeURIComponent(`${this.user}:${this.pass}`))),
    };
    if (this.proxy && targetUrl) {
      headers['X-Target-Url'] = targetUrl;
    }
    return headers;
  },

  /**
   * 构建完整的文件 URL
   * @param {string} filename - 文件名
   * @returns {string}
   * @private
   */
  _fileUrl(filename) {
    const base = this.url.replace(/\/+$/, '');
    const targetUrl = `${base}/DreamInk/${filename}`;
    if (this.proxy) {
      return { url: this.proxy, targetUrl };
    }
    return { url: targetUrl, targetUrl: null };
  },

  /**
   * 确保远端 DreamInk 目录存在（MKCOL）
   * @private
   */
  async _ensureDir() {
    const dirUrl = this.url.replace(/\/+$/, '') + '/DreamInk/';
    const fetchUrl = this.proxy ? this.proxy : dirUrl;
    try {
      await fetch(fetchUrl, {
        method: 'MKCOL',
        headers: this._headers(dirUrl),
      });
    } catch {
      // 目录可能已存在，忽略 405/409 错误
    }
  },

  /**
   * 上传单个文件到 WebDAV
   * @param {string} filename - 文件名
   * @param {*} data - 可序列化数据
   * @returns {Promise<boolean>}
   */
  async uploadFile(filename, data) {
    const { url, targetUrl } = this._fileUrl(filename);
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        ...this._headers(targetUrl),
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(data, null, 2),
    });
    if (!res.ok && res.status !== 201 && res.status !== 204) {
      throw new Error(`WebDAV PUT 失败: ${res.status} ${res.statusText}`);
    }
    return true;
  },

  /**
   * 从 WebDAV 下载单个文件
   * @param {string} filename - 文件名
   * @returns {Promise<*>} 解析后的 JSON 数据，不存在时返回 null
   */
  async downloadFile(filename) {
    const { url, targetUrl } = this._fileUrl(filename);
    const res = await fetch(url, {
      method: 'GET',
      headers: this._headers(targetUrl),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`WebDAV GET 失败: ${res.status}`);
    return await res.json();
  },

  /**
   * 测试 WebDAV 连接
   * @returns {Promise<{ok: boolean, message: string}>}
   */
  async testConnection() {
    try {
      const targetUrl = this.url.replace(/\/+$/, '') + '/';
      const fetchUrl = this.proxy ? this.proxy : targetUrl;
      const res = await fetch(fetchUrl, {
        method: 'PROPFIND',
        headers: {
          ...this._headers(targetUrl),
          Depth: '0',
          'Content-Type': 'application/xml',
        },
        body: '<?xml version="1.0" encoding="utf-8"?><propfind xmlns="DAV:"><prop><resourcetype/></prop></propfind>'
      });
      if (res.ok || res.status === 207) {
        return { ok: true, message: '连接成功 ✅' };
      }
      return { ok: false, message: `连接失败: HTTP ${res.status}` };
    } catch (e) {
      if (e.message.includes('Failed to fetch')) {
        return { ok: false, message: '连接失败: 可能是跨域(CORS)拦截，请配置 CORS 代理' };
      }
      return { ok: false, message: `连接失败: ${e.message}` };
    }
  },

  /**
   * 上传所有同步文件到云端
   * @returns {Promise<{success: number, failed: number}>}
   */
  async uploadAll() {
    if (!this.isConfigured()) throw new Error('WebDAV 未配置');
    await this._ensureDir();

    let success = 0, failed = 0;
    for (const sf of SYNC_FILES) {
      try {
        const data = sf.getLocal();
        await this.uploadFile(sf.filename, data);
        success++;
      } catch (e) {
        console.error(`上传 ${sf.filename} 失败:`, e);
        failed++;
      }
    }
    return { success, failed };
  },

  /**
   * 从云端下载所有同步文件并合并到本地
   * @param {Object} callbacks - 回调函数集合
   * @param {Function} callbacks.renderHistory - 渲染历史记录
   * @param {Function} callbacks.renderFolders - 渲染咒语书
   * @param {Function} callbacks.syncModelInput - 同步模型输入
   * @param {Function} callbacks.updatePreview - 更新预览
   * @returns {Promise<{success: number, failed: number, skipped: number}>}
   */
  async downloadAll(callbacks = {}) {
    if (!this.isConfigured()) throw new Error('WebDAV 未配置');

    let success = 0, failed = 0, skipped = 0;

    // 下载历史记录
    try {
      const remote = await this.downloadFile('dreamink_history.json');
      if (remote && Array.isArray(remote)) {
        // 合并：以 id 为 key，远端优先
        const merged = new Map(state.historyData.map(i => [i.id, i]));
        remote.forEach(i => merged.set(i.id, i));
        state.historyData = [...merged.values()]
          .sort((a, b) => (b.id || '').localeCompare(a.id || ''))
          .slice(0, 200);
        idb.set('nanscript_history_db', state.historyData);
        if (callbacks.renderHistory) callbacks.renderHistory();
        success++;
      } else skipped++;
    } catch (e) {
      console.error('下载历史记录失败:', e);
      failed++;
    }

    // 下载咒语书
    try {
      const remote = await this.downloadFile('dreamink_library.json');
      if (remote && Array.isArray(remote)) {
        // 合并：按 folderName 合并文件夹
        const localMap = new Map(state.promptLib.map(f => [f.folderName, f]));
        remote.forEach(rf => {
          if (localMap.has(rf.folderName)) {
            // 合并提示词（按 name+content 去重）
            const existing = localMap.get(rf.folderName);
            const existingKeys = new Set(existing.prompts.map(p => `${p.name}|${p.content}`));
            rf.prompts.forEach(p => {
              if (!existingKeys.has(`${p.name}|${p.content}`)) {
                existing.prompts.push(p);
              }
            });
          } else {
            localMap.set(rf.folderName, rf);
          }
        });
        state.promptLib = [...localMap.values()];
        idb.set('nanscript_prompt_lib', state.promptLib);
        if (callbacks.renderFolders) callbacks.renderFolders();
        success++;
      } else skipped++;
    } catch (e) {
      console.error('下载咒语书失败:', e);
      failed++;
    }

    // 下载配置
    try {
      const remote = await this.downloadFile('dreamink_config.json');
      if (remote) {
        setApiConfig('gemini', normalizeApiConfig(remote, 'gemini'));
        setApiConfig('openai', normalizeApiConfig(remote, 'openai'));
        if (remote.modelGemini && $('modelGemini')) { $('modelGemini').value = remote.modelGemini; ls('nanscript_modelGemini', remote.modelGemini); }
        if (remote.modelOpenai && $('modelOpenai')) { $('modelOpenai').value = remote.modelOpenai; ls('nanscript_modelOpenai', remote.modelOpenai); }
        if (Object.prototype.hasOwnProperty.call(remote, 'customModelsGemini') && $('customModelsGemini')) { $('customModelsGemini').value = remote.customModelsGemini; ls('nanscript_customModelsGemini', remote.customModelsGemini); }
        if (Object.prototype.hasOwnProperty.call(remote, 'customModelsOpenai') && $('customModelsOpenai')) { $('customModelsOpenai').value = remote.customModelsOpenai; ls('nanscript_customModelsOpenai', remote.customModelsOpenai); }
        if (Object.prototype.hasOwnProperty.call(remote, 'bananaApiFormat') && $('bananaApiFormat')) { $('bananaApiFormat').value = remote.bananaApiFormat; ls('nanscript_bananaApiFormat', remote.bananaApiFormat); }
        if (Object.prototype.hasOwnProperty.call(remote, 'gptApiFormat') && $('gptApiFormat')) { $('gptApiFormat').value = remote.gptApiFormat; ls('nanscript_gptApiFormat', remote.gptApiFormat); }
        if (Object.prototype.hasOwnProperty.call(remote, 'moderationSelect') && $('moderationSelect')) { $('moderationSelect').value = remote.moderationSelect; ls('nanscript_moderationSelect', remote.moderationSelect); }
        if (Array.isArray(remote.apiProfiles)) { state.apiProfiles = remote.apiProfiles; ls('nanscript_api_profiles', JSON.stringify(remote.apiProfiles)); }
        if (remote.currentEngine) ls('nanscript_currentEngine', remote.currentEngine);
        if (callbacks.syncModelInput) callbacks.syncModelInput();
        if (callbacks.updatePreview) callbacks.updatePreview();
        success++;
      } else skipped++;
    } catch (e) {
      console.error('下载配置失败:', e);
      failed++;
    }

    return { success, failed, skipped };
  },

  /**
   * 保存 WebDAV 凭据
   * @param {string} url - WebDAV 地址
   * @param {string} user - 用户名
   * @param {string} pass - 密码
   */
  saveCredentials(url, user, pass, proxy = '') {
    ls('nanscript_webdav_url', url);
    ls('nanscript_webdav_user', user);
    ls('nanscript_webdav_pass', pass);
    ls('nanscript_webdav_proxy', proxy);
  },

  /**
   * 清除 WebDAV 凭据
   */
  clearCredentials() {
    localStorage.removeItem('nanscript_webdav_url');
    localStorage.removeItem('nanscript_webdav_user');
    localStorage.removeItem('nanscript_webdav_pass');
    localStorage.removeItem('nanscript_webdav_proxy');
  },
};
