export const HistoryDetailModal = `
    <!-- 历史详情模态框 -->
    <div class="modal-overlay" id="historyDetailModal">
        <div class="modal-content !max-w-[1000px] !w-[90vw] flex overflow-hidden">
            <!-- 移动端专属：顶部垫图缩略栏 -->
            <div id="hdMobileRefBar" style="display:none"></div>
            <!-- 成品图区 -->
            <div id="hdImageSection" class="w-1/2 bg-surface-container-lowest flex items-center justify-center p-4 border-r border-outline-variant">
                <img id="hdImage" src="" class="max-w-full max-h-[80vh] object-contain rounded-lg shadow-lg cursor-zoom-in">
            </div>
            <div class="w-1/2 p-6 flex flex-col h-[80vh]">
                <div class="flex justify-between items-center mb-6">
                    <div>
                        <div class="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold mb-1">详情</div>
                        <div id="hdDate" class="text-lg font-bold text-on-surface"></div>
                    </div>
                    <button id="hdCloseBtn" onclick="document.getElementById('historyDetailModal').style.display='none'" class="material-symbols-outlined text-outline hover:text-on-surface transition-colors">close</button>
                </div>
                <div class="flex-1 overflow-y-auto space-y-6 custom-scrollbar pr-2">
                    <div class="space-y-2">
                        <label class="text-[11px] font-bold tracking-widest text-on-surface-variant">模型 / 参数</label>
                        <div class="flex gap-2 flex-wrap">
                            <span id="hdModel" class="bg-surface-container border border-outline-variant px-2.5 py-1 rounded-md text-xs text-on-surface-variant"></span>
                            <span id="hdRatio" class="bg-surface-container border border-outline-variant px-2.5 py-1 rounded-md text-xs text-on-surface-variant"></span>
                            <span id="hdQuality" class="bg-surface-container border border-outline-variant px-2.5 py-1 rounded-md text-xs text-on-surface-variant"></span>
                        </div>
                    </div>
                    <div class="space-y-2">
                        <label class="text-[11px] font-bold tracking-widest text-on-surface-variant">画面描述</label>
                        <textarea id="hdPrompt" readonly class="w-full h-32 bg-surface-container-lowest border border-outline-variant rounded-xl p-4 text-sm text-on-surface resize-none focus:ring-0 custom-scrollbar"></textarea>
                    </div>
                    <!-- 移动端专属：成品图展示区（桌面端隐藏） -->
                    <div id="hdMobileGeneratedImg" style="display:none" class="rounded-xl overflow-hidden border border-outline-variant cursor-zoom-in">
                        <img id="hdMobileImage" src="" alt="成品图" class="w-full object-contain">
                    </div>
                    <div id="hdRefImagesGroup" class="space-y-2" style="display:none">
                        <label class="text-[11px] font-bold tracking-widest text-on-surface-variant">参考垫图</label>
                        <div id="hdRefImages" class="flex gap-2 flex-wrap"></div>
                    </div>
                </div>
                <div class="pt-4 mt-auto border-t border-outline-variant flex justify-between gap-2">
                    <button id="hdDelBtn" class="text-error hover:bg-error/10 px-3 py-2 rounded-lg font-bold text-sm transition-colors flex items-center gap-1">
                        <span class="material-symbols-outlined text-[18px]">delete</span> 删除
                    </button>
                    <div class="flex gap-2">
                        <button id="hdCopyBtn" class="text-on-surface-variant hover:text-on-surface bg-surface-container hover:bg-surface-container-high border border-outline-variant px-3 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-1">
                            <span class="material-symbols-outlined text-[18px]">content_copy</span> 复制焚诀
                        </button>
                        <button id="hdAddLibBtn" class="text-on-surface-variant hover:text-primary bg-surface-container hover:bg-primary/10 border border-outline-variant px-3 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-1">
                            <span class="material-symbols-outlined text-[18px]">bookmark_add</span> 收藏
                        </button>
                        <button id="hdApplyBtn" class="bg-primary text-on-primary-container hover:brightness-110 px-3 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-1">
                            <span class="material-symbols-outlined text-[18px]">download_for_offline</span> 应用参数
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
`;
