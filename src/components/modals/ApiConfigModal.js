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
                    <div class="space-y-1.5">
                        <label class="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">接口地址</label>
                        <input type="text" id="baseUrl" placeholder="例如：https://generativelanguage.googleapis.com" class="w-full bg-surface-container-lowest border border-outline-variant rounded-md text-sm px-3 py-2 text-on-surface focus:ring-1 focus:border-primary">
                    </div>
                    <div class="space-y-1.5">
                        <label class="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">密钥 (API Key)</label>
                        <input type="password" id="apiKey" placeholder="sk-AIzaSy..." class="w-full bg-surface-container-lowest border border-outline-variant rounded-md text-sm px-3 py-2 text-on-surface focus:ring-1 focus:border-primary">
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
                            <option value="chat">Chat Completions (适合纯聊天代理)</option>
                        </select>
                        <p class="text-[10px] text-outline leading-relaxed">切换 Gemini 引擎时此选项无效。响应格式自动识别，无需额外配置。</p>
                    </div>
                </div>

                <!-- 双引擎模型配置 -->
                <div class="bg-surface-container border border-outline-variant p-4 rounded-xl space-y-4">
                    <div class="flex items-center justify-between mb-1">
                        <h4 class="text-sm font-bold text-primary">引擎模型配置</h4>
                        <button id="fetchModelsBtn" class="bg-surface-container-highest hover:bg-primary/10 text-on-surface hover:text-primary border border-outline-variant px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5">
                            <div class="spinner"></div>
                            <span class="material-symbols-outlined text-[14px] fetch-text-icon">sync</span>
                            <span class="fetch-text">获取模型列表</span>
                        </button>
                    </div>
                    <div id="modelStatus" class="text-[10px] text-on-surface-variant -mt-2">填入模型名称，或点击右上角按钮自动获取</div>

                    <!-- Banana · Gemini -->
                    <div class="space-y-1.5">
                        <div class="flex items-center gap-2">
                            <span class="inline-flex items-center gap-1 text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                                <span class="material-symbols-outlined text-[11px]">auto_awesome</span> Banana · Gemini
                            </span>
                            <label class="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">模型</label>
                        </div>
                        <!-- 获取列表后显示下拉，默认显示文本框 -->
                        <select id="modelGeminiSelect" class="hidden w-full bg-surface-container-lowest border border-outline-variant rounded-md text-sm px-3 py-2 text-on-surface focus:ring-1 focus:border-primary font-mono text-xs"></select>
                        <input type="text" id="modelGemini" placeholder="gemini-2.0-flash-preview-image-generation"
                            class="w-full bg-surface-container-lowest border border-outline-variant rounded-md text-sm px-3 py-2 text-on-surface focus:ring-1 focus:border-primary font-mono text-xs">
                        <input type="text" id="customModelsGemini" placeholder="自定义下拉模型库 (多个用英文逗号分隔，留空则获取全量模型)" title="在此填入常用的固定模型（如 gemini-2.0-flash, gemini-1.5-pro），点击右上角【获取模型列表】后，下拉框将只显示你填写的这些模型。不再需要从几十个列表里找。" class="w-full bg-surface-container-highest border border-outline-variant rounded-md px-3 py-1.5 text-[10px] text-on-surface placeholder:text-outline/60 focus:border-primary mt-1">
                    </div>

                    <!-- GPT Image-2 -->
                    <div class="space-y-1.5">
                        <div class="flex items-center gap-2">
                            <span class="inline-flex items-center gap-1 text-[10px] font-bold bg-success/10 text-success px-2 py-0.5 rounded-full border border-success/20">
                                <span class="material-symbols-outlined text-[11px]">image</span> GPT Image-2
                            </span>
                            <label class="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">模型</label>
                        </div>
                        <!-- 获取列表后显示下拉，默认显示文本框 -->
                        <select id="modelOpenaiSelect" class="hidden w-full bg-surface-container-lowest border border-outline-variant rounded-md text-sm px-3 py-2 text-on-surface focus:ring-1 focus:border-primary font-mono text-xs"></select>
                        <input type="text" id="modelOpenai" placeholder="gpt-image-1"
                            class="w-full bg-surface-container-lowest border border-outline-variant rounded-md text-sm px-3 py-2 text-on-surface focus:ring-1 focus:border-primary font-mono text-xs">
                        <input type="text" id="customModelsOpenai" placeholder="自定义下拉模型库 (多个用英文逗号分隔，留空则获取全量模型)" title="在此填入常用的固定模型（如 gpt-4o, dall-e-3），点击右上角【获取模型列表】后，下拉框将只显示你填写的这些模型。不再需要从几十个列表里找。" class="w-full bg-surface-container-highest border border-outline-variant rounded-md px-3 py-1.5 text-[10px] text-on-surface placeholder:text-outline/60 focus:border-primary mt-1">
                    </div>
                </div>



            </div>
            <div class="px-6 py-4 border-t border-outline-variant bg-surface-container text-right">
                <button id="applyApiConfigBtn" class="bg-primary text-on-primary-container px-6 py-2 rounded-lg font-bold text-sm hover:brightness-110 transition-all">确认 / 关闭</button>
            </div>
        </div>
    </div>
`;
