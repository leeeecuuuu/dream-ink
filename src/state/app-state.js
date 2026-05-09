/**
 * app-state.js — 集中状态管理
 *
 * 将散落在 app.js 全局作用域中的可变状态集中管理，
 * 方便各模块共享读写，也便于未来引入响应式框架。
 */

import { safeParse, ls } from '../utils/helpers.js';

/** 引擎预设配置（Provider Defaults） */
export const PROVIDER_DEFAULTS = {
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

  /** 历史详情弹窗当前索引 */
  currentHistoryIdx: -1,

  /** 历史详情弹窗当前模式：'history' | 'library' */
  currentDetailMode: 'history',
};
