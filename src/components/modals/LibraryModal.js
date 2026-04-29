export const LibraryModal = `
    <!-- 咒语书模态框 -->
    <div class="modal-overlay" id="libraryModal">
        <div class="modal-content !w-[85vw] !max-w-[1200px] !h-[80vh]">
            <div class="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-lowest">
                <h3 class="font-bold text-lg text-on-surface flex items-center gap-2">
                    <span class="material-symbols-outlined text-primary">menu_book</span> 咒语书
                </h3>
                <button class="material-symbols-outlined text-outline hover:text-on-surface transition-colors text-2xl" id="closeLibraryBtn">close</button>
            </div>
            <div class="flex flex-1 overflow-hidden">
                <div class="w-60 border-r border-outline-variant bg-surface-container p-4 flex flex-col">
                    <div class="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mb-4">分类目录</div>
                    <div id="folderList" class="flex-1 overflow-y-auto space-y-1 custom-scrollbar"></div>
                    <div class="mt-4 flex gap-2">
                        <input type="text" id="newFolderInput" placeholder="新分类..." class="w-full bg-surface-container-lowest border border-outline-variant rounded-md text-xs px-2 py-1.5 text-on-surface focus:ring-1 focus:border-primary">
                        <button id="addFolderBtn" class="bg-primary/10 text-primary hover:bg-primary/20 px-2 rounded-md transition-colors">
                            <span class="material-symbols-outlined text-[16px] block">add</span>
                        </button>
                    </div>
                </div>
                <div class="flex-1 p-6 overflow-y-auto bg-surface-container-lowest custom-scrollbar relative">
                    <div class="flex justify-between items-center mb-6">
                        <h4 id="currentFolderName" class="font-bold text-on-surface m-0 text-base">未选择分类</h4>
                    </div>
                    <div id="promptGrid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"></div>
                </div>
            </div>
            <div class="px-6 py-4 border-t border-outline-variant bg-surface-container flex items-center gap-4">
                <input type="text" id="newPromptName" placeholder="提示词名称 (必填)" class="w-40 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm px-3 py-2 focus:ring-1 focus:border-primary">
                <input type="text" id="newPromptContent" placeholder="咒语内容 (必填)" class="flex-1 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm px-3 py-2 focus:ring-1 focus:border-primary">
                <div class="relative">
                    <label for="newPromptImg" class="cursor-pointer flex items-center gap-1 bg-surface-container-highest hover:bg-outline-variant/50 border border-outline-variant rounded-lg px-4 py-2 text-sm font-medium text-on-surface transition-colors">
                        <span class="material-symbols-outlined text-[18px]">image</span> 附图
                    </label>
                    <input type="file" id="newPromptImg" accept="image/*" class="hidden">
                    <span id="thumbStatus" class="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] text-success font-bold bg-success/10 px-2 py-0.5 rounded whitespace-nowrap hidden">已就绪</span>
                </div>
                <button id="addPromptBtn" class="bg-primary text-on-primary-container px-6 py-2 rounded-lg font-bold text-sm hover:brightness-110 transition-all flex items-center gap-1">
                    <span class="material-symbols-outlined text-[18px]">save</span> 保存
                </button>
            </div>
        </div>
    </div>
`;
