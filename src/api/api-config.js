/**
 * api-config.js — 双引擎 API 配置辅助函数
 *
 * Banana(Gemini) 与 GPT Image-2(OpenAI) 使用独立的 Base URL / API Key。
 * 为兼容旧版本，读取新字段为空时会回退到旧的 nanscript_baseUrl / nanscript_apiKey。
 */

import { $, ls } from "../utils/helpers.js";

export const API_PROVIDERS = ["gemini", "openai"];

export const API_CONFIG_FIELD_IDS = [
  "geminiBaseUrl",
  "geminiApiKey",
  "openaiBaseUrl",
  "openaiApiKey",
];

const FIELD_MAP = {
  gemini: {
    baseUrl: "geminiBaseUrl",
    apiKey: "geminiApiKey",
  },
  openai: {
    baseUrl: "openaiBaseUrl",
    apiKey: "openaiApiKey",
  },
};

const LEGACY_KEYS = {
  baseUrl: "nanscript_baseUrl",
  apiKey: "nanscript_apiKey",
};

/**
 * 获取指定引擎的 API 配置。
 * @param {'gemini'|'openai'} provider
 * @returns {{baseUrl: string, apiKey: string}}
 */
export function getApiConfig(provider) {
  const fields = FIELD_MAP[provider] || FIELD_MAP.gemini;
  const baseUrl =
    $(fields.baseUrl)?.value?.trim() || ls(`nanscript_${fields.baseUrl}`) || "";
  const apiKey =
    $(fields.apiKey)?.value?.trim() || ls(`nanscript_${fields.apiKey}`) || "";
  return {
    baseUrl: baseUrl || ls(LEGACY_KEYS.baseUrl) || "",
    apiKey: apiKey || ls(LEGACY_KEYS.apiKey) || "",
  };
}

/**
 * 应用指定引擎的 API 配置到表单与 localStorage。
 * @param {'gemini'|'openai'} provider
 * @param {{baseUrl?: string, apiKey?: string}} cfg
 */
export function setApiConfig(provider, cfg = {}) {
  const fields = FIELD_MAP[provider] || FIELD_MAP.gemini;
  if (Object.prototype.hasOwnProperty.call(cfg, "baseUrl")) {
    const value = cfg.baseUrl || "";
    if ($(fields.baseUrl)) $(fields.baseUrl).value = value;
    ls(`nanscript_${fields.baseUrl}`, value);
  }
  if (Object.prototype.hasOwnProperty.call(cfg, "apiKey")) {
    const value = cfg.apiKey || "";
    if ($(fields.apiKey)) $(fields.apiKey).value = value;
    ls(`nanscript_${fields.apiKey}`, value);
  }
}

/**
 * 将旧版共享配置迁移到双引擎字段。
 * 仅在对应新字段为空时填充，避免覆盖用户已分别设置的值。
 */
export function migrateLegacyApiConfig() {
  const legacyBaseUrl = ls(LEGACY_KEYS.baseUrl) || "";
  const legacyApiKey = ls(LEGACY_KEYS.apiKey) || "";
  if (!legacyBaseUrl && !legacyApiKey) return;

  API_PROVIDERS.forEach((provider) => {
    const fields = FIELD_MAP[provider];
    const baseElem = $(fields.baseUrl);
    const keyElem = $(fields.apiKey);
    if (legacyBaseUrl && baseElem && !baseElem.value && !ls(`nanscript_${fields.baseUrl}`)) {
      baseElem.value = legacyBaseUrl;
      ls(`nanscript_${fields.baseUrl}`, legacyBaseUrl);
    }
    if (legacyApiKey && keyElem && !keyElem.value && !ls(`nanscript_${fields.apiKey}`)) {
      keyElem.value = legacyApiKey;
      ls(`nanscript_${fields.apiKey}`, legacyApiKey);
    }
  });
}

/**
 * 从配置对象中读取新旧兼容的某个引擎 API 配置。
 * @param {Object} cfg
 * @param {'gemini'|'openai'} provider
 */
export function normalizeApiConfig(cfg = {}, provider) {
  const fields = FIELD_MAP[provider] || FIELD_MAP.gemini;
  return {
    baseUrl: cfg[fields.baseUrl] ?? cfg.baseUrl ?? "",
    apiKey: cfg[fields.apiKey] ?? cfg.apiKey ?? "",
  };
}