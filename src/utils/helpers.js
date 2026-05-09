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

// ========== 图片压缩 ==========
export const IMAGE_COMPRESSION_DEFAULTS = {
  /** 参考图最长边限制：兼顾清晰度与请求体大小 */
  maxDimension: 2048,
  /** 最大像素量约等于 2048x2048 */
  maxPixels: 4_194_304,
  /** 单张目标体积，超过时逐步降质量/尺寸 */
  targetBytes: 2 * 1024 * 1024,
  initialQuality: 0.94,
  minQuality: 0.82,
  mimeType: 'image/jpeg',
};

const canvasToBlob = (canvas, mimeType, quality) =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('图片压缩失败'))),
      mimeType,
      quality,
    );
  });

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片加载失败，无法压缩'));
    img.src = src;
  });

const fileExtFromMime = (mimeType = 'image/jpeg') => {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  return 'jpg';
};

const withImageExtension = (name = 'image', mimeType = 'image/jpeg') => {
  const ext = fileExtFromMime(mimeType);
  const base = String(name || 'image').replace(/\.[a-z0-9]+$/i, '') || 'image';
  return `${base}.${ext}`;
};

export const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

/**
 * 压缩图片来源（File 或 Data URL），优先保持 2K 级别细节，再逐步压低质量/尺寸。
 * @param {File|string} source
 * @param {Partial<typeof IMAGE_COMPRESSION_DEFAULTS>} options
 * @returns {Promise<{blob: Blob, file: File|null, dataUrl: string, width: number, height: number, originalBytes: number, compressedBytes: number, compressed: boolean}>}
 */
export const compressImageSource = async (source, options = {}) => {
  const opts = { ...IMAGE_COMPRESSION_DEFAULTS, ...options };
  const isFile = typeof File !== 'undefined' && source instanceof File;
  if (isFile && !source.type.startsWith('image/')) {
    return {
      blob: source,
      file: source,
      dataUrl: await blobToDataUrl(source),
      width: 0,
      height: 0,
      originalBytes: source.size,
      compressedBytes: source.size,
      compressed: false,
    };
  }

  const originalDataUrl = isFile ? await fileToB64(source) : String(source || '');
  const originalBytes = isFile
    ? source.size
    : Math.ceil(((originalDataUrl.split(',')[1] || '').length * 3) / 4);
  const img = await loadImage(originalDataUrl);
  const originalWidth = img.naturalWidth || img.width;
  const originalHeight = img.naturalHeight || img.height;
  if (!originalWidth || !originalHeight) throw new Error('无法读取图片尺寸');

  const maxSide = Math.max(originalWidth, originalHeight);
  const pixelScale = Math.sqrt(Math.min(1, opts.maxPixels / (originalWidth * originalHeight)));
  const sideScale = Math.min(1, opts.maxDimension / maxSide);
  let scale = Math.min(1, pixelScale, sideScale);
  let width = Math.max(1, Math.round(originalWidth * scale));
  let height = Math.max(1, Math.round(originalHeight * scale));

  const draw = (targetWidth, targetHeight) => {
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d', { alpha: opts.mimeType !== 'image/jpeg' });
    // JPEG 不支持透明通道，使用白底避免透明区域变黑。
    if (opts.mimeType === 'image/jpeg') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, targetWidth, targetHeight);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
    return canvas;
  };

  const shouldTryCompress =
    originalBytes > opts.targetBytes || width !== originalWidth || height !== originalHeight;

  if (!shouldTryCompress) {
    const blob = isFile ? source : base64ToBlob(originalDataUrl);
    return {
      blob,
      file: isFile ? source : null,
      dataUrl: originalDataUrl,
      width: originalWidth,
      height: originalHeight,
      originalBytes,
      compressedBytes: blob?.size || originalBytes,
      compressed: false,
    };
  }

  let bestBlob = null;
  let bestWidth = width;
  let bestHeight = height;
  const qualities = [opts.initialQuality, 0.9, 0.86, opts.minQuality]
    .filter((q, idx, arr) => q >= opts.minQuality && arr.indexOf(q) === idx);

  while (width >= 320 && height >= 320) {
    const canvas = draw(width, height);
    for (const quality of qualities) {
      const blob = await canvasToBlob(canvas, opts.mimeType, quality);
      bestBlob = blob;
      bestWidth = width;
      bestHeight = height;
      if (blob.size <= opts.targetBytes || quality === opts.minQuality) {
        if (blob.size <= opts.targetBytes || width <= 1024 || height <= 1024) {
          width = 0;
        }
        break;
      }
    }
    if (width === 0 || bestBlob.size <= opts.targetBytes) break;
    width = Math.round(width * 0.9);
    height = Math.round(height * 0.9);
  }

  if (!bestBlob) {
    const canvas = draw(width, height);
    bestBlob = await canvasToBlob(canvas, opts.mimeType, opts.minQuality);
    bestWidth = width;
    bestHeight = height;
  }

  const compressedBytes = bestBlob?.size || originalBytes;
  const useOriginal = compressedBytes >= originalBytes && isFile;
  const blob = useOriginal ? source : bestBlob;
  const dataUrl = useOriginal ? originalDataUrl : await blobToDataUrl(blob);
  const file = isFile
    ? useOriginal
      ? source
      : new File([blob], withImageExtension(source.name, opts.mimeType), {
          type: opts.mimeType,
          lastModified: Date.now(),
        })
    : null;

  return {
    blob,
    file,
    dataUrl,
    width: useOriginal ? originalWidth : bestWidth,
    height: useOriginal ? originalHeight : bestHeight,
    originalBytes,
    compressedBytes: blob.size,
    compressed: !useOriginal && (blob.size < originalBytes || bestWidth !== originalWidth || bestHeight !== originalHeight),
  };
};

/** 压缩 File，返回压缩后的 File */
export const compressImageFile = async (file, options = {}) =>
  (await compressImageSource(file, options)).file || file;

/** 压缩 Data URL，返回压缩结果 */
export const compressImageDataUrl = (dataUrl, options = {}) =>
  compressImageSource(dataUrl, options);

/** 将图片 Data URL 缩放到指定尺寸，常用于让重绘蒙版与压缩后的底图尺寸一致 */
export const resizeImageDataUrl = async (dataUrl, width, height, options = {}) => {
  const img = await loadImage(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(options.mimeType || 'image/png', options.quality ?? 1);
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
