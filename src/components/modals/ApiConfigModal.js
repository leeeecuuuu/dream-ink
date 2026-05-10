export const ApiConfigModal = `
    <!-- API 配置模态框 -->
    <div class="modal-overlay" id="apiConfigModal">
        <div class="modal-content !w-[500px] !max-w-[90vw]">
            <div class="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-lowest">
                <h3 class="font-bold text-on-surface m-0 flex items-center gap-2">
                    <span class="material-symbols-outlined text-primary">settings_applications</span> API配置
                </h3>
                <button class="material-symbols-outlined text-outline hover:text-on-surface transition-colors" id="closeApiConfigBtn">close</button>
            </div>
            <div class="p-6 overflow-y-auto bg-surface-container-lowest space-y-6">
                <!-- 配置管理 -->
                <div class="bg-surface-container border border-outline-variant p-4 rounded-xl">
                    <h4 class="text-sm font-bold text-primary mb-3">配置预设</h4>
                    <div class="space-y-3">
                        <select id="apiProfileSelect" class="w-full bg-surface-container-lowest border border-outline-variant rounded-md text-xs text-on-surface py-2 px-3 focus:ring-1 focus:border-primary">
                            <option value="">-- 选择已保存的配置 --</option>
                        </select>
                        <div class="flex gap-2">
                            <input type="text" id="apiProfileName" placeholder="配置名称" class="flex-1 bg-surface-container-lowest border border-outline-variant rounded-md text-xs px-2 py-1.5 focus:ring-1 focus:border-primary text-on-surface">
                            <button id="saveProfileBtn" class="bg-surface-container-highest text-success hover:bg-success/10 px-3 rounded-md text-xs font-bold transition-colors">保存</button>
                            <button id="delProfileBtn" class="bg-surface-container-highest text-error hover:bg-error/10 px-3 rounded-md text-xs font-bold transition-colors">删除</button>
                        </div>
                    </div>
                </div>

                <!-- 接口信息 -->
                <div class="bg-surface-container border border-outline-variant p-4 rounded-xl space-y-4">
                    <h4 class="text-sm font-bold text-primary mb-1">服务设定</h4>

                    <!-- Banana · Gemini 独立配置 -->
                    <div class="space-y-3 p-3 rounded-lg bg-surface-container-lowest border border-primary/15">
                        <div class="flex items-center gap-2">
                            <span class="inline-flex items-center gap-1 text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                                <span class="material-symbols-outlined text-[11px]">auto_awesome</span> Banana · Gemini
                            </span>
                            <span class="text-[10px] text-outline">独立接口配置</span>
                        </div>
                        <div class="space-y-1.5">
                            <label class="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">接口地址</label>
                            <input type="text" id="geminiBaseUrl" placeholder="例如：https://generativelanguage.googleapis.com" class="w-full bg-surface-container border border-outline-variant rounded-md text-sm px-3 py-2 text-on-surface focus:ring-1 focus:border-primary">
                        </div>
                        <div class="space-y-1.5">
                            <label class="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">密钥 (API Key)</label>
                            <input type="password" id="geminiApiKey" placeholder="AIzaSy..." class="w-full bg-surface-container border border-outline-variant rounded-md text-sm px-3 py-2 text-on-surface focus:ring-1 focus:border-primary">
                        </div>
                        <div class="space-y-1.5 mt-2">
                            <label class="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Banana 请求格式</label>
                            <select id="bananaApiFormat" class="w-full bg-surface-container-lowest border border-outline-variant rounded-md text-xs text-on-surface py-2 px-3 focus:ring-1 focus:border-primary cursor-pointer">
                                <option value="gemini" selected>Gemini 原生（推荐 gemini-3-pro-image-preview / models/:generateContent）</option>
                                <option value="openai">OpenAI 兼容（第三方中转 /v1/images 或 /v1/chat/completions）</option>
                            </select>
                            <p class="text-[10px] text-outline leading-relaxed">使用 chatapi.hakoyu.com 或 gemini-3-pro-image-preview|神秘渠道时，建议选择 Gemini 原生，才能按 imageConfig.imageSize=2K/4K 请求高清图。</p>
                        </div>
                    </div>

                    <!-- GPT Image-2 独立配置 -->
                    <div class="space-y-3 p-3 rounded-lg bg-surface-container-lowest border border-success/15">
                        <div class="flex items-center gap-2">
                            <span class="inline-flex items-center gap-1 text-[10px] font-bold bg-success/10 text-success px-2 py-0.5 rounded-full border border-success/20">
                                <span class="material-symbols-outlined text-[11px]">image</span> GPT Image-2
                            </span>
                            <span class="text-[10px] text-outline">独立接口配置</span>
                        </div>
                        <div class="space-y-1.5">
                            <label class="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">接口地址</label>
                            <input type="text" id="openaiBaseUrl" placeholder="例如：https://api.openai.com" class="w-full bg-surface-container border border-outline-variant rounded-md text-sm px-3 py-2 text-on-surface focus:ring-1 focus:border-primary">
                        </div>
                        <div class="space-y-1.5">
                            <label class="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">密钥 (API Key)</label>
                            <input type="password" id="openaiApiKey" placeholder="sk-..." class="w-full bg-surface-container border border-outline-variant rounded-md text-sm px-3 py-2 text-on-surface focus:ring-1 focus:border-primary">
                        </div>
                    </div>
                    <!-- 隐藏的 apiTypeSelect，由引擎切换器驱动，不再暴露给用户 -->
                    <select id="apiTypeSelect" class="hidden">
                        <option value="gemini">gemini</option>
                        <option value="openai">openai</option>
                    </select>
                    <!-- 隐藏的通用 modelInput / modelSelect，由下方双引擎配置驱动 -->
                    <select id="modelSelect" class="hidden"></select>
                    <input type="text" id="modelInput" class="hidden">

                    <!-- GPT 请求格式选择 -->
                    <div class="space-y-1.5 mt-2">
                        <label class="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">GPT 请求格式</label>
                        <select id="gptApiFormat" class="w-full bg-surface-container-lowest border border-outline-variant rounded-md text-xs text-on-surface py-2 px-3 focus:ring-1 focus:border-primary cursor-pointer">
                            <option value="images" selected>Images API (默认，兼容大多数代理)</option>
                            <option value="responses">Responses API (/v1/responses)</option>
                            <option value="chat">Chat Completions (适合纯聊天代理)</option>
                        </select>
                        <p class="text-[10px] text-outline leading-relaxed">切换 Gemini 引擎时此选项无效。Responses 需接口/模型支持 image_generation tool；响应格式自动识别，无需额外配置。</p>
                    </div>
                </div>

                <!-- 双引擎模型配置 -->
                <div class="bg-surface-container border border-outline-variant p-4 rounded-xl space-y-4">
                    <div class="flex items-center justify-between mb-1">
                        <h4 class="text-sm font-bold text-primary">引擎模型配置</h4>
                    </div>
                    <div class="text-[10px] text-on-surface-variant -mt-2">两个引擎使用各自的 API 配置、模型列表与模型选择，互不影响。</div>

                    <!-- Banana · Gemini -->
                    <div class="space-y-2 p-3 rounded-lg bg-surface-container-lowest border border-primary/15">
                        <div class="flex items-center justify-between gap-2">
                            <div class="flex items-center gap-2">
                                <span class="inline-flex items-center gap-1 text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                                    <span class="material-symbols-outlined text-[11px]">auto_awesome</span> Banana · Gemini
                                </span>
                                <label class="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">模型</label>
                            </div>
                            <button id="fetchGeminiModelsBtn" class="bg-surface-container-highest hover:bg-primary/10 text-on-surface hover:text-primary border border-outline-variant px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0">
                                <div class="spinner"></div>
                                <span class="material-symbols-outlined text-[14px] fetch-text-icon">sync</span>
                                <span class="fetch-text">获取 Banana 模型</span>
                            </button>
                        </div>
                        <div id="modelGeminiStatus" class="text-[10px] text-on-surface-variant">填入 Banana 模型名称，或单独获取 Gemini 模型列表</div>
                        <!-- 获取列表后显示下拉，默认显示文本框 -->
                        <select id="modelGeminiSelect" class="hidden w-full bg-surface-container-lowest border border-outline-variant rounded-md text-sm px-3 py-2 text-on-surface focus:ring-1 focus:border-primary font-mono text-xs"></select>
                        <input type="text" id="modelGemini" placeholder="gemini-3-pro-image-preview|神秘渠道"
                            class="w-full bg-surface-container border border-outline-variant rounded-md text-sm px-3 py-2 text-on-surface focus:ring-1 focus:border-primary font-mono text-xs">
                        <input type="text" id="customModelsGemini" placeholder="Banana 自定义下拉模型库 (多个用英文逗号分隔，留空则获取全量模型)" title="在此填入 Banana 常用的固定模型（如 gemini-2.0-flash, gemini-1.5-pro），点击本区【获取 Banana 模型】后，下拉框将只显示你填写的这些模型。" class="w-full bg-surface-container-highest border border-outline-variant rounded-md px-3 py-1.5 text-[10px] text-on-surface placeholder:text-outline/60 focus:border-primary mt-1">
                    </div>

                    <!-- GPT Image-2 -->
                    <div class="space-y-2 p-3 rounded-lg bg-surface-container-lowest border border-success/15">
                        <div class="flex items-center justify-between gap-2">
                            <div class="flex items-center gap-2">
                                <span class="inline-flex items-center gap-1 text-[10px] font-bold bg-success/10 text-success px-2 py-0.5 rounded-full border border-success/20">
                                    <span class="material-symbols-outlined text-[11px]">image</span> GPT Image-2
                                </span>
                                <label class="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">模型</label>
                            </div>
                            <button id="fetchOpenaiModelsBtn" class="bg-surface-container-highest hover:bg-success/10 text-on-surface hover:text-success border border-outline-variant px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0">
                                <div class="spinner"></div>
                                <span class="material-symbols-outlined text-[14px] fetch-text-icon">sync</span>
                                <span class="fetch-text">获取 GPT 模型</span>
                            </button>
                        </div>
                        <div id="modelOpenaiStatus" class="text-[10px] text-on-surface-variant">填入 GPT Image-2 模型名称，或单独获取 OpenAI 兼容模型列表</div>
                        <!-- 获取列表后显示下拉，默认显示文本框 -->
                        <select id="modelOpenaiSelect" class="hidden w-full bg-surface-container-lowest border border-outline-variant rounded-md text-sm px-3 py-2 text-on-surface focus:ring-1 focus:border-primary font-mono text-xs"></select>
                        <input type="text" id="modelOpenai" placeholder="gpt-image-1"
                            class="w-full bg-surface-container border border-outline-variant rounded-md text-sm px-3 py-2 text-on-surface focus:ring-1 focus:border-primary font-mono text-xs">
                        <input type="text" id="customModelsOpenai" placeholder="GPT 自定义下拉模型库 (多个用英文逗号分隔，留空则获取全量模型)" title="在此填入 GPT / OpenAI 常用的固定模型（如 gpt-image-1, gpt-4o, dall-e-3），点击本区【获取 GPT 模型】后，下拉框将只显示你填写的这些模型。" class="w-full bg-surface-container-highest border border-outline-variant rounded-md px-3 py-1.5 text-[10px] text-on-surface placeholder:text-outline/60 focus:border-primary mt-1">
                    </div>
                </div>



            </div>
            <div class="px-6 py-4 border-t border-outline-variant bg-surface-container text-right">
                <button id="applyApiConfigBtn" class="bg-primary text-on-primary-container px-6 py-2 rounded-lg font-bold text-sm hover:brightness-110 transition-all">确认 / 关闭</button>
            </div>
        </div>
    </div>
`;
