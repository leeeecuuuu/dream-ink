/**
 * model-capabilities.js — Gemini 模型官方尺寸能力表
 *
 * 数据来源：
 *   https://ai.google.dev/gemini-api/docs/image-generation
 *   本地参考: ../../../../gemini生图.md
 *
 * 本文件是所有 Gemini 模型尺寸数据的唯一可信来源。
 * UI 选择器和 generator.js 请求层共用同一份表，
 * 确保用户看到的尺寸 = 实际请求的尺寸 = 官方支持的尺寸。
 */

// ---------------------------------------------------------------------------
// Gemini 3.1 Flash Image (Nano Banana 2)
// 支持 512 / 1K / 2K / 4K，14 种画幅比例
// ---------------------------------------------------------------------------
export const GEMINI_31_FLASH_SIZE_TABLE = Object.freeze({
  '512': Object.freeze({
    '1:1':  '512x512',
    '1:4':  '256x1024',
    '1:8':  '192x1536',
    '2:3':  '424x632',
    '3:2':  '632x424',
    '3:4':  '448x600',
    '4:1':  '1024x256',
    '4:3':  '600x448',
    '4:5':  '464x576',
    '5:4':  '576x464',
    '8:1':  '1536x192',
    '9:16': '384x688',
    '16:9': '688x384',
    '21:9': '792x168',
  }),
  '1K': Object.freeze({
    '1:1':  '1024x1024',
    '1:4':  '512x2048',
    '1:8':  '384x3072',
    '2:3':  '848x1264',
    '3:2':  '1264x848',
    '3:4':  '896x1200',
    '4:1':  '2048x512',
    '4:3':  '1200x896',
    '4:5':  '928x1152',
    '5:4':  '1152x928',
    '8:1':  '3072x384',
    '9:16': '768x1376',
    '16:9': '1376x768',
    '21:9': '1584x672',
  }),
  '2K': Object.freeze({
    '1:1':  '2048x2048',
    '1:4':  '1024x4096',
    '1:8':  '768x6144',
    '2:3':  '1696x2528',
    '3:2':  '2528x1696',
    '3:4':  '1792x2400',
    '4:1':  '4096x1024',
    '4:3':  '2400x1792',
    '4:5':  '1856x2304',
    '5:4':  '2304x1856',
    '8:1':  '6144x768',
    '9:16': '1536x2752',
    '16:9': '2752x1536',
    '21:9': '3168x1344',
  }),
  '4K': Object.freeze({
    '1:1':  '4096x4096',
    '1:4':  '2048x8192',
    '1:8':  '1536x12288',
    '2:3':  '3392x5056',
    '3:2':  '5056x3392',
    '3:4':  '3584x4800',
    '4:1':  '8192x2048',
    '4:3':  '4800x3584',
    '4:5':  '3712x4608',
    '5:4':  '4608x3712',
    '8:1':  '12288x1536',
    '9:16': '3072x5504',
    '16:9': '5504x3072',
    '21:9': '6336x2688',
  }),
});

// ---------------------------------------------------------------------------
// Gemini 3 Pro Image (Nano Banana Pro)
// 支持 1K / 2K / 4K，10 种画幅比例
// ---------------------------------------------------------------------------
export const GEMINI_3_PRO_SIZE_TABLE = Object.freeze({
  '1K': Object.freeze({
    '1:1':  '1024x1024',
    '2:3':  '848x1264',
    '3:2':  '1264x848',
    '3:4':  '896x1200',
    '4:3':  '1200x896',
    '4:5':  '928x1152',
    '5:4':  '1152x928',
    '9:16': '768x1376',
    '16:9': '1376x768',
    '21:9': '1584x672',
  }),
  '2K': Object.freeze({
    '1:1':  '2048x2048',
    '2:3':  '1696x2528',
    '3:2':  '2528x1696',
    '3:4':  '1792x2400',
    '4:3':  '2400x1792',
    '4:5':  '1856x2304',
    '5:4':  '2304x1856',
    '9:16': '1536x2752',
    '16:9': '2752x1536',
    '21:9': '3168x1344',
  }),
  '4K': Object.freeze({
    '1:1':  '4096x4096',
    '2:3':  '3392x5056',
    '3:2':  '5056x3392',
    '3:4':  '3584x4800',
    '4:3':  '4800x3584',
    '4:5':  '3712x4608',
    '5:4':  '4608x3712',
    '9:16': '3072x5504',
    '16:9': '5504x3072',
    '21:9': '6336x2688',
  }),
});

// ---------------------------------------------------------------------------
// Gemini 2.5 Flash Image (Nano Banana)
// 固定 1K 输出，10 种画幅比例（使用官方文档精确尺寸）
// ---------------------------------------------------------------------------
export const GEMINI_25_FLASH_SIZE_TABLE = Object.freeze({
  '1K': Object.freeze({
    '1:1':  '1024x1024',
    '2:3':  '832x1248',
    '3:2':  '1248x832',
    '3:4':  '864x1184',
    '4:3':  '1184x864',
    '4:5':  '896x1152',
    '5:4':  '1152x896',
    '9:16': '768x1344',
    '16:9': '1344x768',
    '21:9': '1536x672',
  }),
});

// ===========================================================================
// 工具函数
// ===========================================================================

/**
 * 解析 "WxH" 字符串为 {width, height}
 * @param {string} pixelSize - "1024x768"
 * @returns {{width: number, height: number}|null}
 */
export function parsePixelSize(pixelSize) {
  const match = String(pixelSize || '').trim().match(/^(\d+)x(\d+)$/i);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!width || !height) return null;
  return { width, height };
}

/**
 * 根据模型 key 获取对应的官方尺寸表
 * @param {string} modelKey - 'nano-banana-2' | 'nano-banana-pro' | 'nano-banana'
 * @returns {object} sizeTable 或 null
 */
export function getSizeTable(modelKey) {
  switch (modelKey) {
    case 'nano-banana-2':    return GEMINI_31_FLASH_SIZE_TABLE;
    case 'nano-banana-pro':  return GEMINI_3_PRO_SIZE_TABLE;
    case 'nano-banana':      return GEMINI_25_FLASH_SIZE_TABLE;
    default:                 return null;
  }
}

/**
 * 查询模型在指定分辨率和比例下的官方像素尺寸
 * @param {string} modelKey - Gemini 子模型 key
 * @param {string} sizeLabel - '512' | '1K' | '2K' | '4K'
 * @param {string} ratio - '16:9' | '1:1' | ...
 * @returns {string} 如 '1376x768'，找不到时返回 null
 */
export function lookupPixelSize(modelKey, sizeLabel, ratio) {
  const table = getSizeTable(modelKey);
  if (!table) return null;
  const sizeRow = table[sizeLabel];
  if (!sizeRow) return null;
  return sizeRow[ratio] || null;
}

/**
 * 获取模型所有支持的画幅比例列表
 * @param {string} modelKey
 * @returns {string[]}
 */
export function getSupportedRatios(modelKey) {
  const table = getSizeTable(modelKey);
  if (!table) return [];
  // 取第一个分辨率行的 keys 作为比例列表
  const firstSize = Object.keys(table)[0];
  return firstSize ? Object.keys(table[firstSize]) : [];
}

/**
 * 获取模型所有支持的分辨率标签
 * @param {string} modelKey
 * @returns {string[]}
 */
export function getSupportedSizes(modelKey) {
  const table = getSizeTable(modelKey);
  if (!table) return [];
  return Object.keys(table);
}

/**
 * 将 "1K" / "2K" / "4K" / "512" 转为长边像素基准值
 * @param {string} sizeLabel
 * @returns {number}
 */
export function sizeLabelToK(sizeLabel) {
  switch (sizeLabel) {
    case '512': return 512;
    case '1K':  return 1024;
    case '2K':  return 2048;
    case '4K':  return 4096;
    default:    return 1024;
  }
}

/**
 * 获取模型的最大尺寸约束（用于自定义尺寸）
 * @param {string} modelKey
 * @returns {{ maxDimension: number, step: number }}
 */
export function getModelConstraints(modelKey) {
  switch (modelKey) {
    case 'nano-banana':
      return { maxDimension: 1536, step: 1 };
    case 'nano-banana-2':
    case 'nano-banana-pro':
    default:
      return { maxDimension: 3840, step: 64 };
  }
}

/**
 * 最大公约数（用于比例化简）
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
export function gcd(a, b) {
  if (!b) return Math.abs(Number(a) || 0);
  return gcd(b, a % b);
}
