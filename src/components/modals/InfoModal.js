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
                <!-- Tabs -->
                <div class="flex border-b border-outline-variant px-6 gap-0">
                    <button class="info-tab active py-3 px-4 text-sm font-bold text-primary border-b-2 border-primary -mb-px transition-colors" data-target="tab-author">关于</button>
                    <button class="info-tab py-3 px-4 text-sm font-medium text-on-surface-variant hover:text-on-surface border-b-2 border-transparent -mb-px transition-colors" data-target="tab-tips">使用建议</button>
                    <button class="info-tab py-3 px-4 text-sm font-medium text-on-surface-variant hover:text-on-surface border-b-2 border-transparent -mb-px transition-colors" data-target="tab-log">更新日志</button>
                </div>
                <!-- Tab Panes -->
                <div class="p-6 overflow-y-auto text-sm text-on-surface leading-relaxed custom-scrollbar space-y-4">
                    <div id="tab-author" class="info-pane space-y-4">
                        <h4 class="font-bold text-on-surface text-base">关于本工具</h4>
                        <p class="text-on-surface-variant"><strong class="text-on-surface">DreamInk</strong> 是一个完全运行在浏览器中的客户端应用。利用 fetch API 直连 Google Gemini 或 OpenAI 兼容服务器进行文生图和图生图。</p>
                        <p class="text-on-surface-variant">零后端依赖，所有用户配置（API Key、提示词库、历史记录）均安全存储在你本地的浏览器 LocalStorage 中。</p>
                        <div class="pt-3 mt-3 border-t border-outline-variant space-y-2">
                            <p class="text-on-surface-variant"><strong class="text-on-surface">作者：</strong>Claude Opus 4.6 thinking | Gemini 3.1 pro</p>
                            <p class="text-on-surface-variant text-xs leading-relaxed"><strong class="text-on-surface">鸣谢名单：</strong> 青空莉的生图脚本 | Angela的生图前端 | kakaa的kavelai | Jasmine的热心 | 肚子疼的升级优化</p>
                        </div>
                    </div>
                    <div id="tab-tips" class="info-pane hidden space-y-4">
                        <h4 class="font-bold text-on-surface text-base">使用技巧</h4>
                        <div>
                            <p class="font-bold text-on-surface mb-2">1. 接口与网络配置</p>
                            <ul class="space-y-1.5 pl-4 list-disc text-on-surface-variant">
                                <li><strong class="text-on-surface">引擎切换：</strong>配置面板支持无缝切换 <strong class="text-on-surface">Google Gemini</strong> 和 <strong class="text-on-surface">OpenAI (GPT)</strong> 核心。</li>
                                <li><strong class="text-on-surface">地址配置：</strong>使用 Gemini 时 Base URL 默认为 <code class="bg-surface-container px-1.5 py-0.5 rounded text-xs">https://generativelanguage.googleapis.com</code>。若使用 GPT 则请填入对应的 OpenAI 代理 URL。</li>
                                <li><strong class="text-on-surface">使用代理：</strong>如果你有自建的 API 代理，将 Base URL 替换为你的代理地址即可解决跨域和网络限制问题。</li>
                            </ul>
                        </div>
                        <div>
                            <p class="font-bold text-on-surface mb-2">2. 提示词编写指南</p>
                            <ul class="space-y-1.5 pl-4 list-disc text-on-surface-variant">
                                <li><strong class="text-on-surface">黄金公式：</strong>主体描述 + 环境背景 + 细节补充 + 光影效果 + 艺术风格。<br><span class="text-xs opacity-70">例如：一只戴着墨镜的柴犬（主体），在赛博朋克城市的街道上（环境），下着霓虹色的雨（细节），电影级光影（光影），3D渲染/虚幻引擎5（风格）。</span></li>
                                <li><strong class="text-on-surface">语言选择：</strong>虽然模型支持中文，但在要求复杂画面、精细细节时，使用<strong>英文提示词</strong>通常能获得更精准、更高质量的生成结果。</li>
                            </ul>
                        </div>
                        <div>
                            <p class="font-bold text-on-surface mb-2">3. 垫图、重绘与模型特性</p>
                            <ul class="space-y-1.5 pl-4 list-disc text-on-surface-variant">
                                <li><strong class="text-on-surface">多模型参考图支持：</strong>在左侧上传图片后，AI 会参考原图的构图、色彩和轮廓。现已支持 GPT image 2 (codex) 模型的并发垫图生成逻辑。你可以上传最多 10 张图片作为灵感参考。</li>
                                <li><strong class="text-on-surface">局部修改：</strong>在生成的图片上点击"重绘"，输入你想要修改的细节，AI 会在保留原图主体的基础上尝试调整。</li>
                                <li><strong class="text-on-surface">注意事项：</strong>重绘并不是真正意义的重绘，只是起到将生成的图片重新发送至模型进行处理的效果，省去了保存后重传的步骤。</li>
                                <li><strong class="text-on-surface">并发历史记录：</strong>当批量生成（生成数量 > 1）时，系统现在会精准追踪每一张并发生成的图像，并将其与使用的垫图、参数一起完整保存到右侧的历史记录中，不再遗漏。</li>
                            </ul>
                        </div>
                        <div>
                            <p class="font-bold text-on-surface mb-2">4. 性能与限制</p>
                            <ul class="space-y-1.5 pl-4 list-disc text-on-surface-variant">
                                <li><strong class="text-on-surface">请求频率限制：</strong>如果遇到 <code class="bg-surface-container px-1.5 py-0.5 rounded text-xs">429 (Too Many Requests)</code> 错误，说明请求过于频繁。建议适当降低"生成数量"，或稍等片刻再试。</li>
                            </ul>
                        </div>
                    </div>
                    <div id="tab-log" class="info-pane hidden space-y-4">
                        <h4 class="font-bold text-on-surface text-base">最新动态</h4>

                        <div class="pb-4 border-b border-outline-variant/50">
                            <p class="font-bold text-primary mb-1">2026-04-29</p>
                            <p class="text-[11px] text-on-surface-variant mb-2 italic">底层大手术，同步更丝滑：主要是让手机端和电脑端都更好看、好用。</p>
                            <ul class="space-y-1.5 pl-4 list-disc text-on-surface-variant text-xs">
                                <li>☁️ <strong class="text-on-surface">Gitee 同步来啦！</strong> 手机上也能一键备份了。去码云申请个令牌，咒语书和配置轻松上云，多端互通不再是梦。</li>
                                <li>⚡ <strong class="text-on-surface">代码底层大整改。</strong> 全部重构成了模块化架构，现在响应更灵敏，彻底告别了之前的“面条代码”卡顿感。</li>
                                <li>🖼️ <strong class="text-on-surface">画廊按键变美了。</strong> 换成了通透的毛玻璃样式。电脑上悬浮才出现，手机上常驻但不挡图，兼顾美观和好按。</li>
                                <li>🔍 <strong class="text-on-surface">封面从此不糊了。</strong> 优化了缩略图生成算法，清晰度翻倍，历史记录和咒语书里的封面现在非常精致。</li>
                                <li>🛡️ <strong class="text-on-surface">运行更稳当。</strong> 解决了偶尔白屏或报错没反应的毛病，加了骨架屏加载动画，用起来更有“丝滑感”。</li>
                                <li>📶 <strong class="text-on-surface">断网也能看。</strong> 支持 PWA 安装到桌面或手机主屏，离线状态下也能翻看历史记录和编辑咒语。</li>
                            </ul>
                        </div>

                        <div class="pb-4 border-b border-outline-variant/50">
                            <p class="font-bold text-primary mb-1">2026-04-25</p>
                            <p class="text-[11px] text-on-surface-variant mb-2 italic">这次更新较大，主要解决了意外丢失数据的难题。</p>
                            <ul class="space-y-1.5 pl-4 list-disc text-on-surface-variant text-xs">
                                <li>🎉 <strong class="text-on-surface">全面焕新！</strong>在肚子疼的支持下追加了gpt模式，更名为DreamInk！</li>
                                <li>🗂️ <strong class="text-on-surface">图片能存到硬盘。</strong>在配置里授权一个本地文件夹，之后生成的图、历史、咒语书通通写到你电脑里，清缓存也不会丢。</li>
                                <li>⚙️ <strong class="text-on-surface">记住API 配置。</strong>Key、接口地址这些会自动保存到本地。</li>
                                <li>🖼️ <strong class="text-on-surface">历史记录放大图片。</strong>以前点开历史详情放大是模糊的小图，现在加载的是原图。</li>
                                <li>📎 <strong class="text-on-surface">垫图保存。</strong>历史里能看到当时用的参考垫图；刷新页面后左边的垫图也会自动恢复。</li>
                                <li>📖 <strong class="text-on-surface">咒语书卡片有图了。</strong>从历史收藏咒语时，图片跟着一起存进去。</li>
                                <li>⏱️ <strong class="text-on-surface">生成时能看到等待时长。</strong>状态栏和图片占位格里会实时显示秒数。</li>
                                <li>🖼️ <strong class="text-on-surface">历史小图立刻就能看到。</strong>新生成的图马上出现在历史里，不再需要刷新才能显示。</li>
                            </ul>
                        </div>

                        <div class="pb-4 border-b border-outline-variant/50">
                            <p class="font-bold text-primary mb-1">2026-04-25(早些时候）</p>
                            <p class="text-[11px] text-on-surface-variant mb-2 italic">主要把"选尺寸"从玄学变成了简单易懂的样子。</p>
                            <ul class="space-y-1.5 pl-4 list-disc text-on-surface-variant text-xs">
                                <li>📐 <strong class="text-on-surface">画幅选择大改版。</strong>下拉菜单重新设计了，分了组、加了标注，横版竖版正方形一眼就能找到，支持到 4K。</li>
                                <li>✏️ <strong class="text-on-surface">可自定义尺寸。</strong>宽和高现在是两个独立的输入框，告别"1024x768"这种容易手抖打错的格式。</li>
                                <li>🔀 <strong class="text-on-surface">切换引擎不会互相覆盖模型名。</strong>Gemini 和 GPT 各自记自己的模型配置，切来切去不会把对方盖掉。</li>
                                <li>🔍 <strong class="text-on-surface">放大看图不飘。</strong>以前滚轮缩放图片会漂移跑位，现在跟着鼠标缩放，体验更佳。</li>
                            </ul>
                        </div>

                        <div class="pb-4 border-b border-outline-variant/50">
                            <p class="font-bold text-primary mb-1">2026-04-25（更早）</p>
                            <p class="text-[11px] text-on-surface-variant mb-2 italic">大改版，界面全新出炉。</p>
                            <ul class="space-y-1.5 pl-4 list-disc text-on-surface-variant text-xs">
                                <li>🎨 全新界面，深色模式，跟系统走自动切亮色/暗色。</li>
                                <li>⚡ 同时支持 Gemini 和 GPT 两套生图引擎，左上角一键切换。</li>
                                <li>📦 批量生成多张图，每一张都会完整记到历史里。</li>
                                <li>🔖 历史详情里可以直接复制咒语，或者一键把参数填回左边重新生成。</li>
                            </ul>
                        </div>

                        <div class="pb-4 border-b border-outline-variant/50">
                            <p class="font-bold text-primary mb-1">2026-03-26 · 诞生</p>
                            <ul class="space-y-1.5 pl-4 list-disc text-on-surface-variant text-xs">
                                <li>🎉 BanavelAi Image 开张了！欢迎使用。</li>
                                <li>有什么想要的功能或者 Bug，欢迎反馈～</li>
                                <li>人话：Antigravity 又 CD 了，有啥问题下周再说。</li>
                            </ul>
                        </div>

                        <div>
                            <p class="font-bold text-on-surface-variant mb-2">🔮 接下来想做的...</p>
                            <ul class="space-y-1 pl-4 list-disc text-on-surface-variant text-xs opacity-70">
                                <li>上传图片前自动压缩，省流量省时间。</li>
                                <li>多台设备之间图片同步（在想方案，别催）。</li>
                            </ul>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    </div>
`;
