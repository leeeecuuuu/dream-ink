/**
 * generator.js — 核心图像生成模块
 *
 * 包含 executeGeneration 主函数，负责：
 * - 构建 API 请求（Gemini / OpenAI）
 * - 管理并发批量生成
 * - 骨架屏占位与计时器
 * - 生成结果写入画廊和历史记录
 *
 * 使用安全 DOM 构建骨架屏占位元素。
 */

import { getApiConfig } from "../api/api-config.js";
import { PROVIDER_DEFAULTS, state } from "../state/app-state.js";
import { idb } from "../storage/idb.js";
import { localFS } from "../storage/local-fs.js";
import { getModel } from "../ui/engine.js";
import { createGalleryItemDOM } from "../ui/gallery.js";
import { renderPreviews } from "../ui/preview.js";
import { saveHistory } from "../ui/history.js";
import { showToast } from "../ui/toast.js";
import { el, icon } from "../utils/dom.js";
import { $, fileToB64, compressImageDataUrl, resizeImageDataUrl, base64ToBlob } from "../utils/helpers.js";

/** 防改写前缀（参考自 gpt-image-playground） */
const PROMPT_REWRITE_GUARD_PREFIX =
  "Use the following text as the complete prompt. Do not rewrite it:";

const BANANA_COMPAT_SIZE_MAP = {
  "1K": {
    "1:1": "1024x1024",
    "16:9": "1024x576",
    "9:16": "576x1024",
    "4:3": "1024x768",
    "3:4": "768x1024",
  },
  "2K": {
    "1:1": "2048x2048",
    "16:9": "1920x1080",
    "9:16": "1080x1920",
    "4:3": "2048x1536",
    "3:4": "1536x2048",
  },
  "4K": {
    "1:1": "3840x3840",
    "16:9": "3840x2160",
    "9:16": "2160x3840",
    "4:3": "3840x2880",
    "3:4": "2880x3840",
  },
};

const QUALITY_IMAGE_SIZE_LABEL = {
  ultra: "4K",
  high: "2K",
  standard: "1K",
};

/** 调试日志开关（默认开启，便于排查 Banana/Gemini 请求问题） */
const GENERATION_DEBUG_ENABLED = true;
const GENERATION_DEBUG_MAX_ENTRIES = 200;

let generationDebugEntries = [];

function formatGenerationDebugEntriesForCopy() {
  if (!generationDebugEntries.length) return "";
  return generationDebugEntries
    .map((entry) => {
      return [
        `#${entry.index} ${entry.time} ${entry.stage}`,
        entry.text || safeSerializeForDebug(entry.payload || {}),
      ].join("\n");
    })
    .join("\n\n---\n\n");
}

async function copyAllGenerationDebugEntries() {
  const text = formatGenerationDebugEntriesForCopy();
  if (!text) {
    showToast("暂无日志可复制", "error");
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    showToast(`已复制 ${generationDebugEntries.length} 条日志 📋`);
  } catch (e) {
    showToast(`复制日志失败: ${e?.message || "浏览器不支持剪贴板"}`, "error");
  }
}

function safeSerializeForDebug(value) {
  const seen = new WeakSet();
  try {
    return JSON.stringify(
      value,
      (_, current) => {
        if (typeof current === "object" && current !== null) {
          if (seen.has(current)) return "[Circular]";
          seen.add(current);
        }
        if (typeof current === "function") {
          return `[Function ${current.name || "anonymous"}]`;
        }
        if (current instanceof Error) {
          return {
            name: current.name,
            message: current.message,
            stack: current.stack,
          };
        }
        return current;
      },
      2,
    );
  } catch (e) {
    return `序列化失败: ${e?.message || e}`;
  }
}

function ensureGenerationDebugPanel() {
  let panel = document.getElementById("generationDebugPanel");
  if (panel) {
    const actions = panel.querySelector("#generationDebugActions");
    if (actions && !panel.querySelector("#generationDebugCopyBtn")) {
      actions.prepend(
        el(
          "button",
          {
            id: "generationDebugCopyBtn",
            type: "button",
            className:
              "px-3 py-1.5 rounded-lg text-xs font-bold border border-outline-variant text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors flex items-center gap-1",
          },
          icon("content_copy", "text-[15px]"),
          "复制全部",
        ),
      );
    }
    const copyBtn = panel.querySelector("#generationDebugCopyBtn");
    if (copyBtn && !copyBtn.dataset.bound) {
      copyBtn.addEventListener("click", copyAllGenerationDebugEntries);
      copyBtn.dataset.bound = "true";
    }
    const clearBtn = panel.querySelector("#generationDebugClearBtn");
    if (clearBtn && !clearBtn.dataset.bound) {
      clearBtn.addEventListener("click", () => {
        generationDebugEntries = [];
        renderGenerationDebugPanel();
      });
      clearBtn.dataset.bound = "true";
    }
    return panel;
  }

  const statusBox = $("statusBox");
  const mountTarget = statusBox?.parentElement;
  if (!mountTarget) return null;

  panel = el(
    "section",
    {
      id: "generationDebugPanel",
      className:
        "hidden mt-4 rounded-2xl border border-outline-variant bg-surface-container shadow-sm overflow-hidden",
    },
    el(
      "div",
      {
        className:
          "flex items-center justify-between gap-3 px-4 py-3 border-b border-outline-variant bg-surface-container-low",
      },
      el(
        "div",
        { className: "min-w-0" },
        el("div", {
          className:
            "text-[11px] font-bold tracking-widest text-primary uppercase",
          textContent: "Generation Debug",
        }),
        el("div", {
          id: "generationDebugSummary",
          className: "text-xs text-on-surface-variant mt-1",
          textContent: "等待生成请求...",
        }),
      ),
      el(
        "div",
        {
          id: "generationDebugActions",
          className: "flex items-center gap-2 shrink-0",
        },
        el(
          "button",
          {
            id: "generationDebugCopyBtn",
            type: "button",
            className:
              "px-3 py-1.5 rounded-lg text-xs font-bold border border-outline-variant text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors flex items-center gap-1",
          },
          icon("content_copy", "text-[15px]"),
          "复制全部",
        ),
        el(
          "button",
          {
            id: "generationDebugClearBtn",
            type: "button",
            className:
              "px-3 py-1.5 rounded-lg text-xs font-bold border border-outline-variant text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors",
          },
          "清空日志",
        ),
      ),
    ),
    el(
      "div",
      {
        id: "generationDebugList",
        className: "max-h-[420px] overflow-auto custom-scrollbar p-3 space-y-2",
      },
      el(
        "div",
        {
          id: "generationDebugEmpty",
          className:
            "rounded-xl border border-dashed border-outline-variant px-4 py-6 text-center text-xs text-on-surface-variant",
        },
        "这里会显示本次生成链路的详细调试日志",
      ),
    ),
  );

  mountTarget.appendChild(panel);

  const copyBtn = panel.querySelector("#generationDebugCopyBtn");
  if (copyBtn) {
    copyBtn.addEventListener("click", copyAllGenerationDebugEntries);
    copyBtn.dataset.bound = "true";
  }

  const clearBtn = panel.querySelector("#generationDebugClearBtn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      generationDebugEntries = [];
      renderGenerationDebugPanel();
    });
    clearBtn.dataset.bound = "true";
  }

  return panel;
}

function renderGenerationDebugPanel() {
  const panel = ensureGenerationDebugPanel();
  if (!panel) return;

  const list = panel.querySelector("#generationDebugList");
  const summary = panel.querySelector("#generationDebugSummary");
  if (!list || !summary) return;

  panel.classList.remove("hidden");
  list.replaceChildren();

  if (!generationDebugEntries.length) {
    list.appendChild(
      el(
        "div",
        {
          id: "generationDebugEmpty",
          className:
            "rounded-xl border border-dashed border-outline-variant px-4 py-6 text-center text-xs text-on-surface-variant",
        },
        "暂无日志，触发一次生成后会显示详细调试信息",
      ),
    );
    summary.textContent = "暂无日志";
    return;
  }

  const latest = generationDebugEntries[generationDebugEntries.length - 1];
  summary.textContent = `共 ${generationDebugEntries.length} 条日志，最新阶段：${latest.stage}`;

  generationDebugEntries.forEach((entry) => {
    const pre = el("pre", {
      className:
        "mt-2 text-[11px] leading-relaxed whitespace-pre-wrap break-all text-on-surface-variant font-mono",
      textContent: entry.text,
    });

    const item = el(
      "details",
      {
        className:
          "rounded-xl border border-outline-variant bg-surface-container-lowest overflow-hidden",
      },
      el(
        "summary",
        {
          className:
            "list-none cursor-pointer px-3 py-2 flex items-center justify-between gap-3 select-text",
        },
        el(
          "div",
          { className: "min-w-0" },
          el("div", {
            className: "text-xs font-bold text-on-surface break-all",
            textContent: entry.stage,
          }),
          el("div", {
            className: "text-[10px] text-on-surface-variant mt-0.5",
            textContent: entry.time,
          }),
        ),
        el("span", {
          className:
            "text-[10px] font-mono text-primary bg-primary/10 px-2 py-1 rounded-md shrink-0",
          textContent: `#${entry.index}`,
        }),
      ),
      el("div", { className: "px-3 pb-3" }, pre),
    );

    if (entry === latest) item.open = true;
    list.appendChild(item);
  });

  list.scrollTop = list.scrollHeight;
}

function pushGenerationDebugEntry(stage, payload = {}) {
  generationDebugEntries.push({
    index: generationDebugEntries.length + 1,
    stage,
    payload,
    time: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
    text: safeSerializeForDebug(payload),
  });
  if (generationDebugEntries.length > GENERATION_DEBUG_MAX_ENTRIES) {
    generationDebugEntries = generationDebugEntries.slice(
      -GENERATION_DEBUG_MAX_ENTRIES,
    );
    generationDebugEntries.forEach((entry, idx) => {
      entry.index = idx + 1;
    });
  }
  renderGenerationDebugPanel();
}

function resetGenerationDebugEntries() {
  generationDebugEntries = [];
  renderGenerationDebugPanel();
}

function loadImageResolution(src) {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }

    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.naturalWidth || 0,
        height: img.naturalHeight || 0,
      });
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function maskSecret(value = "") {
  const str = String(value || "");
  if (!str) return "";
  if (str.length <= 8) return `${str.slice(0, 2)}***${str.slice(-1)}`;
  return `${str.slice(0, 4)}***${str.slice(-4)}`;
}

function summarizeImageInputs(images = []) {
  return images.map((img, index) => {
    const str = String(img || "");
    const hasDataUrl = str.includes(",");
    const payload = hasDataUrl ? str.split(",")[1] || "" : str;
    return {
      index,
      hasDataUrl,
      payloadLength: payload.length,
      preview: payload ? `${payload.slice(0, 16)}...` : "",
    };
  });
}

async function compressGenerationImageInputs(images = [], masks = []) {
  const compressedImages = [];
  const compressedMasks = Array.isArray(masks) ? [...masks] : [];
  const reports = [];

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    if (!/^data:image\//i.test(String(img || ""))) {
      compressedImages.push(img);
      reports.push({ index: i, skipped: true, reason: "not-data-url" });
      continue;
    }

    try {
      const result = await compressImageDataUrl(img);
      compressedImages.push(result.dataUrl);
      if (compressedMasks[i] && result.compressed) {
        compressedMasks[i] = await resizeImageDataUrl(compressedMasks[i], result.width, result.height);
      }
      reports.push({
        index: i,
        originalBytes: result.originalBytes,
        compressedBytes: result.compressedBytes,
        width: result.width,
        height: result.height,
        compressed: result.compressed,
      });
    } catch (error) {
      compressedImages.push(img);
      reports.push({ index: i, skipped: true, reason: error?.message || String(error) });
    }
  }

  return { images: compressedImages, masks: compressedMasks, reports };
}

function sanitizeUrlForLog(url = "") {
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.has("key")) {
      parsed.searchParams.set("key", maskSecret(parsed.searchParams.get("key")));
    }
    return parsed.toString();
  } catch {
    return String(url || "").replace(/([?&]key=)([^&]+)/i, (_, p1, p2) => {
      return `${p1}${maskSecret(p2)}`;
    });
  }
}

function generationDebug(stage, payload = {}) {
  if (!GENERATION_DEBUG_ENABLED) return;
  console.debug(`[generation-debug] ${stage}`, payload);
  pushGenerationDebugEntry(stage, payload);
}

const GENERATION_DIAGNOSTIC_RULES = [
  {
    code: "missing-api-config",
    title: "API 配置不完整",
    icon: "vpn_key_alert",
    match: ({ message, context }) =>
      !!context.missingConfig || /api key|base url|缺少.*api|api.*缺失|未配置|empty config/i.test(message),
    summary: "当前引擎缺少 API Key 或接口地址，所以请求还没有真正发出。",
    details: [
      "打开 API 配置，检查当前引擎对应的 Base URL 与 API Key。",
      "如果你刚切换过 Banana / GPT Image-2，请确认填的是当前引擎那一组配置。",
    ],
    actions: ["openApiConfig", "copyDebug"],
  },
  {
    code: "request-timeout",
    title: "请求超时或连接被中断",
    icon: "timer_off",
    match: ({ message, error }) =>
      error?.name === "TimeoutError" || /timeout|timed out|超时|deadline|aborted due to timeout/i.test(message),
    summary: "服务端响应太慢，或代理在等待期间断开了连接。",
    details: [
      "先降低质量 / 尺寸后重试，减少生成耗时。",
      "如果连续超时，请稍后重试或更换更稳定的接口节点。",
    ],
    actions: ["lowerQualityRetry", "openApiConfig", "copyDebug"],
  },
  {
    code: "network-proxy",
    title: "网络或代理连接异常",
    icon: "wifi_off",
    match: ({ message }) =>
      /failed to fetch|networkerror|network error|load failed|cors|proxy|代理|econn|enotfound|socket|ssl|certificate|502|503|504|bad gateway|service unavailable|gateway timeout/i.test(message),
    summary: "浏览器没有成功连到接口，常见原因是代理、跨域、证书或网关临时不可用。",
    details: [
      "检查 Base URL 是否能访问，代理/中转服务是否在线。",
      "如果是本地代理，请确认浏览器可以访问该地址且允许跨域请求。",
    ],
    actions: ["openApiConfig", "retry", "copyDebug"],
  },
  {
    code: "model-name",
    title: "模型名称可能不正确",
    icon: "model_training",
    match: ({ message }) =>
      /model|模型|not found|does not exist|not exist|unsupported.*model|invalid.*model|404|permission.*model/i.test(message),
    summary: "接口无法识别或无权访问当前模型名。",
    details: [
      "打开 API 配置，确认模型名与当前接口渠道完全一致。",
      "也可以点击“获取模型”重新选择可用模型。",
    ],
    actions: ["openApiConfig", "copyDebug"],
  },
  {
    code: "image-size",
    title: "图片尺寸或比例不受支持",
    icon: "aspect_ratio",
    match: ({ message }) =>
      /size|image_size|image size|resolution|dimension|aspect|ratio|尺寸|分辨率|比例|must be one of|unsupported.*(size|resolution)|invalid.*(size|resolution)/i.test(message),
    summary: "当前渠道不支持请求的画幅、尺寸或高清参数。",
    details: [
      "先改为标准画质 / 1K，或使用常见比例（1:1、16:9、9:16）再试。",
      "不同中转对 2K / 4K / 自定义尺寸支持差异很大。",
    ],
    actions: ["lowerQualityRetry", "openApiConfig", "copyDebug"],
  },
  {
    code: "reference-image-too-large",
    title: "垫图可能过大或数量过多",
    icon: "photo_size_select_large",
    match: ({ message }) =>
      /413|payload too large|request entity too large|content too large|file too large|image too large|too many images|max.*image|input image|垫图|底图|图片过大|文件过大/i.test(message),
    summary: "上传的参考图让请求体过大，或超出了接口的垫图限制。",
    details: [
      "清空垫图后可验证是否由参考图导致。",
      "如果需要垫图，请压缩图片、降低分辨率，或减少垫图数量后再试。",
    ],
    actions: ["clearRefsRetry", "lowerQualityRetry", "copyDebug"],
  },
];

const GENERATION_DIAGNOSTIC_ACTION_META = {
  openApiConfig: { label: "打开 API 配置", iconName: "settings" },
  lowerQualityRetry: { label: "降低质量重试", iconName: "speed" },
  clearRefsRetry: { label: "清空垫图重试", iconName: "layers_clear" },
  retry: { label: "直接重试", iconName: "refresh" },
  copyDebug: { label: "复制调试日志", iconName: "content_copy" },
};

function getProviderDisplayName(apiType = "gemini") {
  return apiType === "openai" ? "GPT Image-2" : "Banana · Gemini";
}

function getLatestGenerationDebugPayload(stage) {
  for (let i = generationDebugEntries.length - 1; i >= 0; i--) {
    if (generationDebugEntries[i]?.stage === stage) return generationDebugEntries[i].payload || null;
  }
  return null;
}

function diagnoseGenerationFailure(error, context = {}) {
  const message = String(error?.message || error || "未知错误");
  const ruleContext = { message, error, context };
  const matchedRule =
    GENERATION_DIAGNOSTIC_RULES.find((rule) => rule.match(ruleContext)) || {
      code: "unknown",
      title: "生成失败，原因需要进一步确认",
      icon: "troubleshoot",
      summary: "暂时无法自动归类该错误，请结合 Generation Debug 查看请求细节。",
      details: [
        "优先检查 API 配置、模型名、图片尺寸与网络代理。",
        "复制调试日志后可以发给接口服务商或开发者排查。",
      ],
      actions: ["openApiConfig", "lowerQualityRetry", "copyDebug"],
    };

  const requestContext = getLatestGenerationDebugPayload("execute:request-context") || {};
  const inputContext = getLatestGenerationDebugPayload("execute:inputs-ready") || {};

  return {
    ...matchedRule,
    providerName: getProviderDisplayName(context.apiType || requestContext.apiType),
    originalMessage: message,
    requestContext,
    inputContext,
  };
}

function openApiConfigFromDiagnostic(apiType) {
  const modal = $("apiConfigModal");
  if (modal) modal.style.display = "flex";

  const fieldId =
    apiType === "openai"
      ? $("openaiApiKey")?.value
        ? "modelOpenai"
        : "openaiApiKey"
      : $("geminiApiKey")?.value
        ? "modelGemini"
        : "geminiApiKey";
  const field = $(fieldId);
  setTimeout(() => {
    field?.focus?.();
    field?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  }, 80);
}

function lowerGenerationQuality() {
  const qualitySelect = $("qualitySelect");
  if (qualitySelect) {
    qualitySelect.value = "standard";
    qualitySelect.dispatchEvent(new Event("change", { bubbles: true }));
  }

  const bananaImageSize = $("bananaImageSize");
  if (bananaImageSize) {
    bananaImageSize.value = "1K";
    bananaImageSize.dispatchEvent(new Event("change", { bubbles: true }));
  }

  const ratioSelect = $("ratioSelect");
  if (ratioSelect && ratioSelect.value === "custom") {
    ratioSelect.value = "1024x1024";
    window._updateRatioUI?.();
    ratioSelect.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

function clearReferenceImages() {
  state.selectedFiles = [];
  state.selectedMasks = [];
  const imageInput = $("imageInput");
  if (imageInput) imageInput.value = "";
  renderPreviews();
}

function handleGenerationDiagnosticAction(action, diagnostic, retryCustom = {}) {
  switch (action) {
    case "openApiConfig":
      openApiConfigFromDiagnostic(diagnostic.requestContext?.apiType || retryCustom.apiType || $("apiTypeSelect")?.value || "gemini");
      break;
    case "lowerQualityRetry":
      lowerGenerationQuality();
      showToast("已切换为标准/1K，准备重试...");
      setTimeout(() => executeGeneration(retryCustom), 120);
      break;
    case "clearRefsRetry":
      clearReferenceImages();
      showToast("已清空垫图，准备重试...");
      setTimeout(() => executeGeneration(retryCustom), 120);
      break;
    case "retry":
      setTimeout(() => executeGeneration(retryCustom), 120);
      break;
    case "copyDebug":
      copyAllGenerationDebugEntries();
      break;
    default:
      break;
  }
}

function ensureGenerationDiagnosticPanel() {
  let panel = document.getElementById("generationDiagnosticPanel");
  if (panel) return panel;

  const statusBox = $("statusBox");
  const mountTarget = statusBox?.parentElement;
  if (!mountTarget) return null;

  panel = el("section", {
    id: "generationDiagnosticPanel",
    className:
      "hidden mt-4 rounded-2xl border border-error/30 bg-error/5 shadow-sm overflow-hidden",
  });

  const debugPanel = document.getElementById("generationDebugPanel");
  if (debugPanel?.parentElement === mountTarget) {
    mountTarget.insertBefore(panel, debugPanel);
  } else {
    mountTarget.appendChild(panel);
  }

  return panel;
}

function renderGenerationDiagnosticPanel(error, context = {}, retryCustom = {}) {
  const panel = ensureGenerationDiagnosticPanel();
  if (!panel) return null;

  const diagnostic = diagnoseGenerationFailure(error, context);
  const actionButtons = diagnostic.actions.map((action) => {
    const meta = GENERATION_DIAGNOSTIC_ACTION_META[action];
    if (!meta) return null;
    return el(
      "button",
      {
        type: "button",
        className:
          action === "copyDebug"
            ? "px-3 py-1.5 rounded-lg text-xs font-bold border border-outline-variant text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors flex items-center gap-1"
            : "px-3 py-1.5 rounded-lg text-xs font-bold bg-error/10 text-error hover:bg-error/20 border border-error/20 transition-colors flex items-center gap-1",
        onclick: () => handleGenerationDiagnosticAction(action, diagnostic, retryCustom),
      },
      icon(meta.iconName, "text-[15px]"),
      meta.label,
    );
  }).filter(Boolean);

  const contextItems = [
    diagnostic.providerName ? `引擎：${diagnostic.providerName}` : "",
    diagnostic.requestContext?.finalModel ? `模型：${diagnostic.requestContext.finalModel}` : "",
    diagnostic.requestContext?.ratio ? `尺寸：${diagnostic.requestContext.ratio}` : "",
    diagnostic.requestContext?.quality ? `质量：${diagnostic.requestContext.quality}` : "",
    Number.isFinite(diagnostic.inputContext?.imageCount) ? `垫图：${diagnostic.inputContext.imageCount} 张` : "",
  ].filter(Boolean);

  panel.replaceChildren(
    el(
      "div",
      {
        className:
          "flex items-start gap-3 px-4 py-3 border-b border-error/20 bg-error/10",
      },
      icon(diagnostic.icon, "text-error text-[22px] shrink-0 mt-0.5"),
      el(
        "div",
        { className: "min-w-0 flex-1" },
        el("div", {
          className: "text-sm font-bold text-error",
          textContent: diagnostic.title,
        }),
        el("div", {
          className: "text-xs text-on-surface-variant mt-1 leading-relaxed",
          textContent: diagnostic.summary,
        }),
      ),
    ),
    el(
      "div",
      { className: "p-4 space-y-3" },
      contextItems.length
        ? el("div", {
            className: "text-[10px] text-on-surface-variant leading-relaxed",
            textContent: contextItems.join(" · "),
          })
        : null,
      el(
        "ul",
        { className: "space-y-1.5" },
        ...diagnostic.details.map((detail) =>
          el(
            "li",
            { className: "flex gap-2 text-xs text-on-surface-variant leading-relaxed" },
            icon("check_circle", "text-success text-[14px] shrink-0 mt-0.5"),
            el("span", { textContent: detail }),
          ),
        ),
      ),
      el("div", {
        className:
          "rounded-xl border border-outline-variant/70 bg-surface-container-lowest px-3 py-2 text-[11px] text-on-surface-variant break-all font-mono",
        textContent: `原始错误：${diagnostic.originalMessage}`,
      }),
      el("div", { className: "flex flex-wrap gap-2" }, ...actionButtons),
    ),
  );

  panel.classList.remove("hidden");
  panel.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
  return diagnostic;
}

function hideGenerationDiagnosticPanel() {
  const panel = document.getElementById("generationDiagnosticPanel");
  if (panel) panel.classList.add("hidden");
}

function mapBananaCompatSize(aspectRatio = "1:1", imageSize = "1K") {
  const normalizedRatio = String(aspectRatio || "1:1").trim() || "1:1";
  const normalizedImageSize = String(imageSize || "1K").trim().toUpperCase() || "1K";

  if (/^\d+x\d+$/i.test(normalizedRatio)) return normalizedRatio;

  const resolvedSizeMap = BANANA_COMPAT_SIZE_MAP[normalizedImageSize] || BANANA_COMPAT_SIZE_MAP["1K"];
  return resolvedSizeMap[normalizedRatio] || resolvedSizeMap["1:1"];
}

function normalizeBananaImageSize(imageSize = "1K") {
  const normalized = String(imageSize || "1K").trim().toUpperCase();
  return ["1K", "2K", "4K"].includes(normalized) ? normalized : "1K";
}

function appendIfPresent(target, key, value) {
  if (value !== undefined && value !== null && value !== "") {
    target.append(key, value);
  }
}

function createImageConfig(aspectRatio, imageSize) {
  return { aspectRatio, imageSize };
}

function applyCompatImageConfig(target, { size, imageSize, aspectRatio }, options = {}) {
  if (!size) return;

  const imageConfig = createImageConfig(aspectRatio, imageSize);
  const generationConfig = { imageConfig };

  if (options.formData) {
    appendIfPresent(target, "image_size", size);
    appendIfPresent(target, "imageSize", imageSize);
    appendIfPresent(target, "aspect_ratio", aspectRatio);
    appendIfPresent(target, "imageConfig", JSON.stringify(imageConfig));
    appendIfPresent(target, "generationConfig", JSON.stringify(generationConfig));
    return;
  }

  target.size = size;
  target.image_size = size;
  target.imageSize = imageSize;
  target.aspect_ratio = aspectRatio;
  target.imageConfig = imageConfig;
  target.generationConfig = generationConfig;
  target.config = {
    responseModalities: ["TEXT", "IMAGE"],
    imageConfig,
  };
}

function imageDataToBlob(imageData, fallbackMimeType = "image/png") {
  const raw = String(imageData || "");
  const dataUrl = raw.includes(",") ? raw : `data:${fallbackMimeType};base64,${raw}`;
  return base64ToBlob(dataUrl);
}

function isGptImageModel(model = "") {
  return /^gpt-image(?:-|$)/i.test(String(model || "").trim());
}

function normalizeOpenAIImageQuality(quality = "standard", model = "") {
  const normalized = String(quality || "standard").trim().toLowerCase();
  // OpenAI 官方 gpt-image-1 Images/Responses 参数为 auto/low/medium/high。
  // UI 中的 standard/high/ultra 映射为官方可接受值，避免把 ultra 直接发给官方接口导致 400。
  if (isGptImageModel(model)) {
    if (normalized === "ultra" || normalized === "high" || normalized === "hd") return "high";
    if (normalized === "low") return "low";
    if (normalized === "auto") return "auto";
    return "medium";
  }
  // DALL·E 3 仍常用 standard/hd；其它代理保持用户原值以兼容。
  if (/^dall-e-3$/i.test(String(model || "").trim())) {
    return normalized === "ultra" || normalized === "high" ? "hd" : "standard";
  }
  return quality;
}

function mapOpenAIImageSize(size = "1024x1024", model = "") {
  const raw = String(size || "").trim().toLowerCase();
  if (raw === "auto") return "auto";
  const match = raw.match(/^(\d+)x(\d+)$/i);
  if (!match) return raw || "1024x1024";
  const width = Number(match[1]);
  const height = Number(match[2]);

  if (isGptImageModel(model)) {
    // OpenAI 官方 gpt-image-1 支持 auto、1024x1024、1536x1024、1024x1536。
    if (width === height) return "1024x1024";
    return width > height ? "1536x1024" : "1024x1536";
  }
  if (/^dall-e-3$/i.test(String(model || "").trim())) {
    if (width === height) return "1024x1024";
    return width > height ? "1792x1024" : "1024x1792";
  }
  return `${width}x${height}`;
}

/**
 * 执行图像生成
 * @param {Object} custom - 自定义参数覆盖
 */
export async function executeGeneration(custom = {}) {
  // 如果正在生成，点击则终止
  if (state.isGenerating) {
    if (state.abortCtrl) {
      state.abortCtrl.abort();
      showToast("已终止生成");
    }
    return;
  }

  const apiType = $("apiTypeSelect")?.value || "gemini";
  resetGenerationDebugEntries();
  hideGenerationDiagnosticPanel();
  const { apiKey: key, baseUrl: base } = getApiConfig(apiType);
  generationDebug("execute:start", {
    apiType,
    base,
    baseMasked: sanitizeUrlForLog(base),
    apiKeyMasked: maskSecret(key),
    currentEngine: state.currentEngine,
    customKeys: Object.keys(custom || {}),
    selectedFileCount: state.selectedFiles.length,
    selectedMaskCount: state.selectedMasks.length,
  });
  if (!key || !base) {
    const providerName =
      apiType === "openai" ? "GPT Image-2" : "Banana · Gemini";
    const missingConfigMessage = `${providerName} 的 API Key 或 Base URL 缺失`;
    const missingConfigError = new Error(missingConfigMessage);
    generationDebug("execute:missing-config", {
      providerName,
      hasKey: !!key,
      hasBase: !!base,
      apiKeyMasked: maskSecret(key),
      baseMasked: sanitizeUrlForLog(base),
    });
    if (custom._queueTaskId) {
      updateQueueTask(custom._queueTaskId, {
        status: "failed",
        error: diagnoseGenerationFailure(missingConfigError, { apiType, missingConfig: true }).title,
        endedAt: Date.now(),
      });
      if (activeQueueTask?.id === custom._queueTaskId) activeQueueTask = null;
      setTimeout(processNextQueueTask, 0);
    }
    const diagnostic = renderGenerationDiagnosticPanel(
      missingConfigError,
      { apiType, missingConfig: true },
      custom,
    );
    return showToast(diagnostic?.title || missingConfigMessage, "error");
  }

  state.isGenerating = true;
  state.abortCtrl = new AbortController();
  const signal = state.abortCtrl.signal;

  const count = Math.max(
    1,
    Math.min(parseInt(custom.batchCount || $("batchSelect").value) || 1, 20),
  );
  const t0 = Date.now();
  let generationSucceeded = false;
  let generationFailure = null;
  if (custom._queueTaskId) {
    updateQueueTask(custom._queueTaskId, {
      status: "running",
      startedAt: t0,
      error: "",
    });
  }
  const btn = $("runBtn");
  const status = $("statusBox");
  const results = $("resultArea");
  const empty = $("emptyState");

  // 更新按钮状态（安全 DOM）
  btn.replaceChildren(icon("sync"), " 创造中... (点击终止)");
  status.className =
    "text-center mt-4 text-xs font-medium text-primary h-4 loading-dots";
  status.textContent = "神笔正在与绘画之神通讯...";
  status.style.display = "block";
  empty.style.display = "none";
  results.style.display = "block";

  const textSec = $("textResultSection");
  if (textSec) textSec.style.display = "none";

  const gallery = $("imageGallery");

  // 安全创建骨架屏占位元素（使用 createElement 替代 innerHTML）
  const placeholders = [];
  for (let i = 0; i < count; i++) {
    const timerLabel = el("span", {
      className:
        "text-[11px] font-bold text-primary tracking-widest uppercase placeholder-timer",
      textContent: "正在生成... 0s",
    });

    const placeholder = el(
      "div",
      {
        className:
          "masonry-item relative rounded-xl overflow-hidden bg-surface-container border border-outline-variant flex items-center justify-center min-h-[300px] shadow-sm animate-pulse",
      },
      el("div", {
        className:
          "absolute inset-0 bg-gradient-to-tr from-primary/5 to-transparent",
      }),
      el(
        "div",
        {
          className:
            "flex flex-col items-center justify-center gap-3 relative z-10",
        },
        icon("sync", "text-4xl text-primary animate-spin"),
        timerLabel,
      ),
    );

    gallery.prepend(placeholder);
    placeholders.push(placeholder);
  }

  // 计时器
  let _timerSec = 0;
  const _timerInterval = setInterval(() => {
    _timerSec++;
    // 安全更新状态文本
    status.textContent = "";
    status.appendChild(document.createTextNode("神笔正在与绘画之神通讯…  "));
    const timeSpan = el("span", {
      className: "font-mono font-bold text-primary",
      textContent: `${_timerSec}s`,
    });
    status.appendChild(timeSpan);

    placeholders.forEach((p) => {
      const lbl = p.querySelector(".placeholder-timer");
      if (lbl) lbl.textContent = `正在生成... ${_timerSec}s`;
    });
  }, 1000);

  try {
    let imgs = custom.imageDatas || [];
    if (!custom.imageDatas && state.selectedFiles.length) {
      imgs = await Promise.all(state.selectedFiles.map(fileToB64));
    }
    const compressedInput = await compressGenerationImageInputs(imgs, state.selectedMasks || []);
    imgs = compressedInput.images;
    const requestMasks = compressedInput.masks;

    const prompt = custom.prompt ?? $("promptInput").value;
    generationDebug("execute:inputs-ready", {
      promptLength: (prompt || "").length,
      hasPrompt: !!prompt?.trim(),
      imageCount: imgs.length,
      imageSummaries: summarizeImageInputs(imgs),
      compressionReports: compressedInput.reports,
    });
    if (!imgs.length && !prompt.trim())
      throw new Error("请输入提示词或提供底图");

    const ratioSelectVal = $("ratioSelect")?.value || "1024x1024";
    let ratio = custom.aspectRatio || ratioSelectVal;
    if (ratioSelectVal === "custom") {
      const w = $("customWidth").value.trim() || "1024";
      const h = $("customHeight").value.trim() || "1024";
      ratio = `${w}x${h}`;
    }
    if (!ratio) ratio = "1024x1024";

    if (ratio.includes("x")) {
      let [w, h] = ratio.split("x").map(Number);
      if (w && h) {
        if (w > 3840 || h > 3840) {
          const max = Math.max(w, h);
          w = Math.round((w / max) * 3840);
          h = Math.round((h / max) * 3840);
        }
        while (w * h > 8294400) {
          w = Math.round(w * 0.95);
          h = Math.round(h * 0.95);
        }
        while (w * h < 655360 && w < 3840 && h < 3840) {
          w = Math.round(w * 1.05);
          h = Math.round(h * 1.05);
        }
        if (w / h > 3) w = h * 3;
        if (h / w > 3) h = w * 3;
        w = Math.max(16, Math.round(w / 16) * 16);
        h = Math.max(16, Math.round(h / 16) * 16);
        ratio = `${w}x${h}`;
      }
    }

    // 重要：模型读取必须与本次请求 provider(apiType) 对齐，
    // 避免 state.currentEngine 与 apiTypeSelect 短暂不同步导致空模型或串引擎。
    const providerKey = apiType === "openai" ? "openai" : "gemini";
    const providerInputId =
      providerKey === "openai" ? "modelOpenai" : "modelGemini";
    const fallbackModel = PROVIDER_DEFAULTS[providerKey].model;
    const providerInputVal = $(providerInputId)?.value?.trim() || "";
    const currentEngineModel = getModel();

    let model =
      typeof custom.model === "string" && custom.model.trim()
        ? custom.model.trim()
        : providerInputVal || currentEngineModel;

    generationDebug("model:resolved-before-fallback", {
      apiType,
      providerKey,
      providerInputId,
      currentEngine: state.currentEngine,
      customModel: custom.model,
      providerInputVal,
      currentEngineModel,
      fallbackModel,
      resolvedModel: model,
    });

    if (!model || !model.trim()) {
      model = fallbackModel;
      const modelInputEl = $(providerInputId);
      if (modelInputEl) modelInputEl.value = model;
      localStorage.setItem(`nanscript_${providerInputId}`, model);
      generationDebug("model:fallback-applied", {
        providerKey,
        providerInputId,
        fallbackModel,
      });
    }
    if (!model || !model.trim()) {
      generationDebug("model:empty-after-fallback", {
        providerKey,
        providerInputId,
        fallbackModel,
        providerInputVal,
        currentEngineModel,
      });
      throw new Error(
        `模型名称为空（provider=${providerKey}, field=${providerInputId}），请先在 API 配置中设置模型`,
      );
    }
    const finalModel = model.trim();
    const quality = custom.quality || $("qualitySelect")?.value || "standard";
    const outputFormat = $("outputFormat")?.value || "png";
    const bgStyle = $("bgStyle")?.value || "";
    const bananaAspectRatio = $("bananaAspectRatio")?.value || "1:1";
    const bananaImageSize = $("bananaImageSize")?.value || "1K";
    const bananaResponseModalities =
      $("bananaResponseModalities")?.value || "TEXT_IMAGE";
    const bananaEnableGoogleSearch = !!$("bananaEnableGoogleSearch")?.checked;
    const bananaApiFormat = $("bananaApiFormat")?.value || "gemini";
    // Banana 只是产品/模型分组名。
    // gemini-3-pro-image-preview 等高清图模型应优先走 Gemini 原生 generateContent，
    // 这样 imageConfig.imageSize 才会按 1K/2K/4K 枚举值生效。
    const resolvedRequestFormat =
      apiType === "openai"
        ? "openai-compatible"
        : bananaApiFormat === "gemini"
          ? "gemini-native"
          : "openai-compatible";
    const useOpenAICompat = resolvedRequestFormat === "openai-compatible";
    const gptApiFormat = $("gptApiFormat")?.value || "images";
    // Gemini/Banana 走 OpenAI 兼容时，默认应优先使用 /chat/completions。
    // GPT Image-2 仍保持既有配置，继续复用 gptApiFormat。
    const compatFormatSource = apiType === "gemini" ? "gemini-default" : "gptApiFormat";
    const compatFormat = apiType === "gemini" ? "chat" : gptApiFormat;
    const compatEndpoint =
      compatFormat === "chat"
        ? "/chat/completions"
        : compatFormat === "responses"
          ? "/responses"
          : imgs.length
            ? "/images/edits"
            : "/images/generations";
    const mimeType =
      outputFormat === "jpeg"
        ? "image/jpeg"
        : outputFormat === "webp"
          ? "image/webp"
          : "image/png";

    const enhance = {
      high:
        ", high details, clear, native 4k, 3840x2160 resolution, sharp focus, crisp edges, high detail texture",
      ultra:
        ", masterpiece, best quality, ultra detailed, native 4k, 3840x2160 resolution, extremely sharp focus, high detail texture, no downscaling, crisp edges, cinematic lighting",
    };
    const basePrompt =
      (prompt || "Generate an image") + (enhance[quality] || "");
    // 防改写：仅对 OpenAI 格式生效
    const rewriteGuardEnabled =
      useOpenAICompat && $("rewriteGuardToggle")?.checked;
    const finalPrompt = rewriteGuardEnabled
      ? `${PROMPT_REWRITE_GUARD_PREFIX}\n${basePrompt}`
      : basePrompt;
    const bananaCompatAspectRatio = custom.aspectRatio || bananaAspectRatio;
    const bananaCompatImageSize = normalizeBananaImageSize(custom.imageSize || bananaImageSize);
    const mappedBananaCompatSize = mapBananaCompatSize(
      bananaCompatAspectRatio,
      bananaCompatImageSize,
    );

    generationDebug("execute:request-context", {
      apiType,
      providerKey,
      currentEngine: state.currentEngine,
      finalModel,
      ratio,
      quality,
      outputFormat,
      bgStyle,
      bananaApiFormat,
      resolvedRequestFormat,
      bananaAspectRatio,
      bananaImageSize,
      bananaCompatAspectRatio,
      bananaCompatImageSize,
      mappedBananaCompatSize,
      bananaResponseModalities,
      bananaEnableGoogleSearch,
      compatFormat,
      compatFormatSource,
      compatEndpoint: useOpenAICompat ? compatEndpoint : "gemini-native",
      modelInBody: useOpenAICompat,
      modelInPath: !useOpenAICompat,
      useOpenAICompat,
      rewriteGuardEnabled,
      finalPromptLength: finalPrompt.length,
      batchCount: count,
    });

    /**
     * 单次生成请求
     * @returns {Promise<{text: string, image: string}>}
     */
    const genOne = async (_, pIdx) => {
      if (useOpenAICompat) {
        // ===== OpenAI 兼容请求 =====
        const cleanBase = base.replace(/\/+$/, "");
        const baseUrlForOpenAI = /\/v1$/i.test(cleanBase)
          ? cleanBase
          : `${cleanBase}/v1`;

        let fetchOptions = {
          method: "POST",
          headers: { Authorization: `Bearer ${key}` },
          signal,
        };

        let url;
        const rawOpenAIRequestedSize = apiType === "gemini" ? mappedBananaCompatSize : ratio;
        const openaiSize =
          apiType === "gemini" ? mappedBananaCompatSize : mapOpenAIImageSize(ratio, finalModel);
        const openaiImageSizeLabel =
          apiType === "gemini"
            ? bananaCompatImageSize
            : QUALITY_IMAGE_SIZE_LABEL[quality] || QUALITY_IMAGE_SIZE_LABEL.standard;
        const openaiAspectRatioLabel =
          apiType === "gemini" ? bananaCompatAspectRatio : ratio;
        const compatImageConfig = {
          size: openaiSize,
          imageSize: openaiImageSizeLabel,
          aspectRatio: openaiAspectRatioLabel,
        };
        const openaiQuality =
          apiType === "openai" ? normalizeOpenAIImageQuality(quality, finalModel) : quality;
        const useOfficialGptImageParams = apiType === "openai" && isGptImageModel(finalModel);
        const moderation = $("moderationSelect")?.value || "auto";
        generationDebug("openai:prepare-request", {
          urlBase: sanitizeUrlForLog(baseUrlForOpenAI),
          apiType,
          resolvedRequestFormat,
          compatFormat,
          compatFormatSource,
          compatEndpoint,
          finalModel,
          imageCount: imgs.length,
          moderation,
          ratio,
          bananaAspectRatio,
          bananaImageSize,
          mappedBananaCompatSize,
          rawOpenAIRequestedSize,
          openaiSize,
          openaiImageSizeLabel,
          openaiAspectRatioLabel,
          openaiQuality,
          useOfficialGptImageParams,
          openaiSizeSource: apiType === "gemini" ? "banana-image-config-map" : "ratio",
          modelInBody: true,
          modelInPath: false,
        });

        if (compatFormat === "chat") {
          // ===== Chat Completions 模式 =====
          url = `${baseUrlForOpenAI}${compatEndpoint}`;

          const contentParts = [];
          if (imgs.length) {
            imgs.forEach((img) => {
              const imgData = img.includes(",")
                ? img
                : `data:image/png;base64,${img}`;
              contentParts.push({
                type: "image_url",
                image_url: { url: imgData },
              });
            });
          }
          contentParts.push({ type: "text", text: finalPrompt });

          const reqBody = {
            model: finalModel,
            messages: [{ role: "user", content: contentParts }],
          };
          if (openaiSize && openaiSize !== "") {
            // 不同 OpenAI 兼容中转对 Chat 出图的高清参数支持并不一致：
            // - size: OpenAI 风格
            // - image_size: 常见 oneapi / 聚合模型风格
            // - imageSize / imageConfig / generationConfig / config: Gemini/Banana 风格
            // 同时传递这些非冲突字段，可恢复部分渠道历史版本的 2K/4K 出图能力。
            applyCompatImageConfig(reqBody, compatImageConfig);
          }
          if (openaiQuality) reqBody.quality = openaiQuality;
          if (outputFormat) reqBody.output_format = outputFormat;
          if (bgStyle) reqBody.background = bgStyle;
          if (moderation !== "auto") reqBody.moderation = moderation;

          generationDebug("openai:chat-request-body-summary", {
            model: finalModel,
            size: reqBody.size,
            image_size: reqBody.image_size,
            imageSize: reqBody.imageSize,
            aspect_ratio: reqBody.aspect_ratio,
            imageConfig: reqBody.imageConfig,
            quality: reqBody.quality,
            output_format: reqBody.output_format,
            background: reqBody.background,
            generationConfig: reqBody.generationConfig,
            config: reqBody.config,
            contentPartTypes: contentParts.map((part) => part.type),
          });

          fetchOptions.headers["Content-Type"] = "application/json";
          fetchOptions.body = JSON.stringify(reqBody);
        } else if (compatFormat === "responses") {
          // ===== Responses API 模式 =====
          // 官方 Responses API 通过 image_generation tool 出图：
          // POST /v1/responses { model, input, tools: [{ type: "image_generation", ... }] }
          // 返回通常位于 output[].type === "image_generation_call" 的 result 字段。
          url = `${baseUrlForOpenAI}${compatEndpoint}`;

          const contentParts = [];
          if (imgs.length) {
            imgs.forEach((img) => {
              const imgData = img.includes(",")
                ? img
                : `data:image/png;base64,${img}`;
              contentParts.push({
                type: "input_image",
                image_url: imgData,
              });
            });
          }
          contentParts.push({ type: "input_text", text: finalPrompt });

          const imageGenerationTool = { type: "image_generation" };
          if (openaiSize && openaiSize !== "") imageGenerationTool.size = openaiSize;
          if (openaiQuality) imageGenerationTool.quality = openaiQuality;
          if (outputFormat) imageGenerationTool.output_format = outputFormat;
          if (bgStyle) imageGenerationTool.background = bgStyle;
          if (moderation !== "auto") imageGenerationTool.moderation = moderation;

          const reqBody = {
            model: finalModel,
            input: [{ role: "user", content: contentParts }],
            tools: [imageGenerationTool],
          };
          if (apiType === "gemini") {
            applyCompatImageConfig(reqBody, compatImageConfig);
          }

          generationDebug("openai:responses-request-body-summary", {
            model: finalModel,
            imageGenerationTool,
            image_size: reqBody.image_size,
            imageSize: reqBody.imageSize,
            aspect_ratio: reqBody.aspect_ratio,
            imageConfig: reqBody.imageConfig,
            inputContentPartTypes: contentParts.map((part) => part.type),
          });

          fetchOptions.headers["Content-Type"] = "application/json";
          fetchOptions.body = JSON.stringify(reqBody);
        } else {
          // ===== Images API 模式（默认） =====
          url = `${baseUrlForOpenAI}${compatEndpoint}`;

          if (imgs.length) {
            const fd = new FormData();
            fd.append("model", finalModel);
            fd.append("prompt", finalPrompt);
            if (!useOfficialGptImageParams) fd.append("response_format", "b64_json");
            if (openaiSize && openaiSize !== "") fd.append("size", openaiSize);
            if (apiType === "gemini") {
              applyCompatImageConfig(fd, compatImageConfig, { formData: true });
            }
            if (openaiQuality) fd.append("quality", openaiQuality);
            if (outputFormat) fd.append("output_format", outputFormat);
            if (bgStyle) fd.append("background", bgStyle);
            if (moderation !== "auto") fd.append("moderation", moderation);

            imgs.forEach((img, i) => {
              fd.append("image", imageDataToBlob(img), `image${i}.png`);
              if (requestMasks && requestMasks[i]) {
                fd.append(
                  "mask",
                  imageDataToBlob(requestMasks[i]),
                  `mask${i}.png`,
                );
              }
            });
            fetchOptions.body = fd;
          } else {
            const reqBody = {
              model: finalModel,
              prompt: finalPrompt,
            };
            if (!useOfficialGptImageParams) reqBody.response_format = "b64_json";
            if (openaiSize && openaiSize !== "") reqBody.size = openaiSize;
            if (apiType === "gemini") {
              applyCompatImageConfig(reqBody, compatImageConfig);
            }
            if (openaiQuality) reqBody.quality = openaiQuality;
            if (outputFormat) reqBody.output_format = outputFormat;
            if (bgStyle) reqBody.background = bgStyle;
            if (moderation !== "auto") reqBody.moderation = moderation;
            fetchOptions.headers["Content-Type"] = "application/json";
            fetchOptions.body = JSON.stringify(reqBody);
          }
        }

        const res = await fetch(url, fetchOptions);
        generationDebug("openai:response-meta", {
          url: sanitizeUrlForLog(url),
          ok: res.ok,
          status: res.status,
          statusText: res.statusText,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          generationDebug("openai:response-error", {
            url: sanitizeUrlForLog(url),
            status: res.status,
            error: data.error?.message || data.message || null,
            bodyKeys: Object.keys(data || {}),
          });
          throw new Error(
            data.error?.message || data.message || `API Error: ${res.status}`,
          );
        }

        let src = "";

        const data = await res.json().catch(() => ({}));
        const summarizeValue = (value, depth = 0) => {
          if (value == null) return value;
          if (depth >= 3) {
            if (Array.isArray(value)) return `[array:${value.length}]`;
            if (typeof value === "object") return `[object:${Object.keys(value).length}]`;
            return value;
          }
          if (Array.isArray(value)) {
            return value.slice(0, 4).map((item) => summarizeValue(item, depth + 1));
          }
          if (typeof value === "object") {
            return Object.fromEntries(
              Object.entries(value)
                .slice(0, 12)
                .map(([k, v]) => [k, summarizeValue(v, depth + 1)]),
            );
          }
          if (typeof value === "string") {
            return value.length > 300 ? `${value.slice(0, 300)}…` : value;
          }
          return value;
        };

        const isLikelyImageUrl = (candidate) => {
          if (!candidate || typeof candidate !== "string") return false;
          const trimmed = candidate.trim();
          if (/^data:image\//i.test(trimmed)) return true;
          let path = trimmed;
          try {
            path = new URL(trimmed, base).pathname;
          } catch {
            path = trimmed.split(/[?#]/)[0];
          }
          return (
            /\.(png|jpe?g|webp|gif|avif|bmp|svg)$/i.test(path) ||
            /\/(image|images|img|file|files|download|asset|assets)(\/|$)/i.test(path)
          );
        };

        const extractImageSrcFromValue = (value) => {
          if (!value) return "";
          if (typeof value === "string") {
            const trimmed = value.trim();
            if (!trimmed) return "";
            if (/^data:image\//i.test(trimmed)) return trimmed;
            if (/^(https?:\/\/|\/)/i.test(trimmed) && isLikelyImageUrl(trimmed)) return trimmed;
            if (/^[A-Za-z0-9+/=\s]+$/.test(trimmed) && trimmed.replace(/\s+/g, "").length > 128) {
              return `data:${mimeType};base64,${trimmed.replace(/\s+/g, "")}`;
            }
            const mdDataMatch = trimmed.match(/!?\[[^\]]*\]\((data:image\/[^)]+)\)/i);
            if (mdDataMatch) return mdDataMatch[1];
            const mdUrlMatch = trimmed.match(/!?\[[^\]]*\]\((https?:\/\/[^)\s]+|\/[^)\s]+)\)/i);
            if (mdUrlMatch && isLikelyImageUrl(mdUrlMatch[1])) return mdUrlMatch[1];
            const dataUrlMatch = trimmed.match(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/i);
            if (dataUrlMatch) return dataUrlMatch[0];
            const urlMatch = trimmed.match(/(https?:\/\/[^\s)]+|\/[^\s)]+)/);
            if (urlMatch && isLikelyImageUrl(urlMatch[1])) return urlMatch[1];
            return "";
          }
          if (Array.isArray(value)) {
            for (const item of value) {
              const found = extractImageSrcFromValue(item);
              if (found) return found;
            }
            return "";
          }
          if (typeof value === "object") {
            const directCandidates = [
              value.url,
              value.image_url,
              value.imageUrl,
              value.output_url,
              value.result,
              value.b64_json,
              value.base64,
              value.image_base64,
              value.imageBase64,
              value.data,
            ];
            for (const candidate of directCandidates) {
              const found = extractImageSrcFromValue(candidate);
              if (found) return found;
            }
            if (value.inline_data || value.inlineData) {
              const inline = value.inline_data || value.inlineData;
              if (inline?.data) {
                return `data:${inline.mime_type || inline.mimeType || mimeType};base64,${inline.data}`;
              }
            }
            const nestedCandidates = [
              value.image,
              value.file,
              value.content,
              value.parts,
              value.items,
              value.images,
              value.output,
            ];
            for (const candidate of nestedCandidates) {
              const found = extractImageSrcFromValue(candidate);
              if (found) return found;
            }
          }
          return "";
        };

        const firstChoiceMessage = Array.isArray(data?.choices)
          ? data.choices[0]?.message
          : null;
        generationDebug("openai:response-body-summary", {
          url: sanitizeUrlForLog(url),
          compatFormat,
          bodyKeys: Object.keys(data || {}),
          dataPreview: summarizeValue({
            data: data?.data,
            output: data?.output,
            choices: data?.choices,
          }),
          firstChoiceMessagePreview: summarizeValue(firstChoiceMessage),
          schemaHint:
            Array.isArray(data?.choices) && !Array.isArray(data?.data)
              ? "chat-like-response-on-images-endpoint"
              : null,
        });

        const items = Array.isArray(data?.data) ? data.data : [];
        if (items.length) {
          if (items[0].b64_json) {
            src = `data:${mimeType};base64,${items[0].b64_json}`;
          } else if (items[0].url) {
            src = items[0].url;
          }
        }

        if (!src && Array.isArray(data?.output)) {
          const imgOutput = data.output.find(
            (o) => o.type === "image_generation_call" && o.result,
          );
          if (imgOutput) {
            src = imgOutput.result.startsWith("data:")
              ? imgOutput.result
              : `data:${mimeType};base64,${imgOutput.result}`;
          }
        }

        if (!src && firstChoiceMessage) {
          src = extractImageSrcFromValue(firstChoiceMessage);
        }

        if (!src) src = extractImageSrcFromValue(data);

        generationDebug("openai:response-parse-result", {
          url: sanitizeUrlForLog(url),
          compatFormat,
          extracted: !!src,
          srcKind: src
            ? src.startsWith("data:")
              ? "data-url"
              : src.startsWith("http")
                ? "absolute-url"
                : src.startsWith("/")
                  ? "relative-url"
                  : "other"
            : null,
          srcPreview: src && !src.startsWith("data:") ? src.slice(0, 300) : null,
        });

        if (!src) {
          const hint =
            Array.isArray(data?.choices) && !Array.isArray(data?.data)
              ? "当前接口返回 choices（Chat 格式）而不是 data（Images 格式），请尝试把 GPT API 格式切换为 chat，或更换支持 Images API 的渠道。"
              : "";
          throw new Error(
            `API 返回成功但无法从响应中提取图像（已尝试 Images / Responses / Chat 三种格式）。${hint}`,
          );
        }

        if (src && !src.startsWith("data:")) {
          let imageUrl = src;
          try {
            const baseUrlObj = new URL(base);
            if (imageUrl.startsWith("/")) {
              imageUrl = baseUrlObj.origin + imageUrl;
            } else if (!imageUrl.startsWith("http")) {
              imageUrl =
                baseUrlObj.origin +
                (baseUrlObj.pathname.endsWith("/")
                  ? baseUrlObj.pathname
                  : baseUrlObj.pathname + "/") +
                imageUrl;
            } else {
              const srcUrl = new URL(imageUrl);
              if (["127.0.0.1", "localhost", "0.0.0.0"].includes(srcUrl.hostname) && baseUrlObj.hostname !== srcUrl.hostname) {
                srcUrl.protocol = baseUrlObj.protocol;
                srcUrl.hostname = baseUrlObj.hostname;
                srcUrl.port = baseUrlObj.port;
                imageUrl = srcUrl.toString();
              }
            }
          } catch (e) {
            generationDebug("openai:image-url-normalize-error", {
              srcPreview: src.slice(0, 300),
              message: e?.message,
            });
            throw new Error(`API 返回了图片链接，但链接格式无效: ${src.slice(0, 120)}`);
          }

          const imgRes = await fetch(imageUrl, {
            headers: { Authorization: `Bearer ${key}` },
          }).catch((e) => {
            throw new Error(`API 返回了图片链接，但下载图片失败: ${e?.message || e}`);
          });

          const contentType = imgRes.headers.get("content-type") || "";
          generationDebug("openai:image-fetch-meta", {
            imageUrl: sanitizeUrlForLog(imageUrl),
            ok: imgRes.ok,
            status: imgRes.status,
            contentType,
          });

          if (!imgRes.ok) {
            throw new Error(`API 返回了图片链接，但下载图片失败: HTTP ${imgRes.status}`);
          }
          if (contentType && !contentType.toLowerCase().startsWith("image/")) {
            throw new Error(`API 返回的链接不是图片资源，Content-Type=${contentType}`);
          }

          const blob = await imgRes.blob();
          if (!blob.type.startsWith("image/")) {
            throw new Error(`API 返回的链接内容不是图片，Blob-Type=${blob.type || "unknown"}`);
          }
          src = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        }
        return { text: finalPrompt, image: src };
      } else {
        // ===== Gemini 请求 =====
        const parts = imgs.map((i) => {
          const str = String(i || "");
          const mimeMatch = str.match(/^data:([^;]+);base64,/i);
          return {
            inline_data: {
              // 与 @google/genai 脚本一致：保留用户上传图片的真实 MIME，避免 PNG 被误报为 JPEG。
              mime_type: mimeMatch?.[1] || "image/png",
              data: str.includes(",") ? str.split(",")[1] : str,
            },
          };
        });
        parts.push({ text: finalPrompt });

        const imageConfig = {
          // 脚本能出高清的关键是这里传枚举值 2K/4K，而不是 OpenAI 风格的 2048x2048。
          imageSize: bananaCompatImageSize,
        };
        if (custom.aspectRatio || bananaAspectRatio) {
          imageConfig.aspectRatio = custom.aspectRatio || bananaAspectRatio;
        }

        const responseModalitiesMap = {
          IMAGE: ["IMAGE"],
          TEXT: ["TEXT"],
          TEXT_IMAGE: ["TEXT", "IMAGE"],
        };
        const responseModalities = responseModalitiesMap[
          bananaResponseModalities
        ] || ["IMAGE"];

        const payload = {
          contents: [{ role: "user", parts }],
          generationConfig: {
            responseModalities,
            ...(Object.keys(imageConfig).length ? { imageConfig } : {}),
          },
        };
        if (bananaEnableGoogleSearch) {
          payload.tools = [{ google_search: {} }];
        }

        // Gemini 版本路径处理：
        // - 用户未在 Base URL 中填写版本时，保持旧行为默认追加 /v1beta
        // - 用户已填写 /v1 或 /v1beta 时，尊重用户配置，不再重复追加 /v1beta
        const cleanGeminiBase = base.replace(/\/+$/, "");
        const geminiApiBase = /\/v1(?:beta)?$/i.test(cleanGeminiBase)
          ? cleanGeminiBase
          : `${cleanGeminiBase}/v1beta`;
        // 自定义渠道模型名可能包含中文/特殊字符。
        // 某些 oneapi / 代理网关会按“原始模型名”进行精确匹配，
        // 若这里做 encodeURIComponent，可能导致带中文或【】后缀的模型名无法被识别。
        // 因此这里优先保留原始路径，仅把编码后的结果作为调试对照输出。
        const rawModelPath = finalModel.startsWith("models/")
          ? finalModel.slice("models/".length)
          : finalModel;
        const encodedModelPath = rawModelPath
          .split("/")
          .filter(Boolean)
          .map((seg) => encodeURIComponent(seg))
          .join("/");
        const requestedModelPath = rawModelPath
          .split("/")
          .filter(Boolean)
          .join("/");
        const requestPathMode = "raw-unencoded";
        const geminiUrl = `${geminiApiBase}/models/${requestedModelPath}:generateContent?key=${encodeURIComponent(key)}`;
        generationDebug("gemini:prepare-request", {
          apiType,
          bananaApiFormat,
          currentEngine: state.currentEngine,
          providerInputId,
          finalModel,
          rawModelPath,
          encodedModelPath,
          requestedModelPath,
          requestPathMode,
          cleanGeminiBase,
          geminiApiBase,
          finalUrl: sanitizeUrlForLog(geminiUrl),
          payloadSummary: {
            contentsCount: payload.contents?.length || 0,
            partsCount: parts.length,
            responseModalities,
            imageConfig,
            hasTools: !!payload.tools?.length,
          },
        });
        if (!requestedModelPath) {
          generationDebug("gemini:empty-model-path", {
            finalModel,
            rawModelPath,
            encodedModelPath,
            requestedModelPath,
            requestPathMode,
            providerInputId,
            bananaApiFormat,
          });
          throw new Error("Gemini 模型名称为空，已阻止发送请求");
        }
        const url = geminiUrl;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal,
        });
        const data = await res.json();
        generationDebug("gemini:response-meta", {
          url: sanitizeUrlForLog(url),
          ok: res.ok,
          status: res.status,
          statusText: res.statusText,
          bodyKeys: Object.keys(data || {}),
          errorMessage: data?.error?.message || null,
        });
        if (!res.ok)
          throw new Error(data.error?.message || `API Error: ${res.status}`);

        let text = "",
          image = "";
        for (const p of data.candidates?.[0]?.content?.parts || []) {
          if (p.text) text += p.text + "\n";
          const inl = p.inlineData || p.inline_data;
          if (inl?.data)
            image = `data:${inl.mimeType || inl.mime_type || "image/png"};base64,${inl.data}`;
        }
        if (!image) {
          const reason =
            data.candidates?.[0]?.finishReason ||
            data.promptFeedback?.blockReason ||
            "未知原因";
          generationDebug("gemini:no-image-returned", {
            reason,
            candidateCount: data.candidates?.length || 0,
            promptFeedback: data.promptFeedback || null,
          });
          throw new Error(`Gemini 未返回图像 (${reason})`);
        }
        return { text, image };
      }
    };

    // 并发生成
    const all = await Promise.allSettled(Array.from({ length: count }, genOne));
    const validResults = all
      .filter((r) => r.status === "fulfilled" && r.value.image)
      .map((r) => r.value);
    if (!validResults.length) {
      generationDebug("execute:all-failed", {
        settled: all.map((r, idx) => ({
          index: idx,
          status: r.status,
          message: r.status === "rejected" ? r.reason?.message : undefined,
        })),
      });
      throw new Error(
        "API 生成失败: " +
          all
            .filter((r) => r.status === "rejected")
            .map((r) => r.reason?.message)
            .join(" | "),
      );
    }

    const firstText =
      all
        .find((r) => r.status === "fulfilled" && r.value.text)
        ?.value.text.trim() || "";
    const textSecEl = $("textResultSection");
    textSecEl.style.display = "none";
    if (firstText && $("textOutput")) $("textOutput").textContent = firstText;

    // 移除骨架屏
    placeholders.forEach((p) => p.remove());

    const expectedResolution = (() => {
      if (useOpenAICompat) {
        const openaiSize = apiType === "gemini" ? mappedBananaCompatSize : ratio;
        const [width, height] = String(openaiSize || "")
          .split("x")
          .map((value) => Number(value));
        if (width && height) return { width, height, source: openaiSize };
        return null;
      }

      const [width, height] = String(ratio || "")
        .split("x")
        .map((value) => Number(value));
      if (width && height) return { width, height, source: ratio };
      return null;
    })();

    const valid = await Promise.all(
      validResults.map(async (item, index) => {
        const actualResolution = await loadImageResolution(item.image);
        const resolutionMismatch =
          !!expectedResolution &&
          !!actualResolution &&
          (actualResolution.width !== expectedResolution.width ||
            actualResolution.height !== expectedResolution.height);

        generationDebug("image:resolution-check", {
          index,
          apiType,
          finalModel,
          requestedRatio: ratio,
          bananaAspectRatio,
          bananaImageSize,
          expectedResolution,
          actualResolution,
          resolutionMismatch,
          mismatchReason: resolutionMismatch
            ? "returned-image-size-does-not-match-request"
            : null,
        });

        return {
          ...item,
          actualResolution,
          resolutionMismatch,
        };
      }),
    );

    const galleryEl = $("imageGallery");
    // prepend backwards so valid[0] is at the very top
    valid.reverse().forEach((item) => {
      const src = item.image;
      const sec = ((Date.now() - t0) / 1000).toFixed(1);
      const imageId =
        Date.now().toString() + "_" + Math.random().toString(36).slice(2, 6);
      const imageFile = localFS.isActive() ? `${imageId}.png` : null;
      const galleryItem = createGalleryItemDOM(src, sec, ratio, quality);
      galleryEl.prepend(galleryItem);
      state.currentGalleryData.unshift({
        src,
        sec,
        ratio,
        quality,
        prompt: firstText,
        imageFile,
      });
      saveHistory(
        {
          prompt,
          model: finalModel,
          aspectRatio: ratio,
          quality,
          batchCount: count,
          masks: state.selectedMasks || [],
        },
        src,
        imgs,
        imageId,
      );
    });

    // 限制本地存储数量
    state.currentGalleryData = state.currentGalleryData.slice(0, 50);

    if (localFS.isActive()) {
      localFS
        .saveJSON(
          "gallery.json",
          state.currentGalleryData.map((i) => ({
            sec: i.sec,
            ratio: i.ratio,
            quality: i.quality,
            prompt: i.prompt,
            imageFile: i.imageFile,
          })),
        )
        .catch(() => {});
    } else {
      idb.set("nanscript_current_gallery", state.currentGalleryData);
    }

    const mismatchCount = valid.filter((item) => item.resolutionMismatch).length;
    showToast(
      mismatchCount
        ? `成功生成 ${valid.length} 张图像，但有 ${mismatchCount} 张未达到请求分辨率`
        : `成功生成 ${valid.length} 张图像`,
    );
    results.style.display = "block";
    status.style.display = "none";
    generationSucceeded = true;
  } catch (e) {
    generationFailure = e;
    generationDebug("execute:catch", {
      name: e?.name,
      message: e?.message,
      stack: e?.stack,
      apiType,
      currentEngine: state.currentEngine,
    });
    if (e.name === "AbortError") {
      showToast("生成已终止", "error");
      const currentQueueTask = custom._queueTaskId ? getQueueTask(custom._queueTaskId) : null;
      if (currentQueueTask?.status !== "canceling") {
        clearQueue(); // 手动终止时清空等待队列，防止立刻开始下一个
      }
    } else {
      console.error(e);
      const diagnostic = renderGenerationDiagnosticPanel(e, { apiType }, custom);
      showToast(diagnostic?.title || e.message, "error");
    }
    status.style.display = "none";
    placeholders.forEach((p) => p.remove());
    if (!state.currentGalleryData.length) {
      results.style.display = "none";
      empty.style.display = "block";
    }
  } finally {
    clearInterval(_timerInterval);
    state.isGenerating = false;
    state.abortCtrl = null;
    btn.replaceChildren(icon("auto_awesome"), " 开始创造");
    status.textContent = "";

    if (custom._queueTaskId) {
      const queueTask = getQueueTask(custom._queueTaskId);
      if (queueTask && ["running", "canceling"].includes(queueTask.status)) {
        const wasCanceled =
          queueTask.status === "canceling" || generationFailure?.name === "AbortError";
        updateQueueTask(custom._queueTaskId, {
          status: wasCanceled ? "canceled" : generationSucceeded ? "success" : "failed",
          error: wasCanceled
            ? ""
            : generationFailure
              ? diagnoseGenerationFailure(generationFailure, { apiType }).title
              : "",
          endedAt: Date.now(),
        });
      }
      if (activeQueueTask?.id === custom._queueTaskId) activeQueueTask = null;
    }

    processNextQueueTask();
  }
}

// ========== 任务队列系统 ==========
/** 排队中的任务列表 */
const taskQueue = [];

/** 面板中展示的任务记录（包含已完成/失败/取消） */
const queueRecords = [];

let activeQueueTask = null;

/** 内部计数器 */
let _queueCounter = 0;

const QUEUE_STATUS_META = {
  waiting: { label: "等待中", icon: "schedule", cls: "text-on-surface-variant bg-surface-container" },
  running: { label: "生成中", icon: "sync", cls: "text-primary bg-primary/10" },
  success: { label: "成功", icon: "check_circle", cls: "text-success bg-success/10" },
  failed: { label: "失败", icon: "error", cls: "text-error bg-error/10" },
  canceled: { label: "已取消", icon: "block", cls: "text-on-surface-variant bg-surface-container" },
  canceling: { label: "取消中", icon: "hourglass_empty", cls: "text-on-surface-variant bg-surface-container" },
};

function formatQueueDuration(ms = 0) {
  const sec = Math.max(0, Math.round(ms / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const rest = sec % 60;
  return `${min}m ${rest}s`;
}

function getQueueTask(taskId) {
  return queueRecords.find((task) => task.id === taskId) || null;
}

function updateQueueTask(taskId, patch = {}) {
  const task = getQueueTask(taskId);
  if (!task) return;
  Object.assign(task, patch, { updatedAt: Date.now() });
  renderQueuePanel();
  updateQueueBadge();
}

function getQueueSummary() {
  if (!queueRecords.length) return null;
  const terminalStatuses = new Set(["success", "failed", "canceled"]);
  const waiting = queueRecords.filter((task) => task.status === "waiting").length;
  const running = queueRecords.filter((task) => ["running", "canceling"].includes(task.status)).length;
  const success = queueRecords.filter((task) => task.status === "success").length;
  const failed = queueRecords.filter((task) => task.status === "failed").length;
  const canceled = queueRecords.filter((task) => task.status === "canceled").length;
  const completed = success + failed + canceled;
  const allDone = queueRecords.every((task) => terminalStatuses.has(task.status));
  const startedAt = Math.min(...queueRecords.map((task) => task.createdAt || Date.now()));
  const endedAt = allDone
    ? Math.max(...queueRecords.map((task) => task.endedAt || task.updatedAt || Date.now()))
    : Date.now();

  return {
    total: queueRecords.length,
    waiting,
    running,
    success,
    failed,
    canceled,
    completed,
    allDone,
    duration: formatQueueDuration(endedAt - startedAt),
  };
}

function ensureQueuePanel() {
  let panel = document.getElementById("queueStatusPanel");
  if (panel) return panel;

  const statusBox = $("statusBox");
  const mountTarget = statusBox?.parentElement;
  if (!mountTarget) return null;

  panel = el(
    "section",
    {
      id: "queueStatusPanel",
      className:
        "hidden mt-4 rounded-2xl border border-outline-variant bg-surface-container shadow-sm overflow-hidden",
    },
    el(
      "div",
      {
        className:
          "flex items-center justify-between gap-3 px-4 py-3 border-b border-outline-variant bg-surface-container-low",
      },
      el(
        "div",
        { className: "min-w-0" },
        el("div", {
          className: "text-[11px] font-bold tracking-widest text-primary uppercase",
          textContent: "任务队列",
        }),
        el("div", {
          id: "queueStatusSummary",
          className: "text-xs text-on-surface-variant mt-1",
          textContent: "暂无排队任务",
        }),
      ),
      el(
        "button",
        {
          id: "queueStatusClearBtn",
          type: "button",
          className:
            "px-3 py-1.5 rounded-lg text-xs font-bold border border-outline-variant text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors",
        },
        "清理",
      ),
    ),
    el("div", {
      id: "queueStatusList",
      className: "max-h-[260px] overflow-auto custom-scrollbar p-3 space-y-2",
    }),
  );

  const debugPanel = document.getElementById("generationDebugPanel");
  if (debugPanel?.parentElement === mountTarget) {
    mountTarget.insertBefore(panel, debugPanel);
  } else {
    mountTarget.appendChild(panel);
  }

  panel.querySelector("#queueStatusClearBtn")?.addEventListener("click", () => {
    clearQueue(true);
  });

  return panel;
}

function renderQueuePanel() {
  const panel = ensureQueuePanel();
  if (!panel) return;
  const list = panel.querySelector("#queueStatusList");
  const summaryEl = panel.querySelector("#queueStatusSummary");
  if (!list || !summaryEl) return;

  if (!queueRecords.length) {
    panel.classList.add("hidden");
    list.replaceChildren();
    summaryEl.textContent = "暂无排队任务";
    return;
  }

  panel.classList.remove("hidden");
  list.replaceChildren();

  const summary = getQueueSummary();
  if (summary) {
    const successRate = summary.total
      ? Math.round((summary.success / summary.total) * 100)
      : 0;
    summaryEl.textContent = summary.allDone
      ? `完成 ${summary.completed}/${summary.total} · 成功率 ${successRate}% · 成功 ${summary.success} · 失败 ${summary.failed} · 取消 ${summary.canceled} · 总耗时 ${summary.duration}`
      : `进行中 ${summary.running} · 等待 ${summary.waiting} · 已完成 ${summary.completed}/${summary.total} · 已用时 ${summary.duration}`;
  }

  queueRecords.slice(-50).reverse().forEach((task) => {
    const meta = QUEUE_STATUS_META[task.status] || QUEUE_STATUS_META.waiting;
    const title = task.promptPreview || task.custom?.prompt || $("promptInput")?.value || "当前参数任务";
    const subParts = [
      task.custom?.aspectRatio || $("ratioSelect")?.value || "当前画幅",
      task.custom?.quality || $("qualitySelect")?.value || "当前质量",
      task.status === "running" && task.startedAt ? `已用时 ${formatQueueDuration(Date.now() - task.startedAt)}` : "",
      task.status === "success" && task.startedAt && task.endedAt ? `耗时 ${formatQueueDuration(task.endedAt - task.startedAt)}` : "",
    ].filter(Boolean);

    const statusPill = el(
      "span",
      {
        className: `inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${meta.cls}`,
      },
      icon(meta.icon, `text-[13px] ${task.status === "running" ? "animate-spin" : ""}`),
      meta.label,
    );

    const actions = [];
    if (["waiting", "running"].includes(task.status)) {
      actions.push(
        el(
          "button",
          {
            type: "button",
            className:
              "px-2 py-1 rounded-lg text-[10px] font-bold text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors",
            onclick: (e) => {
              e.stopPropagation();
              cancelQueueTask(task.id);
            },
          },
          task.status === "running" ? "取消" : "移除",
        ),
      );
    }
    if (task.status === "failed") {
      actions.push(
        el(
          "button",
          {
            type: "button",
            className:
              "px-2 py-1 rounded-lg text-[10px] font-bold text-primary hover:bg-primary/10 transition-colors",
            onclick: (e) => {
              e.stopPropagation();
              retryQueueTask(task.id);
            },
          },
          "重试",
        ),
      );
    }

    list.appendChild(
      el(
        "div",
        {
          className:
            "rounded-xl border border-outline-variant/70 bg-surface-container-lowest px-3 py-2.5",
        },
        el(
          "div",
          { className: "flex items-start justify-between gap-3" },
          el(
            "div",
            { className: "min-w-0 flex-1" },
            el("div", {
              className: "text-xs font-bold text-on-surface truncate",
              textContent: `#${task.index} ${title}`,
            }),
            el("div", {
              className: "mt-1 text-[10px] text-on-surface-variant truncate",
              textContent: subParts.join(" · "),
            }),
            task.error
              ? el("div", {
                  className: "mt-1 text-[10px] text-error line-clamp-2",
                  textContent: task.error,
                })
              : null,
          ),
          el("div", { className: "flex flex-col items-end gap-1 shrink-0" }, statusPill, ...actions),
        ),
      ),
    );
  });
}

/**
 * 更新队列状态徽章
 * @private
 */
function updateQueueBadge() {
  let badge = document.getElementById("queueBadge");
  const waitingCount = taskQueue.filter((task) => task.status === "waiting").length;
  if (waitingCount > 0) {
    if (!badge) {
      badge = el("span", {
        id: "queueBadge",
        className:
          "ml-2 text-[10px] font-bold bg-primary/20 text-primary px-2 py-0.5 rounded-full animate-pulse",
      });
      $("statusBox")?.parentElement?.insertBefore(badge, $("statusBox"));
    }
    badge.textContent = `📋 队列: ${waitingCount} 个任务等待中`;
    badge.style.display = "inline-block";
  } else {
    if (badge) badge.style.display = "none";
  }
}

/**
 * 将任务加入队列
 * 如果当前没有正在执行的任务，直接执行；否则加入队列等待。
 * @param {Object} [custom={}] - 自定义参数覆盖
 */
export function enqueueTask(custom = {}, options = {}) {
  _queueCounter++;
  const task = {
    id: `task_${Date.now()}_${_queueCounter}`,
    index: _queueCounter,
    status: "waiting",
    custom: { ...custom, _queueIndex: _queueCounter },
    promptPreview: String(custom.prompt || $("promptInput")?.value || "当前参数任务").slice(0, 80),
    createdAt: Date.now(),
    startedAt: null,
    endedAt: null,
    updatedAt: Date.now(),
    error: "",
  };
  queueRecords.push(task);
  taskQueue.push(task);
  renderQueuePanel();
  updateQueueBadge();
  processNextQueueTask();
  if (!options.silent) showToast(`📋 任务已提交 (#${task.index})`);
}

/**
 * 批量提交多个任务
 * @param {number} taskCount - 任务数量
 * @param {Object} [custom={}] - 每个任务共享的自定义参数
 */
export function enqueueMultiple(taskCount, custom = {}) {
  const count = Math.max(1, Math.min(taskCount, 50));
  for (let i = 0; i < count; i++) {
    enqueueTask({ ...custom }, { silent: true });
  }
  showToast(`📋 已提交 ${count} 个任务`);
}

function processNextQueueTask() {
  if (state.isGenerating || activeQueueTask) {
    renderQueuePanel();
    updateQueueBadge();
    return;
  }

  const next = taskQueue.shift();
  if (!next) {
    renderQueuePanel();
    updateQueueBadge();
    return;
  }

  if (next.status !== "waiting") {
    setTimeout(processNextQueueTask, 0);
    return;
  }

  activeQueueTask = next;
  updateQueueTask(next.id, { status: "running", startedAt: Date.now(), error: "" });
  showToast(`🔄 开始队列任务 #${next.index}...`);
  setTimeout(() => {
    if (next.status !== "running" || activeQueueTask?.id !== next.id) return;
    executeGeneration({ ...next.custom, _queueTaskId: next.id, _queueIndex: next.index });
  }, 300);
}

function cancelQueueTask(taskId) {
  const task = getQueueTask(taskId);
  if (!task) return;

  if (task.status === "waiting") {
    const idx = taskQueue.findIndex((item) => item.id === taskId);
    if (idx > -1) taskQueue.splice(idx, 1);
    updateQueueTask(taskId, { status: "canceled", endedAt: Date.now(), error: "" });
    showToast(`已移除任务 #${task.index}`);
    return;
  }

  if (task.status === "running") {
    updateQueueTask(taskId, { status: "canceling" });
    if (activeQueueTask?.id === taskId && state.abortCtrl) {
      state.abortCtrl.abort();
    } else if (activeQueueTask?.id === taskId && !state.isGenerating) {
      activeQueueTask = null;
      updateQueueTask(taskId, { status: "canceled", endedAt: Date.now(), error: "" });
      processNextQueueTask();
    }
    showToast(`正在取消任务 #${task.index}`);
  }
}

function retryQueueTask(taskId) {
  const task = getQueueTask(taskId);
  if (!task || task.status !== "failed") return;
  task.status = "waiting";
  task.startedAt = null;
  task.endedAt = null;
  task.error = "";
  task.updatedAt = Date.now();
  taskQueue.push(task);
  renderQueuePanel();
  updateQueueBadge();
  processNextQueueTask();
  showToast(`已重新提交任务 #${task.index}`);
}

/**
 * 清空任务队列
 */
export function clearQueue(forceClearRecords = false) {
  const now = Date.now();
  taskQueue.forEach((task) => {
    if (task.status === "waiting") {
      task.status = "canceled";
      task.endedAt = now;
      task.updatedAt = now;
    }
  });
  taskQueue.length = 0;

  if (forceClearRecords && !state.isGenerating && !activeQueueTask) {
    queueRecords.length = 0;
  } else if (forceClearRecords) {
    for (let i = queueRecords.length - 1; i >= 0; i--) {
      if (["success", "failed", "canceled"].includes(queueRecords[i].status)) {
        queueRecords.splice(i, 1);
      }
    }
  }

  renderQueuePanel();
  updateQueueBadge();
  showToast("任务队列已清空");
}

/**
 * 获取当前队列长度
 * @returns {number}
 */
export function getQueueLength() {
  return taskQueue.filter((task) => task.status === "waiting").length;
}