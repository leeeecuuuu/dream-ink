# DreamInk

AI 图像生成工作台 — 在浏览器中直连 Gemini 或 OpenAI 兼容接口，完成文生图、图生图、蒙版重绘、批量生成与历史管理。

![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?style=flat&logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.x-38B2AC?style=flat&logo=tailwindcss&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-enabled-5A0FC8?style=flat)
![License](https://img.shields.io/badge/license-ISC-blue?style=flat)

---

## 它能做什么

DreamInk 把你常用的生图操作集中在一个页面里。左侧调参数，中间看结果，右侧翻历史和调试日志。

- 切换 **Banana · Gemini** 和 **GPT Image-2 / OpenAI 兼容** 两种引擎
- 三种 Gemini 子模型各自使用官方尺寸表，不会发错分辨率
- 上传参考图、画蒙版局部重绘、批量排队生成
- 历史记录自动保存，支持搜索、收藏、打包下载
- 数据可存浏览器本地，也可绑 WebDAV 或本地文件夹
- 纯前端，不经过任何后端，API Key 只留在你自己的浏览器里

---

## 快速上手

```bash
cd src/dream-ink-main
npm install --legacy-peer-deps
npm run dev
```

浏览器打开终端提示的地址（默认 `http://localhost:5173`）。

然后在页面右上角点 **设置**，填入你的 API Key 和接口地址就能用了。

构建生产版本：

```bash
npm run build     # 输出到 dist/
npm run preview   # 本地预览构建产物
```

---

## API 配置

配置入口：页面右上角 **⚙ 设置**

| 引擎 | 常用 Base URL | 模型示例 |
|------|-------------|---------|
| Banana · Gemini | `https://generativelanguage.googleapis.com` | `gemini-3.1-flash-image` |
| GPT Image-2 | `https://api.openai.com` | `gpt-image-1` |

- 两个引擎的配置各自独立，切换引擎不会互相覆盖
- Gemini 引擎通过模型卡片直接选择子模型，无需手动填写模型名
- Banana 请求格式可选「Gemini 原生」或「OpenAI 兼容」（适配第三方中转）

---

## Gemini 子模型

三个子模型在左侧面板直接切换，各自使用官方尺寸表：

| 模型 | 分辨率 | 画幅数 | 特点 |
|------|-------|--------|------|
| Nano Banana 2 | 0.5K / 1K / 2K / 4K | 14 种 | 主力模型，速质均衡 |
| Nano Banana Pro | 1K / 2K / 4K | 10 种 | Thinking 驱动，专业资产生成 |
| Nano Banana | 固定 1K | 10 种 | 高速低延迟 |

UI 显示的像素尺寸 = 接口实际请求的尺寸 = 官方文档支持的尺寸，三套 Nano Banana Pro 与 Nano Banana 共享同一份 `model-capabilities.js` 尺寸表。

---

## 项目结构

```text
src/dream-ink-main/
├── index.html
├── style.css
├── package.json
├── vite.config.js
├── tailwind.config.js
├── cloudflare-worker.js          # 可选 Cloudflare Worker 代理
└── src/
    ├── main.js                   # 入口：初始化 UI、事件与模块
    ├── api/
    │   ├── api-config.js         # API 配置读取与归一化
    │   └── model-fetch.js        # 模型列表拉取
    ├── components/
    │   ├── ModalManager.js
    │   └── modals/               # API 配置、信息、历史详情等弹窗模板
    ├── core/
    │   └── generator.js          # 核心：生成请求、队列、调试日志
    ├── init/
    │   ├── data-loader.js        # 启动恢复数据
    │   ├── form-persistence.js   # 表单持久化与配置预设
    │   ├── gitee-sync.js
    │   └── webdav-sync.js
    ├── state/
    │   ├── app-state.js          # 全局状态与模型定义
    │   └── model-capabilities.js # Gemini 官方尺寸表（唯一来源）
    ├── storage/
    │   ├── idb.js                # IndexedDB 封装
    │   ├── local-fs.js           # 本地文件夹存储
    │   ├── webdav.js
    │   └── gitee.js
    ├── ui/
    │   ├── engine.js             # 引擎切换
    │   ├── gemini-size-picker.js # Gemini 模型与尺寸选择器
    │   ├── gpt-size-picker.js    # GPT Image-2 尺寸选择器
    │   ├── gallery.js            # 画廊卡片渲染
    │   ├── history.js            # 历史记录
    │   ├── library.js            # 咒语书
    │   ├── lightbox.js           # 图片查看器
    │   ├── mask-editor.js        # 蒙版编辑器
    │   ├── mobile.js             # 移动端适配
    │   ├── modals.js             # 弹窗管理
    │   ├── preview.js            # 参考图预览
    │   ├── theme.js              # 深浅色主题
    │   └── toast.js              # Toast 通知
    └── utils/
        ├── dom.js                # 安全 DOM 构建工具
        ├── event-bus.js          # 事件总线
        ├── feature-detect.js     # 浏览器能力检测
        └── helpers.js            # 通用工具
```

---

## 操作指南

### 生成图片

1. 选择引擎（Banana 或 GPT Image-2）
2. 填入 API 配置
3. 写好提示词，选好画幅和尺寸
4. 点「开始创造」
5. `Ctrl + Enter` 可快速提交

### 参考图与蒙版

- 拖拽或点击上传参考图（最多 10 张）
- 支持直接在提示词输入框 `Ctrl+V` 粘贴图片
- 打开蒙版编辑器，画笔涂改后 AI 只重绘涂抹区域

### 批量任务

- 并发数量：一次请求生成几张（1–20）
- 批量提交：向队列加多少个独立任务（1–50）
- 生成中继续提交会自动排队
- 队列支持查看进度、取消单个、失败重试

### 历史记录

- 自动保存，右侧面板可搜索、筛选引擎、只看收藏
- 点击记录查看详情、复制提示词、一键重新生成
- 支持 JSON 导入/导出、打包下载原图

---

## 数据存储

| 方式 | 存哪里 | 适合 |
|------|-------|------|
| 浏览器默认 | IndexedDB + localStorage | 免配置直接使用 |
| 本地文件夹 | 磁盘目录（需 Chrome/Edge） | 图片不占浏览器缓存 |
| WebDAV | 坚果云等服务 | 多设备同步 |
| Gitee Gist | Gitee | 跨设备、移动端友好 |

---

## 调试

生成区域下方有「详细调试日志」面板，记录每次请求的完整链路：

- 开始、模型解析、请求上下文、OpenAI 兼容映射
- 响应状态、响应体摘要、图片解析、分辨率检查
- 异常捕获与诊断建议

出问题时点「复制全部」，把日志发给开发者或发 issue。

---

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl + Enter` | 快速生成 |

---

## 浏览器兼容性

推荐 **Chrome / Edge 最新版**。

| 功能 | Chrome/Edge | Firefox | Safari |
|------|:-----------:|:-------:|:------:|
| 生图、IndexedDB、PWA | ✅ | ✅ | ⚠️ |
| File System Access API | ✅ | ❌ | ❌ |
| 剪贴板复制 | ✅ | ⚠️ | ⚠️ |

---

## 安全提示

- API Key 和 Token 只存在你自己的浏览器或本地文件夹里
- 不要在不可信设备上保存密钥
- 前端直连 API 可能遇到 CORS，可使用中转服务或自行部署代理
- 遵守各模型服务商的使用条款

---

## 许可证

ISC
