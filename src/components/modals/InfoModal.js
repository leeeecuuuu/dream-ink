export const InfoModal = `
    <!-- 指南模态框 -->
    <div class="modal-overlay" id="infoModal">
        <div class="modal-content !max-w-[580px] !w-[90vw]">
            <div class="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-lowest">
                <h3 class="font-bold text-on-surface m-0 flex items-center gap-2">
                    <span class="material-symbols-outlined text-primary">help</span> 指南与动态
                </h3>
                <button id="closeInfoBtn" class="material-symbols-outlined text-outline hover:text-on-surface transition-colors text-2xl">close</button>
            </div>
            <div class="bg-surface-container-lowest flex flex-col" style="max-height: 80vh">
                <div class="flex border-b border-outline-variant px-6 gap-0">
                    <button class="info-tab active py-3 px-4 text-sm font-bold text-primary border-b-2 border-primary -mb-px transition-colors" data-target="tab-author">关于</button>
                    <button class="info-tab py-3 px-4 text-sm font-medium text-on-surface-variant hover:text-on-surface border-b-2 border-transparent -mb-px transition-colors" data-target="tab-tips">使用建议</button>
                    <button class="info-tab py-3 px-4 text-sm font-medium text-on-surface-variant hover:text-on-surface border-b-2 border-transparent -mb-px transition-colors" data-target="tab-log">更新日志</button>
                </div>

                <div class="p-6 overflow-y-auto text-sm text-on-surface leading-relaxed custom-scrollbar space-y-4">
                    <div id="tab-author" class="info-pane space-y-4">
                        <h4 class="font-bold text-on-surface text-base">关于本工具</h4>
                        <p class="text-on-surface-variant"><strong class="text-on-surface">DreamInk</strong> 是一个运行在浏览器中的图像生成工作台，可通过 fetch API 直连 Google Gemini 或 OpenAI 兼容接口，支持文生图、图生图与局部重绘等创作流程。</p>
                        <p class="text-on-surface-variant">应用默认无需后端服务，API Key、提示词库、历史记录等数据会优先保存在你的本地浏览器中；如启用同步或本地文件夹存储，则按你的配置进行保存。</p>
                        <div class="pt-3 mt-3 border-t border-outline-variant space-y-2">
                            <p class="text-on-surface-variant"><strong class="text-on-surface">作者：</strong>Claude Opus 4.6 thinking | Gemini 3.1 pro</p>
                            <p class="text-on-surface-variant text-xs leading-relaxed"><strong class="text-on-surface">鸣谢名单：</strong>青犬莉的生图脚本 | Angela 的生图前端 | kakaa 的 kavelai | Jasmine 的热心 | 肚子疼的升级优化</p>
                        </div>
                    </div>

                    <div id="tab-tips" class="info-pane hidden space-y-4">
                        <h4 class="font-bold text-on-surface text-base">使用技巧</h4>
                        <div>
                            <p class="font-bold text-on-surface mb-2">1. 接口与网络配置</p>
                            <ul class="space-y-1.5 pl-4 list-disc text-on-surface-variant">
                                <li><strong class="text-on-surface">引擎切换：</strong>左侧面板支持在 <strong class="text-on-surface">Google Gemini</strong> 与 <strong class="text-on-surface">OpenAI / GPT</strong> 兼容接口之间快速切换。</li>
                                <li><strong class="text-on-surface">地址配置：</strong>Gemini 默认使用 <code class="bg-surface-container px-1.5 py-0.5 rounded text-xs">https://generativelanguage.googleapis.com</code>；GPT 请填写对应的 OpenAI 兼容代理地址。</li>
                                <li><strong class="text-on-surface">数据与接口分离：</strong>存储同步和 API 配置已拆分为两个入口，分别管理数据备份与模型调用，避免混淆。</li>
                            </ul>
                        </div>
                        <div>
                            <p class="font-bold text-on-surface mb-2">2. 提示词编写指南</p>
                            <ul class="space-y-1.5 pl-4 list-disc text-on-surface-variant">
                                <li><strong class="text-on-surface">黄金公式：</strong>主体描述 + 环境背景 + 细节补充 + 光影效果 + 艺术风格。</li>
                                <li><strong class="text-on-surface">防改写：</strong>使用 OpenAI Responses API 时，可开启「防改写」以尽量保持原始提示词表达。</li>
                                <li><strong class="text-on-surface">语言选择：</strong>复杂场景、精细风格或专业术语较多时，英文提示词通常更稳定。</li>
                            </ul>
                        </div>
                        <div>
                            <p class="font-bold text-on-surface mb-2">3. 垫图、重绘与模型特性</p>
                            <ul class="space-y-1.5 pl-4 list-disc text-on-surface-variant">
                                <li><strong class="text-on-surface">参考垫图：</strong>最多可上传 10 张图片，模型会参考原图的构图、色彩与轮廓。</li>
                                <li><strong class="text-on-surface">蒙版重绘：</strong>给垫图绘制蒙版后，AI 会优先重绘被标记区域，适合局部修图、替换物体或微调细节。</li>
                                <li><strong class="text-on-surface">内容审核：</strong>新增审核强度选项，可根据接口支持情况调整过滤策略。</li>
                            </ul>
                        </div>
                    </div>

                    <div id="tab-log" class="info-pane hidden space-y-4">
                        <h4 class="font-bold text-on-surface text-base">最新动态</h4>

                        <div class="pb-4 border-b border-outline-variant/50">
                            <p class="font-bold text-primary mb-1">2026-04-30（晚间更新）</p>
                            <p class="text-[11px] text-on-surface-variant mb-2 italic">创作控制力与配置体验同步升级：从审核、尺寸到重绘流程，都更清晰、更可控。</p>
                            <ul class="space-y-1.5 pl-4 list-disc text-on-surface-variant text-xs">
                                <li>🔍 <strong class="text-on-surface">新增内容审核选项。</strong>现在可以按需选择审核强度，兼容支持该参数的 OpenAI 格式接口，让生成策略更灵活。</li>
                                <li>🛡️ <strong class="text-on-surface">加入提示词防改写设置。</strong>针对容易自动润色提示词的接口，新增防改写开关，尽量保留你的原始创作意图。</li>
                                <li>📐 <strong class="text-on-surface">更新预设画幅尺寸。</strong>重新整理常用尺寸与比例，覆盖更多横版、竖版、方图及纸张场景，选择更贴近实际创作需求。</li>
                                <li>🎨 <strong class="text-on-surface">上线蒙版重绘功能。</strong>可在参考图上手动涂抹需要修改的区域，让 AI 只针对局部进行重绘，修图和二创更精准。</li>
                                <li>⚙️ <strong class="text-on-surface">拆分数据存储与 API 接口配置。</strong>同步备份归同步备份，模型调用归模型调用，入口更清楚，配置更不容易出错。</li>
                            </ul>
                        </div>

                        <details class="group">
                            <summary class="list-none cursor-pointer py-2 text-on-surface-variant hover:text-primary transition-colors flex items-center gap-2 text-xs font-medium">
                                <span class="material-symbols-outlined text-[16px] group-open:rotate-90 transition-transform">chevron_right</span>
                                查看历史更新记录
                            </summary>
                            <div class="space-y-4 mt-2">
                                <div class="pb-4 border-b border-outline-variant/50">
                                    <p class="font-bold text-primary mb-1">2026-04-30</p>
                                    <p class="text-[11px] text-on-surface-variant mb-2 italic">接口适配增强，兼容更多代理服务。</p>
                                    <ul class="space-y-1.5 pl-4 list-disc text-on-surface-variant text-xs">
                                        <li>🤖 <strong class="text-on-surface">GPT 代理兼容增强。</strong>支持标准生图接口与对话格式返回图片，降低代理差异带来的使用门槛。</li>
                                        <li>🔗 <strong class="text-on-surface">接口地址自动规范化。</strong>自动处理末尾斜杠和 <code class="bg-surface-container px-1 rounded">/v1</code>，减少 404 与路径错误。</li>
                                        <li>🔍 <strong class="text-on-surface">模型列表更好选。</strong>拉取模型后自动将当前引擎相关模型置顶。</li>
                                        <li>⌨️ <strong class="text-on-surface">新增快捷生成。</strong>支持 <code class="bg-surface-container px-1 rounded">Ctrl + Enter</code> 快速提交。</li>
                                        <li>🛑 <strong class="text-on-surface">终止逻辑优化。</strong>停止生成时会同步清理后续排队任务。</li>
                                    </ul>
                                </div>

                                <div class="pb-4 border-b border-outline-variant/50">
                                    <p class="font-bold text-primary mb-1">2026-04-29</p>
                                    <p class="text-[11px] text-on-surface-variant mb-2 italic">底层与移动端体验优化。</p>
                                    <ul class="space-y-1.5 pl-4 list-disc text-on-surface-variant text-xs">
                                        <li>☁️ <strong class="text-on-surface">新增 Gitee 同步。</strong>支持通过令牌备份提示词与配置，多设备使用更方便。</li>
                                        <li>⚡ <strong class="text-on-surface">模块化重构。</strong>拆分代码结构，提高响应速度和维护性。</li>
                                        <li>🖼️ <strong class="text-on-surface">画廊按钮优化。</strong>桌面端悬浮显示，移动端常驻，操作更顺手。</li>
                                        <li>🔍 <strong class="text-on-surface">缩略图更清晰。</strong>优化封面生成算法，历史记录和咒语书展示更精致。</li>
                                        <li>📜 <strong class="text-on-surface">支持 PWA。</strong>可安装到桌面或手机主屏，离线状态也能查看本地数据。</li>
                                    </ul>
                                </div>

                                <div class="pb-4 border-b border-outline-variant/50">
                                    <p class="font-bold text-primary mb-1">2026-04-25</p>
                                    <p class="text-[11px] text-on-surface-variant mb-2 italic">重点解决数据保存与历史记录体验。</p>
                                    <ul class="space-y-1.5 pl-4 list-disc text-on-surface-variant text-xs">
                                        <li>🎉 <strong class="text-on-surface">全面焕新。</strong>加入 GPT 模式，并更名为 DreamInk。</li>
                                        <li>🗂️ <strong class="text-on-surface">图片可保存到磁盘。</strong>授权本地文件夹后，可将图片、历史与咒语书写入电脑。</li>
                                        <li>⚙️ <strong class="text-on-surface">API 配置自动保存。</strong>Key 与接口地址等配置会保存在本地。</li>
                                        <li>🖼️ <strong class="text-on-surface">历史记录支持原图查看。</strong>打开详情时加载原图而非模糊缩略图。</li>
                                        <li>📎 <strong class="text-on-surface">垫图持久化。</strong>历史中可查看当时使用的参考图，刷新后也能恢复。</li>
                                        <li>📖 <strong class="text-on-surface">咒语书卡片支持图片。</strong>从历史收藏提示词时，图片会一并保存。</li>
                                        <li>⏱️ <strong class="text-on-surface">显示生成耗时。</strong>状态栏和占位卡片实时显示等待时间。</li>
                                    </ul>
                                </div>

                                <div class="pb-4 border-b border-outline-variant/50">
                                    <p class="font-bold text-primary mb-1">2026-04-25（早些时候）</p>
                                    <p class="text-[11px] text-on-surface-variant mb-2 italic">画幅选择体验升级。</p>
                                    <ul class="space-y-1.5 pl-4 list-disc text-on-surface-variant text-xs">
                                        <li>📐 <strong class="text-on-surface">画幅选择改版。</strong>下拉菜单重新分组并加入标注，支持常用比例与 4K 尺寸。</li>
                                        <li>✏️ <strong class="text-on-surface">支持自定义尺寸。</strong>宽高拆分为独立输入框，减少格式输入错误。</li>
                                        <li>🔀 <strong class="text-on-surface">引擎模型配置隔离。</strong>Gemini 与 GPT 各自保存模型名，切换时不再互相覆盖。</li>
                                        <li>🔍 <strong class="text-on-surface">缩放查看更稳定。</strong>滚轮缩放跟随鼠标位置，查看图片更自然。</li>
                                    </ul>
                                </div>

                                <div class="pb-4 border-b border-outline-variant/50">
                                    <p class="font-bold text-primary mb-1">2026-04-25（更早）</p>
                                    <p class="text-[11px] text-on-surface-variant mb-2 italic">界面与基础能力重做。</p>
                                    <ul class="space-y-1.5 pl-4 list-disc text-on-surface-variant text-xs">
                                        <li>🎨 全新界面，支持深色模式，并跟随系统自动切换。</li>
                                        <li>⚡ 同时支持 Gemini 与 GPT 两类生图引擎。</li>
                                        <li>📌 支持批量生成多张图片，并完整保存到历史记录。</li>
                                        <li>🔖 历史详情可复制提示词，也可一键导入参数重新生成。</li>
                                    </ul>
                                </div>

                                <div class="pb-4 border-b border-outline-variant/50">
                                    <p class="font-bold text-primary mb-1">2026-03-26 · 诞生</p>
                                    <ul class="space-y-1.5 pl-4 list-disc text-on-surface-variant text-xs">
                                        <li>🎉 BanavelAi Image 开始内测，欢迎使用。</li>
                                        <li>如有功能建议或 Bug，欢迎反馈。</li>
                                    </ul>
                                </div>
                            </div>
                        </details>

                        <div>
                            <p class="font-bold text-on-surface-variant mb-2">🔎 接下来想做的...</p>
                            <ul class="space-y-1 pl-4 list-disc text-on-surface-variant text-xs opacity-70">
                                <li>上传图片前自动压缩，节省流量与等待时间。</li>
                                <li>继续完善多设备图片同步方案。</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
`;