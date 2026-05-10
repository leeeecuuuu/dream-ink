/**
 * gitee.js — Gitee Gist 云存储模块
 *
 * 相比 WebDAV，Gitee 原生支持 CORS，是移动端同步的最优选择。
 *
 * 流程：
 * 1. 用户提供 Gitee Access Token
 * 2. 自动创建或关联一个名为 "DreamInk Data Backup" 的 Gist
 * 3. 将配置、历史、咒语书作为文件存储在 Gist 中
 */

import { state } from "../state/app-state.js";
import { normalizeApiConfig, setApiConfig } from "../api/api-config.js";
import { $, ls } from "../utils/helpers.js";
import { idb } from "./idb.js";

const GITEE_API_BASE = "https://gitee.com/api/v5";

export const gitee = {
  get token() {
    return ls("nanscript_gitee_token") || "";
  },
  get gistId() {
    return ls("nanscript_gitee_gist_id") || "";
  },

  /** 是否已配置 Gitee */
  isConfigured() {
    return !!this.token;
  },

  /**
   * 保存 Gitee 配置
   */
  saveConfig(token, gistId = "") {
    ls("nanscript_gitee_token", token);
    ls("nanscript_gitee_gist_id", gistId);
  },

  /**
   * 获取所有 Gist 列表，查找是否有 DreamInk 的备份
   */
  async findExistingGist() {
    const res = await fetch(
      `${GITEE_API_BASE}/gists?access_token=${this.token}&page=1&per_page=100`,
    );
    if (!res.ok) throw new Error("获取 Gist 列表失败: " + res.status);
    const gists = await res.json();
    return gists.find((g) => g.description === "DreamInk Data Backup");
  },

  /**
   * 创建新的 Gist
   */
  async createGist(files) {
    const res = await fetch(`${GITEE_API_BASE}/gists`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: this.token,
        description: "DreamInk Data Backup",
        public: false,
        files: files,
      }),
    });
    if (!res.ok) throw new Error("创建 Gist 失败: " + res.status);
    const data = await res.json();
    this.saveConfig(this.token, data.id);
    return data;
  },

  /**
   * 更新现有 Gist
   */
  async updateGist(files) {
    if (!this.gistId) throw new Error("未关联 Gist ID");
    const res = await fetch(`${GITEE_API_BASE}/gists/${this.gistId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: this.token,
        files: files,
      }),
    });
    if (!res.ok) throw new Error("更新 Gist 失败: " + res.status);
    return await res.json();
  },

  /**
   * 读取 Gist 内容
   */
  async getGist() {
    if (!this.gistId) throw new Error("未关联 Gist ID");
    const res = await fetch(
      `${GITEE_API_BASE}/gists/${this.gistId}?access_token=${this.token}`,
    );
    if (!res.ok) throw new Error("获取 Gist 内容失败: " + res.status);
    return await res.json();
  },

  /**
   * 执行全量上传
   */
  async uploadAll() {
    const files = {
      "history.json": { content: JSON.stringify(state.historyData, null, 2) },
      "library.json": { content: JSON.stringify(state.promptLib, null, 2) },
      "config.json": {
        content: JSON.stringify(
          {
            geminiBaseUrl: $("geminiBaseUrl")?.value || "",
            geminiApiKey: $("geminiApiKey")?.value || "",
            openaiBaseUrl: $("openaiBaseUrl")?.value || "",
            openaiApiKey: $("openaiApiKey")?.value || "",
            modelGemini: $("modelGemini")?.value || "",
            modelOpenai: $("modelOpenai")?.value || "",
            customModelsGemini: $("customModelsGemini")?.value || "",
            customModelsOpenai: $("customModelsOpenai")?.value || "",
            bananaApiFormat: $("bananaApiFormat")?.value || "gemini",
            gptApiFormat: $("gptApiFormat")?.value || "images",
            moderationSelect: $("moderationSelect")?.value || "auto",
            apiProfiles: Array.isArray(state.apiProfiles)
              ? state.apiProfiles
              : [],
            currentEngine: ls("nanscript_currentEngine") || "gemini",
          },
          null,
          2,
        ),
      },
    };

    if (this.gistId) {
      await this.updateGist(files);
    } else {
      const existing = await this.findExistingGist();
      if (existing) {
        this.saveConfig(this.token, existing.id);
        await this.updateGist(files);
      } else {
        await this.createGist(files);
      }
    }
    return true;
  },

  /**
   * 执行全量下载恢复
   */
  async downloadAll(callbacks = {}) {
    const data = await this.getGist();
    const files = data.files;
    let success = 0;

    if (files["history.json"]) {
      const remote = JSON.parse(files["history.json"].content);
      const merged = new Map(state.historyData.map((i) => [i.id, i]));
      remote.forEach((i) => merged.set(i.id, i));
      state.historyData = [...merged.values()]
        .sort((a, b) => (b.id || "").localeCompare(a.id || ""))
        .slice(0, 200);
      idb.set("nanscript_history_db", state.historyData);
      if (callbacks.renderHistory) callbacks.renderHistory();
      success++;
    }

    if (files["library.json"]) {
      const remote = JSON.parse(files["library.json"].content);
      const localMap = new Map(state.promptLib.map((f) => [f.folderName, f]));
      remote.forEach((rf) => {
        if (localMap.has(rf.folderName)) {
          const existing = localMap.get(rf.folderName);
          const existingKeys = new Set(
            existing.prompts.map((p) => `${p.name}|${p.content}`),
          );
          rf.prompts.forEach((p) => {
            if (!existingKeys.has(`${p.name}|${p.content}`))
              existing.prompts.push(p);
          });
        } else localMap.set(rf.folderName, rf);
      });
      state.promptLib = [...localMap.values()];
      idb.set("nanscript_prompt_lib", state.promptLib);
      if (callbacks.renderFolders) callbacks.renderFolders();
      success++;
    }

    if (files["config.json"]) {
      const remote = JSON.parse(files["config.json"].content);
      setApiConfig("gemini", normalizeApiConfig(remote, "gemini"));
      setApiConfig("openai", normalizeApiConfig(remote, "openai"));
      if (remote.modelGemini && $("modelGemini")) {
        $("modelGemini").value = remote.modelGemini;
        ls("nanscript_modelGemini", remote.modelGemini);
      }
      if (remote.modelOpenai && $("modelOpenai")) {
        $("modelOpenai").value = remote.modelOpenai;
        ls("nanscript_modelOpenai", remote.modelOpenai);
      }
      if (
        Object.prototype.hasOwnProperty.call(remote, "customModelsGemini") &&
        $("customModelsGemini")
      ) {
        $("customModelsGemini").value = remote.customModelsGemini;
        ls("nanscript_customModelsGemini", remote.customModelsGemini);
      }
      if (
        Object.prototype.hasOwnProperty.call(remote, "customModelsOpenai") &&
        $("customModelsOpenai")
      ) {
        $("customModelsOpenai").value = remote.customModelsOpenai;
        ls("nanscript_customModelsOpenai", remote.customModelsOpenai);
      }
      if (
        Object.prototype.hasOwnProperty.call(remote, "bananaApiFormat") &&
        $("bananaApiFormat")
      ) {
        $("bananaApiFormat").value = remote.bananaApiFormat;
        ls("nanscript_bananaApiFormat", remote.bananaApiFormat);
      }
      if (
        Object.prototype.hasOwnProperty.call(remote, "gptApiFormat") &&
        $("gptApiFormat")
      ) {
        $("gptApiFormat").value = remote.gptApiFormat;
        ls("nanscript_gptApiFormat", remote.gptApiFormat);
      }
      if (
        Object.prototype.hasOwnProperty.call(remote, "moderationSelect") &&
        $("moderationSelect")
      ) {
        $("moderationSelect").value = remote.moderationSelect;
        ls("nanscript_moderationSelect", remote.moderationSelect);
      }
      if (Array.isArray(remote.apiProfiles)) {
        state.apiProfiles = remote.apiProfiles;
        ls("nanscript_api_profiles", JSON.stringify(remote.apiProfiles));
      }
      if (remote.currentEngine) ls("nanscript_currentEngine", remote.currentEngine);
      if (callbacks.updatePreview) callbacks.updatePreview();
      success++;
    }

    return success;
  },
};
