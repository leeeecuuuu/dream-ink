# DreamInk

> 一个面向 AI 图像生成工作流的前端工作台，支持 Banana · Gemini 与 GPT Image-2 / OpenAI 兼容接口，集成参考图、蒙版编辑、批量任务、历史记录、咒语书、云同步、本地文件夹存储与 PWA 离线能力。

![DreamInk](https://img.shields.io/badge/DreamInk-AI%20Image%20Workbench-7c3aed?style=for-the-badge)
![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.x-38B2AC?style=for-the-badge&logo=tailwindcss&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-enabled-5A0FC8?style=for-the-badge)

## 目录

- [项目简介](#项目简介)
- [核心特性](#核心特性)
- [功能概览](#功能概览)
- [技术栈](#技术栈)
- [项目结构](#项目结构)
- [快速开始](#快速开始)
- [API 配置说明](#api-配置说明)
- [使用指南](#使用指南)
- [数据存储与同步](#数据存储与同步)
- [调试日志](#调试日志)
- [常用脚本](#常用脚本)
- [部署说明](#部署说明)
- [浏览器兼容性](#浏览器兼容性)
- [安全与隐私说明](#安全与隐私说明)
- [常见问题](#常见问题)
- [开发约定](#开发约定)
- [许可证](#许可证)

## 项目简介

DreamInk 是一个纯前端 AI 图像生成工作台，目标是将常见的生图操作集中在一个轻量、直观、可本地运行的界面中。

它适合以下场景：

- 使用 Gemini / Banana 相关图像模型生成图片。
- 使用 GPT Image-2、`gpt-image-1` 或其他 OpenAI 兼容图像接口生成图片。
- 通过第三方中转接口统一管理不同模型和 Base URL。
- 批量提交多个生成任务，并自动排队执行。
- 保存历史记录、提示词、参考图与生成图。
- 将数据同步到本地文件夹、WebDAV 或 Gitee Gist。
- 在生成失败、模型不匹配或接口返回异常时查看详细链路日志。

项目无需后端服务，默认以浏览器本地存储为主，也可以绑定本地文件夹或云同步服务持久化数据。

## 核心特性

### 1. 双引擎生图

项目内置两个主要生成入口：

- **Banana · Gemini**
  - 支持 Gemini 原生接口。
  - 支持 OpenAI 兼容格式的第三方中转接口。
  - 支持画幅比例、图像尺寸、响应模态、联网搜索等参数。

- **GPT Image-2 / OpenAI 兼容接口**
  - 支持 OpenAI Images API。
  - 支持 Chat Completions 兼容模式。
  - 支持模型名自定义与模型列表拉取。
  - 支持输出格式、画幅尺寸、内容审核等参数。

### 2. 参考图与蒙版编辑

- 支持上传多张参考图。
- 支持拖拽上传。
- 支持为参考图绘制蒙版。
- 支持画笔 / 橡皮擦模式。
- 支持自定义笔刷大小。
- 生成历史中可保存并恢复参考图与蒙版。

### 3. 批量与队列任务

- 支持一次生成多张图片。
- 支持批量提交多个任务。
- 批量提交默认数量为 **1**。
- 生成中继续提交任务时会进入队列。
- 支持清空任务队列。
- 生成中点击主按钮可终止当前任务。

### 4. 历史记录与咒语书

- 自动保存生成历史。
- 历史详情支持查看提示词、模型、参数、参考图、蒙版等信息。
- 支持从历史记录一键导入参数重新生成。
- 支持复制历史提示词。
- 支持将历史提示词加入咒语书。
- 咒语书支持分类管理、编辑、删除与缩略图。

### 5. 数据同步与存储

- 默认使用浏览器 IndexedDB / localStorage。
- 支持绑定本地文件夹，直接把历史、配置和图片保存到磁盘。
- 支持 WebDAV 同步，例如坚果云。
- 支持 Gitee Gist 同步，适合移动端或跨设备同步。

### 6. 调试日志与一键复制

- 生成链路会记录详细调试日志。
- 日志面板支持清空日志。
- 日志面板支持 **一键复制全部日志**。
- 复制内容包含日志序号、时间、阶段和详细 JSON 内容，便于排查接口问题。

### 7. PWA 支持

- 集成 Service Worker。
- 支持浏览器安装为桌面应用。
- 支持静态资源预缓存。

## 功能概览

| 模块 | 功能 |
| --- | --- |
| 生图引擎 | Banana · Gemini、GPT Image-2 / OpenAI 兼容 |
| API 配置 | 双引擎独立 Base URL、API Key、模型配置、配置预设 |
| 图片生成 | 文生图、图生图、多图参考、批量生成 |
| 蒙版编辑 | 画笔、橡皮擦、笔刷大小、保存并应用 |
| 批量任务 | 多任务提交、队列执行、清空队列、终止生成 |
| 历史记录 | 自动保存、详情查看、参数导入、JSON 导入导出、打包下载原图 |
| 咒语书 | 分类、收藏提示词、编辑、删除、缩略图 |
| 同步存储 | IndexedDB、本地文件夹、WebDAV、Gitee Gist |
| UI 体验 | 深浅色主题、移动端底部 Tab、Lightbox 查看器 |
| 调试能力 | Generation Debug 面板、清空日志、复制全部日志 |

## 技术栈

- [Vite](https://vite.dev/)：前端构建工具。
- [Tailwind CSS](https://tailwindcss.com/)：样式系统。
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/)：PWA 支持。
- [JSZip](https://stuk.github.io/jszip/)：历史图片打包下载。
- 原生 JavaScript ES Modules：无前端框架依赖。
- IndexedDB / localStorage：浏览器本地数据存储。
- File System Access API：本地文件夹绑定与读写。
- WebDAV / Gitee Gist：可选云同步方案。

## 项目结构

```text
dream ink/
├── index.html                 # 应用 HTML 入口
├── style.css                  # Tailwind 与全局样式
├── package.json               # 项目脚本与依赖
├── vite.config.js             # Vite / PWA 配置
├── tailwind.config.js         # Tailwind 配置
├── cloudflare-worker.js       # 可选的 Cloudflare Worker 代理示例
├── src/
│   ├── main.js                # 应用入口，初始化 UI、事件与模块
│   ├── api/
│   │   ├── api-config.js      # API 配置读取、归一化与兼容处理
│   │   └── model-fetch.js     # 模型列表拉取
│   ├── components/
│   │   └── modals/            # API 配置、信息等弹窗模板
│   ├── core/
│   │   └── generator.js       # 核心生成逻辑、队列、调试日志
│   ├── init/
│   │   ├── data-loader.js     # 启动时恢复历史、咒语书、画廊等数据
│   │   ├── form-persistence.js# 表单持久化与配置预设
│   │   ├── gitee-sync.js      # Gitee 同步初始化
│   │   └── webdav-sync.js     # WebDAV 同步初始化
│   ├── state/
│   │   └── app-state.js       # 全局状态与默认配置
│   ├── storage/
│   │   ├── idb.js             # IndexedDB 简易封装
│   │   ├── local-fs.js        # 本地文件夹存储
│   │   ├── webdav.js          # WebDAV 同步逻辑
│   │   └── gitee.js           # Gitee Gist 同步逻辑
│   ├── ui/
│   │   ├── engine.js          # 引擎切换与模型同步
│   │   ├── gallery.js         # 画廊卡片
│   │   ├── history.js         # 历史记录
│   │   ├── library.js         # 咒语书
│   │   ├── lightbox.js        # 图片查看器
│   │   ├── mask-editor.js     # 蒙版编辑器
│   │   ├── mobile.js          # 移动端适配
│   │   ├── preview.js         # 参考图预览
│   │   ├── ratio-dropdown.js  # 尺寸选择器
│   │   ├── theme.js           # 主题切换
│   │   └── toast.js           # Toast 通知
│   └── utils/
│       ├── dom.js             # DOM 创建与图标工具
│       ├── event-bus.js       # 事件总线
│       ├── feature-detect.js  # 浏览器能力检测
│       └── helpers.js         # 通用工具函数
└── dist/                      # 构建产物，执行 build 后生成
```

## 快速开始

### 环境要求

- Node.js：建议使用 Node.js 18 或更高版本。
- npm：随 Node.js 安装。
- 现代浏览器：推荐 Chrome / Edge。

### 安装依赖

```bash
npm install
```

### 启动开发环境

```bash
npm run dev
```

启动后在浏览器中打开终端输出的本地地址，通常为：

```text
http://localhost:5173
```

### 生产构建

```bash
npm run build
```

构建产物会输出到 `dist/` 目录。

### 本地预览构建产物

```bash
npm run preview
```

## API 配置说明

打开页面右上角的 **API 配置** 按钮，可以配置不同引擎的接口信息。

### Banana · Gemini 配置

需要配置：

- 接口地址 `Base URL`
- API Key
- Banana 请求格式
- Banana / Gemini 模型名称

请求格式可选：

| 格式 | 说明 |
| --- | --- |
| OpenAI 兼容 | 推荐用于第三方中转接口，默认走 `/v1/chat/completions` 或兼容图像接口 |
| Gemini 原生 | 直连 Gemini 原生接口时使用，走 `models/:generateContent` |

示例 Base URL：

```text
https://generativelanguage.googleapis.com
```

常见模型示例：

```text
gemini-2.0-flash-preview-image-generation
```

> 实际模型名称取决于你使用的官方接口或第三方中转服务。

### GPT Image-2 / OpenAI 兼容配置

需要配置：

- 接口地址 `Base URL`
- API Key
- GPT 请求格式
- GPT / OpenAI 兼容模型名称

请求格式可选：

| 格式 | 说明 |
| --- | --- |
| Images API | 默认模式，适合图像生成或图像编辑接口 |
| Chat Completions | 适合把图像生成包装在聊天响应中的代理服务 |

示例 Base URL：

```text
https://api.openai.com
```

常见模型示例：

```text
gpt-image-1
```

### 配置预设

API 配置面板支持保存多个配置预设，适合在不同服务商、不同中转接口或不同模型组合之间切换。

预设内容通常包括：

- Gemini / Banana Base URL
- Gemini / Banana API Key
- GPT / OpenAI Base URL
- GPT / OpenAI API Key
- 模型名称
- 请求格式
- 自定义模型列表

## 使用指南

### 生成一张图片

1. 选择生成引擎：Banana 或 GPT Image-2。
2. 在 API 配置中填入对应的 Base URL、API Key 与模型名称。
3. 在左侧输入画面描述。
4. 选择画幅、质量、尺寸等参数。
5. 点击 **开始创造**。

### 使用参考图

1. 在“参考垫图”区域点击上传，或拖拽图片到上传区域。
2. 可上传多张参考图。
3. 生成时系统会把参考图一起发送给接口。

### 使用蒙版编辑

1. 上传参考图后，进入蒙版编辑器。
2. 使用画笔标记需要编辑或保留的区域。
3. 可切换画笔 / 橡皮擦。
4. 调整笔触大小。
5. 点击保存并应用。

### 批量生成与批量提交

项目中有两个相关概念：

- **并发数量**：一次生成请求中生成多少张图，范围为 1~20。
- **批量提交任务**：向任务队列提交多少个独立任务，范围为 1~50，默认值为 1。

当正在生成时继续提交任务，任务会进入队列等待执行。

### 快捷键

| 快捷键 | 功能 |
| --- | --- |
| `Ctrl + Enter` / `Cmd + Enter` | 快速开始生成 |

### 历史记录

生成成功后会自动写入历史记录。历史记录支持：

- 查看生成图片。
- 查看提示词与参数。
- 复制提示词。
- 导入参数与参考图重新生成。
- 加入咒语书。
- 删除记录。
- 导出历史 JSON。
- 导入历史 JSON。
- 打包下载历史原图。

### 咒语书

咒语书用于长期管理常用提示词：

- 新建分类。
- 添加提示词。
- 为提示词添加缩略图。
- 编辑提示词。
- 删除提示词。
- 从历史记录加入咒语书。

## 数据存储与同步

### 默认浏览器存储

未绑定任何同步方式时，DreamInk 使用：

- IndexedDB 保存历史记录、画廊、咒语书等结构化数据。
- localStorage 保存表单配置、主题、API 配置等轻量数据。

这种方式最简单，但数据与当前浏览器环境绑定。

### 本地文件夹存储

在支持 File System Access API 的浏览器中，可以绑定一个本地文件夹。

绑定后项目会将数据直接写入磁盘，例如：

```text
config.json
history.json
prompts.json
gallery.json
current_refs.json
current_masks.json
images/
├── originals/
├── thumbs/
└── refs/
```

优点：

- 图片不会长期占用浏览器缓存。
- 数据更容易备份。
- 刷新或重新打开页面后可恢复配置。

注意：

- 该能力主要支持 Chrome / Edge。
- 浏览器可能会在重新打开后要求重新授权目录访问权限。

### WebDAV 同步

项目支持 WebDAV 云同步，可用于坚果云或其他支持 WebDAV 的服务。

通常需要配置：

- WebDAV 地址
- 用户名
- 应用密码
- 可选代理地址

同步内容包括：

- 历史记录
- 咒语书
- API 配置
- 表单配置

> 建议使用 WebDAV 服务提供的“应用密码”，不要直接使用账户登录密码。

### Gitee Gist 同步

Gitee Gist 同步适合跨设备使用，尤其适合移动端环境。

需要配置：

- Gitee Access Token
- 可选 Gist ID

如果未填写 Gist ID，项目会尝试创建或关联数据备份。

同步内容包括：

- `history.json`
- `library.json`
- `config.json`

## 调试日志

生成区域下方有 `Generation Debug` 调试面板。

日志会记录关键阶段，例如：

- 执行开始。
- API 配置读取。
- 模型解析。
- 请求上下文。
- 请求发送前摘要。
- 响应状态。
- 响应体摘要。
- 图片解析结果。
- 分辨率检查。
- 异常捕获。

### 复制全部日志

点击调试面板中的 **复制全部** 按钮，会将当前全部日志复制到剪贴板。

复制格式示例：

```text
#1 18:00:00 execute:start
{
  "apiType": "gemini",
  "currentEngine": "gemini"
}

---

#2 18:00:01 model:resolved-before-fallback
{
  "resolvedModel": "..."
}
```

该功能适合：

- 排查接口请求失败。
- 向模型服务商或开发者反馈问题。
- 对比不同中转接口返回格式。

## 常用脚本

| 命令 | 说明 |
| --- | --- |
| `npm install` | 安装项目依赖 |
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 构建生产版本 |
| `npm run preview` | 本地预览生产构建 |

## 部署说明

DreamInk 是一个静态前端项目，执行构建后可以部署到任意静态托管平台。

### 构建

```bash
npm run build
```

### 部署目录

将 `dist/` 目录部署到你的静态托管服务。

可选平台：

- GitHub Pages
- Cloudflare Pages
- Vercel
- Netlify
- Nginx 静态站点
- 任意对象存储静态网站

### GitHub Pages 提示

如果部署到 GitHub Pages，请注意：

- Vite 项目的 `base` 路径可能需要根据仓库名调整。
- 如果使用自定义域名，可保持根路径部署。
- PWA 缓存可能导致更新后仍看到旧版本，必要时清理浏览器站点数据。

## 浏览器兼容性

| 功能 | Chrome / Edge | Firefox | Safari |
| --- | --- | --- | --- |
| 基础生图功能 | 支持 | 支持 | 支持 |
| IndexedDB | 支持 | 支持 | 支持 |
| PWA | 支持 | 部分支持 | 部分支持 |
| File System Access API | 支持 | 不支持或部分支持 | 不支持或部分支持 |
| 剪贴板复制 | HTTPS / localhost 支持较好 | 需要权限 | 需要权限 |

建议使用最新版 Chrome 或 Edge 获得完整体验。

## 安全与隐私说明

请特别注意以下事项：

1. **API Key 存储在浏览器本地**
   - 项目没有后端，API Key 会保存在浏览器本地存储或你绑定的本地文件夹中。
   - 不要在不可信设备上保存敏感密钥。

2. **前端直连 API 可能遇到 CORS 限制**
   - 某些官方接口不允许浏览器直接跨域请求。
   - 可以使用支持 CORS 的中转服务或自行部署代理。

3. **WebDAV / Gitee Token 请妥善保管**
   - 推荐使用应用密码或最小权限 Token。
   - 不要把包含密钥的配置文件提交到公开仓库。

4. **生成内容合规**
   - 请遵守你所使用模型和 API 服务商的使用条款。
   - 不要生成、上传或传播违法违规内容。

## 常见问题

### 1. 为什么提示 API Key 或 Base URL 缺失？

请打开 API 配置，确认当前选择的引擎对应配置已经填写完整。

Banana 和 GPT Image-2 使用独立配置，切换引擎后需要确认对应引擎的配置。

### 2. 为什么模型显示正确，但实际请求走错接口？

项目已经将 Banana 与 GPT Image-2 的模型配置拆分为独立字段，并在切换引擎时同步当前 provider。若仍异常，请检查：

- 当前顶部引擎标识。
- API 配置中的 Base URL。
- 模型输入框。
- 调试日志中的 `apiType`、`providerKey`、`finalModel`。

### 3. 为什么接口返回成功但没有图片？

不同中转服务返回格式可能不同。项目已经做了多种格式解析，包括：

- `data[].b64_json`
- `data[].url`
- `output[].result`
- `choices[].message`
- 嵌套对象中的 URL 或 Base64

如果仍无法解析，请点击 **复制全部日志**，查看响应摘要并按服务商格式适配。

### 4. 为什么本地文件夹绑定不可用？

本地文件夹绑定依赖 File System Access API。请确认：

- 使用 Chrome / Edge。
- 页面运行在 HTTPS 或 localhost。
- 浏览器没有禁用相关权限。

### 5. 为什么剪贴板复制失败？

浏览器剪贴板 API 通常要求：

- HTTPS 或 localhost 环境。
- 用户主动点击按钮触发。
- 浏览器授予剪贴板权限。

### 6. 如何清理 PWA 缓存？

如果页面更新后仍显示旧版本，可以尝试：

- 浏览器开发者工具 → Application → Service Workers → Unregister。
- 清理站点数据。
- 强制刷新页面。

## 开发约定

### 模块划分

- `src/core/`：核心业务流程，例如生成、队列和调试日志。
- `src/ui/`：界面交互、组件渲染和视觉行为。
- `src/storage/`：本地与云端存储逻辑。
- `src/init/`：应用启动时的初始化流程。
- `src/api/`：API 配置与模型列表拉取。
- `src/state/`：全局状态。
- `src/utils/`：通用工具。

### 代码风格

- 使用 ES Modules。
- 优先使用原生 DOM API 构建动态节点。
- 避免在复杂动态内容中直接拼接不可信 HTML。
- 与存储相关的逻辑尽量集中在 `storage/` 和 `init/`。
- UI 事件初始化集中在 `main.js` 与对应 `ui/` 模块。

### 提交前建议检查

```bash
npm run build
git diff --check
```

## 许可证

当前 `package.json` 中声明为：

```text
ISC
```

如需更明确的开源授权，请在仓库中补充 `LICENSE` 文件。
