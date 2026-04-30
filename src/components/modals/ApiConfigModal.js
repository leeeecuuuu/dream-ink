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
                    </div>
                </div>

                <!-- 本地文件夹存储 -->
                <div class="bg-surface-container border border-outline-variant p-4 rounded-xl space-y-3" id="localFsSection">
                    <div class="flex items-center justify-between">
                        <h4 class="text-sm font-bold text-primary flex items-center gap-1.5">
                            <span class="material-symbols-outlined text-[16px]">folder_open</span>
                            本地文件夹存储
                        </h4>
                        <span id="localFsBadge" class="text-[10px] font-bold px-2 py-0.5 rounded-full border hidden"></span>
                    </div>
                    <p class="text-[11px] text-on-surface-variant leading-relaxed">
                        绑定本地文件夹后，生成的图片和所有数据将直接写入磁盘，不再占用浏览器缓存空间。<br>
                        <span class="text-outline">仅支持 Chrome / Edge 86+ 浏览器。</span>
                    </p>
                    <div id="localFsPath" class="hidden text-[11px] font-mono text-on-surface bg-surface-container-highest border border-outline-variant rounded-md px-3 py-2 break-all"></div>
                    <div class="flex gap-2">
                        <button id="pickFolderBtn" class="flex-1 flex items-center justify-center gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 px-3 py-2 rounded-lg text-xs font-bold transition-colors">
                            <span class="material-symbols-outlined text-[16px]">folder</span> 选择文件夹
                        </button>
                        <button id="clearFolderBtn" class="hidden flex items-center justify-center gap-1.5 bg-error/10 hover:bg-error/20 text-error border border-error/20 px-3 py-2 rounded-lg text-xs font-bold transition-colors">
                            <span class="material-symbols-outlined text-[16px]">link_off</span> 解除绑定
                        </button>
                    </div>
                    <div id="localFsNotSupported" class="hidden text-[11px] text-error font-medium">
                        ⚠️ 当前浏览器不支持 File System Access API，请使用 Chrome 或 Edge。
                    </div>
                </div>

                <!-- 云存储同步（坚果云 WebDAV） -->
                <div class="space-y-3 pt-5 mt-5 border-t border-outline-variant">
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-primary text-[18px]">cloud_sync</span>
                        <span class="text-sm font-bold text-on-surface">云存储同步</span>
                        <span id="webdavBadge" class="hidden text-[10px] font-bold px-2 py-0.5 rounded-full border bg-success/10 text-success border-success/20">已配置</span>
                    </div>
                    <p class="text-[11px] text-on-surface-variant leading-relaxed">
                        通过 WebDAV 将历史记录、咒语书、配置同步到坚果云或其他支持 WebDAV 的云盘。
                        <br><strong class="text-on-surface">坚果云设置：</strong> 登录坚果云 → 账号信息 → 安全选项 → 第三方应用管理 → 添加应用密码
                    </p>
                    <div class="space-y-2">
                        <input type="url" id="webdavUrl" placeholder="WebDAV 地址 (如 https://dav.jianguoyun.com/dav/)" class="w-full bg-surface-container-highest border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface placeholder:text-outline focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors">
                        <input type="url" id="webdavProxy" placeholder="CORS 代理地址 (可选，用于解决跨域，如 Cloudflare Worker 地址)" class="w-full bg-surface-container-highest border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface placeholder:text-outline focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors">
                        <div class="flex gap-2">
                            <input type="text" id="webdavUser" placeholder="账号（邮箱）" class="flex-1 bg-surface-container-highest border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface placeholder:text-outline focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors">
                            <input type="password" id="webdavPass" placeholder="应用密码" class="flex-1 bg-surface-container-highest border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface placeholder:text-outline focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors">
                        </div>
                    </div>
                    <div class="flex gap-2 flex-wrap">
                        <button id="webdavTestBtn" class="flex items-center gap-1 bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant px-3 py-2 rounded-lg text-xs font-bold transition-colors">
                            <span class="material-symbols-outlined text-[14px]">wifi_tethering</span> 测试连接
                        </button>
                        <button id="webdavSaveBtn" class="flex items-center gap-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 px-3 py-2 rounded-lg text-xs font-bold transition-colors">
                            <span class="material-symbols-outlined text-[14px]">save</span> 保存凭据
                        </button>
                        <button id="webdavUploadBtn" class="flex items-center gap-1 bg-primary text-white px-3 py-2 rounded-lg text-xs font-bold hover:brightness-110 transition-all">
                            <span class="material-symbols-outlined text-[14px]">cloud_upload</span> 上传到云端
                        </button>
                        <button id="webdavDownloadBtn" class="flex items-center gap-1 bg-success/10 hover:bg-success/20 text-success border border-success/20 px-3 py-2 rounded-lg text-xs font-bold transition-colors">
                            <span class="material-symbols-outlined text-[14px]">cloud_download</span> 从云端恢复
                        </button>
                    </div>
                    <div id="webdavStatus" class="text-[11px] text-on-surface-variant font-medium hidden"></div>
                </div>

                <!-- 云存储同步（Gitee 码云 - 推荐移动端） -->
                <div class="space-y-3 pt-5 mt-5 border-t border-outline-variant">
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-primary text-[18px]">backup</span>
                        <span class="text-sm font-bold text-on-surface">Gitee 码云备份 (推荐移动端)</span>
                        <span id="giteeBadge" class="hidden text-[10px] font-bold px-2 py-0.5 rounded-full border bg-success/10 text-success border-success/20">已配置</span>
                    </div>
                    <p class="text-[11px] text-on-surface-variant leading-relaxed">
                        国内首选，原生支持跨域，无需代理即可在手机上同步配置和咒语书。
                        <br><strong class="text-on-surface">设置方法：</strong> 登录 Gitee → 设置 → 安全设置 → <a href="https://gitee.com/personal_access_tokens" target="_blank" class="text-primary underline">私人令牌</a> → 生成新令牌 (勾选 gists 权限)
                    </p>
                    <div class="space-y-2">
                        <input type="password" id="giteeToken" placeholder="Gitee 私人令牌 (Personal Access Token)" class="w-full bg-surface-container-highest border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface placeholder:text-outline focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors">
                        <input type="text" id="giteeGistId" placeholder="Gist ID (留空则自动创建)" class="w-full bg-surface-container-highest border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface placeholder:text-outline focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors">
                    </div>
                    <div class="flex gap-2 flex-wrap">
                        <button id="giteeSaveBtn" class="flex items-center gap-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 px-3 py-2 rounded-lg text-xs font-bold transition-colors">
                            <span class="material-symbols-outlined text-[14px]">save</span> 保存并初始化
                        </button>
                        <button id="giteeUploadBtn" class="flex items-center gap-1 bg-primary text-white px-3 py-2 rounded-lg text-xs font-bold hover:brightness-110 transition-all">
                            <span class="material-symbols-outlined text-[14px]">cloud_upload</span> 上传备份
                        </button>
                        <button id="giteeDownloadBtn" class="flex items-center gap-1 bg-success/10 hover:bg-success/20 text-success border border-success/20 px-3 py-2 rounded-lg text-xs font-bold transition-colors">
                            <span class="material-symbols-outlined text-[14px]">cloud_download</span> 恢复备份
                        </button>
                    </div>
                    <div id="giteeStatus" class="text-[11px] text-on-surface-variant font-medium hidden"></div>
                </div>

            </div>
            <div class="px-6 py-4 border-t border-outline-variant bg-surface-container text-right">
                <button id="applyApiConfigBtn" class="bg-primary text-on-primary-container px-6 py-2 rounded-lg font-bold text-sm hover:brightness-110 transition-all">确认 / 关闭</button>
            </div>
        </div>
    </div>
`;
