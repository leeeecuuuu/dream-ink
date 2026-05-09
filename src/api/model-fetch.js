/**
 * model-fetch.js — 模型列表获取模块
 *
 * Banana(Gemini) 与 GPT Image-2(OpenAI) 使用独立的 API 配置、
 * 独立的获取按钮、独立的状态提示和独立的模型下拉框。
 */

import { syncModelInput, updatePreview } from "../ui/engine.js";
import { $, ls } from "../utils/helpers.js";
import { getApiConfig } from "./api-config.js";

const MODEL_FETCH_CONFIG = {
  gemini: {
    label: "Banana",
    buttonId: "fetchGeminiModelsBtn",
    statusId: "modelGeminiStatus",
    selectId: "modelGeminiSelect",
    inputId: "modelGemini",
    customId: "customModelsGemini",
    storageKey: "nanscript_modelGemini",
    emptyConfigMessage: "缺少 Banana API 配置",
    // 只把 Gemini/Banana 模型纳入本引擎下拉与计数，避免第三方 /models 返回全量模型时串到 GPT 区域。
    modelPattern: /^gemini(?:-|$)/i,
    preferredPattern: /^gemini(?:-|$)/i,
  },
  openai: {
    label: "GPT Image-2",
    buttonId: "fetchOpenaiModelsBtn",
    statusId: "modelOpenaiStatus",
    selectId: "modelOpenaiSelect",
    inputId: "modelOpenai",
    customId: "customModelsOpenai",
    storageKey: "nanscript_modelOpenai",
    emptyConfigMessage: "缺少 GPT Image-2 API 配置",
    // GPT Image-2 区域只识别 OpenAI 生图模型前缀，避免把 gemini-* 等其它引擎模型算入数量。
    modelPattern: /^(?:gpt-image(?:-|$)|dall-e(?:-|$))/i,
    preferredPattern: /^gpt-image(?:-|$)/i,
  },
};

const parseCustomModels = (str = "") =>
  str
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const uniqueModels = (models = []) => [...new Set(models.filter(Boolean))];

function normalizeModelName(name = "") {
  return String(name).trim().replace(/^models\//, "");
}

function filterProviderModels(provider, models = []) {
  const pattern = MODEL_FETCH_CONFIG[provider]?.modelPattern;
  const normalized = uniqueModels(models.map(normalizeModelName).filter(Boolean));
  return pattern ? normalized.filter((name) => pattern.test(name)) : normalized;
}

function parseGeminiModelList(data = {}) {
  const googleModels = Array.isArray(data.models) ? data.models : [];
  const openaiModels = Array.isArray(data.data) ? data.data : [];
  return uniqueModels(
    [...googleModels, ...openaiModels]
      .map((m) => normalizeModelName(m.name || m.id || ""))
      .filter(Boolean),
  );
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      data.error?.message || data.message || `HTTP ${res.status}`,
    );
  }
  return data;
}

/**
 * 填充某个引擎自己的 select 下拉框，并同步该引擎自己的 input。
 * @param {'gemini'|'openai'} provider
 * @param {string[]} models
 */
function fillProviderSelect(provider, models) {
  const cfg = MODEL_FETCH_CONFIG[provider];
  const sel = $(cfg.selectId);
  const inp = $(cfg.inputId);
  if (!sel || !inp) return;

  sel.innerHTML = "";
  models.forEach((name) => {
    const o = document.createElement("option");
    o.value = o.textContent = name;
    sel.appendChild(o);
  });

  const curVal = inp.value?.trim();
  const fallback =
    provider === "openai"
      ? "gpt-image-1"
      : "gemini-2.0-flash-preview-image-generation";
  const options = Array.from(sel.options);
  if (curVal && options.some((o) => o.value === curVal)) {
    sel.value = curVal;
  } else {
    const preferred = options.find((o) => cfg.preferredPattern.test(o.value));
    if (preferred) sel.value = preferred.value;
  }

  const selectedVal = (sel.value || "").trim();
  if (selectedVal) {
    inp.value = selectedVal;
    ls(cfg.storageKey, selectedVal);
  } else if (!curVal) {
    inp.value = fallback;
    ls(cfg.storageKey, fallback);
  }
  inp.classList.add("hidden");
  sel.classList.remove("hidden");
  sel.onchange = () => {
    const nextVal = (sel.value || "").trim();
    if (!nextVal) return;
    inp.value = nextVal;
    ls(cfg.storageKey, nextVal);
    syncModelInput();
    updatePreview();
  };
  syncModelInput();
  updatePreview();
}

async function requestProviderModels(provider) {
  const apiCfg = getApiConfig(provider);
  const fetchCfg = MODEL_FETCH_CONFIG[provider];
  const customModels = $(fetchCfg.customId)?.value?.trim();
  if (customModels) return filterProviderModels(provider, parseCustomModels(customModels));

  if (!apiCfg.apiKey || !apiCfg.baseUrl) {
    throw new Error(fetchCfg.emptyConfigMessage);
  }

  if (provider === "gemini") {
    const bananaApiFormat = $("bananaApiFormat")?.value || "openai";
    const useOpenAICompat = bananaApiFormat !== "gemini";
    if (useOpenAICompat) {
      const cleanBase = apiCfg.baseUrl.replace(/\/+$/, "");
      const base = /\/v1$/i.test(cleanBase) ? cleanBase : `${cleanBase}/v1`;
      const data = await fetchJson(`${base}/models`, {
        headers: { Authorization: `Bearer ${apiCfg.apiKey}` },
      });
      return filterProviderModels(
        "gemini",
        (data.data || [])
          .map((m) => m.id || m.name || "")
          .filter(Boolean),
      )
        .sort((a, b) => {
          const aMatch = MODEL_FETCH_CONFIG.gemini.preferredPattern.test(a);
          const bMatch = MODEL_FETCH_CONFIG.gemini.preferredPattern.test(b);
          if (aMatch && !bMatch) return -1;
          if (!aMatch && bMatch) return 1;
          return a.localeCompare(b);
        });
    }

    const cleanBase = apiCfg.baseUrl.replace(/\/+$/, "");
    const hasVersion = /\/v1(?:beta)?$/i.test(cleanBase);
    const preferredBase = hasVersion ? cleanBase : `${cleanBase}/v1beta`;
    const fallbackBase = /\/v1$/i.test(preferredBase)
      ? preferredBase.replace(/\/v1$/i, "/v1beta")
      : "";

    // 兼容两类 Gemini 模型列表接口：
    // 1. Google 原生格式：GET /v1 或 /v1beta/models?key=xxx，返回 { models: [...] }
    // 2. 部分以 /v1 结尾的 Gemini 兼容代理：GET /v1/models + Bearer，返回 { data: [...] }
    const attempts = [
      {
        url: `${preferredBase}/models?key=${encodeURIComponent(apiCfg.apiKey)}`,
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiCfg.apiKey,
        },
      },
      {
        url: `${preferredBase}/models`,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiCfg.apiKey}`,
          "x-goog-api-key": apiCfg.apiKey,
        },
      },
      ...(fallbackBase
        ? [
            {
              url: `${fallbackBase}/models?key=${encodeURIComponent(apiCfg.apiKey)}`,
              headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": apiCfg.apiKey,
              },
            },
          ]
        : []),
    ];

    const errors = [];
    for (const attempt of attempts) {
      try {
        const data = await fetchJson(attempt.url, { headers: attempt.headers });
        const models = filterProviderModels("gemini", parseGeminiModelList(data));
        if (models.length) {
          return models.sort((a, b) => {
            const aMatch = a.toLowerCase().includes("gemini");
            const bMatch = b.toLowerCase().includes("gemini");
            if (aMatch && !bMatch) return -1;
            if (!aMatch && bMatch) return 1;
            return a.localeCompare(b);
          });
        }
        errors.push("未返回可用模型");
      } catch (err) {
        errors.push(err?.message || "请求失败");
      }
    }

    throw new Error(`Gemini 模型获取失败：${errors.at(-1) || "请求失败"}`);
  }

  const cleanBase = apiCfg.baseUrl.replace(/\/+$/, "");
  const base = /\/v1$/i.test(cleanBase) ? cleanBase : `${cleanBase}/v1`;
  const data = await fetchJson(`${base}/models`, {
    headers: { Authorization: `Bearer ${apiCfg.apiKey}` },
  });
  return filterProviderModels(
    "openai",
    (data.data || [])
      .map((m) => m.id || m.name || "")
      .filter(Boolean),
  )
    .sort((a, b) => {
      const aMatch = MODEL_FETCH_CONFIG.openai.preferredPattern.test(a);
      const bMatch = MODEL_FETCH_CONFIG.openai.preferredPattern.test(b);
      if (aMatch && !bMatch) return -1;
      if (!aMatch && bMatch) return 1;
      return a.localeCompare(b);
    });
}

/**
 * 只获取指定引擎的模型列表。
 * @param {'gemini'|'openai'} provider
 */
export async function fetchModels(provider) {
  const cfg = MODEL_FETCH_CONFIG[provider];
  if (!cfg) return;

  const st = $(cfg.statusId);
  const btn = $(cfg.buttonId);
  const input = $(cfg.inputId);
  const select = $(cfg.selectId);

  try {
    btn?.classList.add("loading");
    if (btn) btn.disabled = true;
    if (st) {
      st.className = "text-[10px] text-on-surface-variant";
      st.textContent = `正在获取 ${cfg.label} 模型列表...`;
    }

    const models = await requestProviderModels(provider);
    if (!models.length) throw new Error("未返回可用模型");

    fillProviderSelect(provider, models);
    if (st) {
      st.className = "model-status ok text-[10px]";
      st.textContent = `✅ ${cfg.label}: 已获取 ${models.length} 个模型`;
    }
  } catch (err) {
    input?.classList.remove("hidden");
    select?.classList.add("hidden");
    if (st) {
      st.className = "model-status fail text-[10px]";
      st.textContent = `❌ ${cfg.label}: ${err?.message || "获取失败"}`;
    }
  } finally {
    btn?.classList.remove("loading");
    if (btn) btn.disabled = false;
  }
}

export const fetchGeminiModels = () => fetchModels("gemini");
export const fetchOpenaiModels = () => fetchModels("openai");
