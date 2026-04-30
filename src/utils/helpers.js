/**
 * helpers.js — 通用工具函数
 * 
 * 提供全局共享的纯工具函数，不涉及 DOM 或业务逻辑。
 * 所有函数均为纯函数或轻量 IO 封装。
 */

// ========== DOM 元素快速访问 ==========
/** 通过 id 获取 DOM 元素的快捷方式 */
export const $ = (id) => document.getElementById(id);

// ========== LocalStorage 封装 ==========
/** 安全解析 localStorage 中的 JSON 值，解析失败时返回 fallback */
export const safeParse = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key) || fallback);
  } catch {
    return JSON.parse(fallback);
  }
};

/** 读写 localStorage：传入 value 则写入，否则读取 */
export const ls = (key, value) =>
  value !== undefined
    ? localStorage.setItem(key, value)
    : localStorage.getItem(key);

// ========== 安全处理 ==========
/** HTML 特殊字符转义，防止 XSS */
export const escHtml = (str) =>
  str
    ? String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
    : '';

// ========== 文件 / 数据转换 ==========
/** 将 File 对象转为 Base64 Data URL */
export const fileToB64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

/** 将 URL（含 Blob URL）转为 File 对象 */
export const urlToFile = async (url, name, type) => {
  if (url.startsWith('data:')) {
    return new File([base64ToBlob(url)], name, { type });
  }
  return new File([await (await fetch(url)).blob()], name, { type });
};

/** Base64 Data URL 转 Blob 对象 */
export const base64ToBlob = (b64) => {
  const parts = b64.split(',');
  if (parts.length < 2) return null;
  const mime = parts[0].match(/:(.*?);/)[1] || 'image/png';
  const bstr = atob(parts[1]);
  const u8arr = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
  return new Blob([u8arr], { type: mime });
};

// ========== 错误码映射 ==========
/** 常见 API 错误码 → 用户友好提示 */
export const errMap = {
  '401': 'API Key 无效或已过期',
  '403': 'API Key 无效或已过期',
  '402': '点数不足',
  '429': '请求频率过高，稍后再试',
  '404': '未找到模型',
  '500': '服务器错误',
};
