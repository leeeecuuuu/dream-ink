/**
 * app-state.js — 集中状态管理
 *
 * 将散落在 app.js 全局作用域中的可变状态集中管理，
 * 方便各模块共享读写，也便于未来引入响应式框架。
 */

import { safeParse, ls } from '../utils/helpers.js';
import { GEMINI_31_FLASH_SIZE_TABLE, GEMINI_3_PRO_SIZE_TABLE, GEMINI_25_FLASH_SIZE_TABLE, getSupportedRatios, getSupportedSizes } from './model-capabilities.js';

/** 引擎预设配置（Provider Defaults） */
export const PROVIDER_DEFAULTS = {
  gemini: {
    label: 'Banana · Gemini',
    model: 'gemini-3.1-flash-image',
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
  },
};

/**
 * Gemini 子模型定义
 *
 * 尺寸数据来自 model-capabilities.js（官方文档唯一可信来源）。
 * UI 和 generator.js 请求层共用同一份表，
 * 确保用户看到的尺寸 = 实际请求尺寸 = 官方支持尺寸。
 *
 * 参考: https://ai.google.dev/gemini-api/docs/image-generation
 */
export const GEMINI_MODELS = {
  'nano-banana-2': {
    key: 'nano-banana-2',
    name: 'Nano Banana 2',
    modelName: 'gemini-3.1-flash-image',
    sub: 'Gemini 3.1 Flash Image',
    badge: '推荐',
    sizes: getSupportedSizes('nano-banana-2'),
    ratios: getSupportedRatios('nano-banana-2'),
    sizeTable: GEMINI_31_FLASH_SIZE_TABLE,
    maxDimension: 3840,
    description: '高效图像生成，支持 0.5K-4K 分辨率，14 种画幅比例',
  },
  'nano-banana-pro': {
    key: 'nano-banana-pro',
    name: 'Nano Banana Pro',
    modelName: 'gemini-3-pro-image',
    sub: 'Gemini 3 Pro Image',
    badge: '专业',
    sizes: getSupportedSizes('nano-banana-pro'),
    ratios: getSupportedRatios('nano-banana-pro'),
    sizeTable: GEMINI_3_PRO_SIZE_TABLE,
    maxDimension: 3840,
    description: '专业级资产生成，Thinking 驱动复杂指令和高清文字渲染',
  },
  'nano-banana': {
    key: 'nano-banana',
    name: 'Nano Banana',
    modelName: 'gemini-2.5-flash-image',
    sub: 'Gemini 2.5 Flash Image',
    badge: '极速',
    sizes: getSupportedSizes('nano-banana'),
    ratios: getSupportedRatios('nano-banana'),
    sizeTable: GEMINI_25_FLASH_SIZE_TABLE,
    maxDimension: 1536,
    description: '高速低延迟，固定 1K 输出，仅支持官方 10 种画幅尺寸',
  },
};

/**
 * 全局应用状态
 * 所有模块通过导入此对象来读写共享状态
 */
export const state = {
  /** 是否正在生成图片 */
  isGenerating: false,

  /** 用户选择的垫图文件列表 */
  selectedFiles: [],

  /** 垫图对应的蒙版（PNG data URL 字符串数组，与 selectedFiles 下标对齐） */
  selectedMasks: [],

  /** 垫图用途标注（subject/style/composition，与 selectedFiles 下标对齐） */
  selectedRefRoles: [],

  /** 咒语书数据 */
  promptLib: [],

  /** 历史记录数据 */
  historyData: [],

  /** 当前选中的咒语书文件夹索引 */
  curFolder: 0,

  /** API 配置预设列表 */
  apiProfiles: safeParse('nanscript_api_profiles', '[]'),

  /** 咒语书待上传缩略图 */
  pendingThumb: null,

  /** 当前画廊数据（含图片 src） */
  currentGalleryData: [],

  /** 用于终止正在进行的生成请求 */
  abortCtrl: null,

  /** 当前激活的引擎：'gemini' | 'openai' */
  currentEngine: ls('nanscript_currentEngine') || 'gemini',

  /** 当前选中的 Gemini 子模型 key */
  geminiModelKey: ls('nanscript_geminiModelKey') || 'nano-banana-2',

  /** 当前 Gemini 选中的分辨率标签 */
  geminiActiveSize: ls('nanscript_geminiActiveSize') || '1K',

  /** Gemini 自定义尺寸模式 */
  geminiUseCustom: ls('nanscript_geminiUseCustom') === 'true',

  /** Gemini 自定义宽度 */
  geminiCustomWidth: Number(ls('nanscript_geminiCustomWidth')) || 1024,

  /** Gemini 自定义高度 */
  geminiCustomHeight: Number(ls('nanscript_geminiCustomHeight')) || 1024,

  /** 历史详情弹窗当前索引 */
  currentHistoryIdx: -1,

  /** 历史详情弹窗当前模式：'history' | 'library' */
  currentDetailMode: 'history',
};
