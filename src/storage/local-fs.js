/**
 * local-fs.js — 本地文件夹存储 (File System Access API)
 *
 * 封装 File System Access API，允许用户绑定本地文件夹，
 * 将生成的图片和配置数据直接写入磁盘，避免占用浏览器缓存。
 *
 * 安全注意：
 *  - 仅在支持 File System Access API 的浏览器中启用（Chrome/Edge 86+）
 *  - 使用能力检测而非屏幕宽度判断
 */

import { $ , ls } from '../utils/helpers.js';
import { idb } from './idb.js';
import { supportsFileSystemAccess } from '../utils/feature-detect.js';

/** 本地文件系统存储管理器 */
export const localFS = {
  /** 当前绑定的目录句柄 */
  handle: null,

  /** 是否支持 File System Access API（能力检测） */
  _supported: supportsFileSystemAccess(),

  /** 是否已绑定文件夹 */
  isActive() {
    return !!this.handle;
  },

  /**
   * 更新 UI 状态（徽章、路径显示、按钮可见性）
   * @private
   */
  _updateUI() {
    const badge = $('localFsBadge');
    const path = $('localFsPath');
    const clearBtn = $('clearFolderBtn');
    const notSup = $('localFsNotSupported');

    if (!this._supported) {
      if (notSup) notSup.classList.remove('hidden');
      return;
    }

    if (this.handle) {
      if (badge) {
        badge.textContent = '✅ 已绑定';
        badge.className =
          'text-[10px] font-bold px-2 py-0.5 rounded-full border bg-success/10 text-success border-success/20';
        badge.classList.remove('hidden');
      }
      if (path) {
        path.textContent = `📁 ${this.handle.name}`;
        path.classList.remove('hidden');
      }
      if (clearBtn) clearBtn.classList.remove('hidden');
    } else {
      if (badge) badge.classList.add('hidden');
      if (path) path.classList.add('hidden');
      if (clearBtn) clearBtn.classList.add('hidden');
    }
  },

  /**
   * 弹出系统文件夹选择器，绑定本地文件夹
   * @param {Function} showToast - Toast 通知回调
   */
  async pick(showToast) {
    if (!this._supported) return;
    try {
      this.handle = await window.showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'pictures',
      });
      await idb.set('nanscript_fs_handle', this.handle);
      this._updateUI();
      // 立即将当前 API 配置写入本地文件夹
      try {
        await this.saveConfig();
      } catch (e) {
        console.error('saveConfig 失败:', e);
      }
      showToast(`✅ 已绑定本地文件夹：${this.handle.name}`);
    } catch (e) {
      if (e.name !== 'AbortError') showToast('选择文件夹失败', 'error');
    }
  },

  /**
   * 尝试恢复之前绑定的文件夹句柄
   * @returns {Promise<boolean>} 是否成功恢复
   */
  async restore() {
    if (!this._supported) return false;
    try {
      const h = await idb.get('nanscript_fs_handle');
      if (!h || typeof h.queryPermission !== 'function') return false;
      const perm = await h.queryPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        this.handle = h;
        this._updateUI();
        return true;
      }
      if (perm === 'prompt') {
        const granted = await h.requestPermission({ mode: 'readwrite' });
        if (granted === 'granted') {
          this.handle = h;
          this._updateUI();
          return true;
        }
      }
    } catch (e) {
      console.warn('localFS.restore:', e);
    }
    return false;
  },

  /**
   * 解除文件夹绑定
   * @param {Function} showToast - Toast 通知回调
   */
  async clear(showToast) {
    this.handle = null;
    await idb.set('nanscript_fs_handle', null);
    this._updateUI();
    showToast('本地文件夹已解除绑定，切换为浏览器存储模式');
  },

  /**
   * 获取或创建子目录句柄
   * @param {'originals'|'thumbs'|'refs'} name - 子目录名
   * @returns {Promise<FileSystemDirectoryHandle>}
   * @private
   */
  async _getSubDir(name) {
    const images = await this.handle.getDirectoryHandle('images', { create: true });
    return await images.getDirectoryHandle(name, { create: true });
  },

  /**
   * 写入图片文件（Base64 → 文件）
   * @param {string} filename - 文件名
   * @param {string} b64Data - Base64 Data URL
   * @param {'originals'|'thumbs'|'refs'} subDir - 子目录
   */
  async saveImage(filename, b64Data, subDir = 'originals') {
    const parts = b64Data.split(',');
    const bstr = atob(parts[1]);
    const u8 = new Uint8Array(bstr.length);
    for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
    const dir = await this._getSubDir(subDir);
    const fh = await dir.getFileHandle(filename, { create: true });
    const w = await fh.createWritable();
    await w.write(u8);
    await w.close();
  },

  /**
   * 获取图片的 Blob URL
   * @param {string} filename - 文件名
   * @param {'originals'|'thumbs'|'refs'} subDir - 子目录
   * @returns {Promise<string>} Blob URL，失败时返回空字符串
   */
  async getImageURL(filename, subDir = 'originals') {
    try {
      const dir = await this._getSubDir(subDir);
      const fh = await dir.getFileHandle(filename);
      return URL.createObjectURL(await fh.getFile());
    } catch {
      return '';
    }
  },

  /**
   * 写入 JSON 文件
   * @param {string} filename - 文件名
   * @param {*} data - 可序列化数据
   */
  async saveJSON(filename, data) {
    const fh = await this.handle.getFileHandle(filename, { create: true });
    const w = await fh.createWritable();
    await w.write(JSON.stringify(data, null, 2));
    await w.close();
  },

  /**
   * 读取 JSON 文件
   * @param {string} filename - 文件名
   * @param {*} fallback - 读取失败时的默认值
   * @returns {Promise<*>}
   */
  async loadJSON(filename, fallback = []) {
    try {
      const fh = await this.handle.getFileHandle(filename);
      const file = await fh.getFile();
      return JSON.parse(await file.text());
    } catch {
      return fallback;
    }
  },

  /**
   * 保存 API 配置到 config.json
   */
  async saveConfig() {
    const cfg = {
      baseUrl: $('baseUrl')?.value || '',
      apiKey: $('apiKey')?.value || '',
      modelGemini: $('modelGemini')?.value || '',
      modelOpenai: $('modelOpenai')?.value || '',
      currentEngine: ls('nanscript_currentEngine') || 'gemini',
    };
    await this.saveJSON('config.json', cfg);
  },

  /**
   * 从 config.json 读取 API 配置并应用到表单
   * @param {Function} syncModelInput - 模型输入同步回调
   * @param {Function} updatePreview - 预览更新回调
   */
  async loadConfig(syncModelInput, updatePreview) {
    const cfg = await this.loadJSON('config.json', null);
    if (!cfg) return;
    if (cfg.baseUrl && $('baseUrl')) {
      $('baseUrl').value = cfg.baseUrl;
      ls('nanscript_baseUrl', cfg.baseUrl);
    }
    if (cfg.apiKey && $('apiKey')) {
      $('apiKey').value = cfg.apiKey;
      ls('nanscript_apiKey', cfg.apiKey);
    }
    if (cfg.modelGemini && $('modelGemini')) {
      $('modelGemini').value = cfg.modelGemini;
      ls('nanscript_modelGemini', cfg.modelGemini);
    }
    if (cfg.modelOpenai && $('modelOpenai')) {
      $('modelOpenai').value = cfg.modelOpenai;
      ls('nanscript_modelOpenai', cfg.modelOpenai);
    }
    if (cfg.currentEngine) ls('nanscript_currentEngine', cfg.currentEngine);
    // 同步 UI
    if (typeof syncModelInput === 'function') syncModelInput();
    if (typeof updatePreview === 'function') updatePreview();
  },
};
