export const RedrawModal = `
    <!-- 重绘模态框 -->
    <div class="modal-overlay" id="redrawModal">
        <div class="redraw-content">
            <div class="flex justify-between items-center mb-5">
                <h3 class="font-bold text-on-surface m-0 flex items-center gap-2">
                    <span class="material-symbols-outlined text-primary text-[20px]">brush</span> 局部重绘
                </h3>
                <button onclick="document.getElementById('redrawModal').style.display='none'" class="material-symbols-outlined text-outline hover:text-on-surface transition-colors">close</button>
            </div>
            <div class="bg-surface-container-lowest border border-outline-variant rounded-xl h-40 flex items-center justify-center overflow-hidden mb-5">
                <img id="redrawSourceThumb" src="" class="max-h-full max-w-full object-contain">
            </div>
            <div class="space-y-2 mb-5">
                <label class="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">修改建议</label>
                <input type="text" id="redrawPrompt" placeholder="例如：赛博朋克风格 / 加入下雨效果..." maxlength="50" class="w-full bg-surface-container-lowest border border-outline-variant rounded-lg text-sm px-3 py-2 text-on-surface focus:ring-1 focus:border-primary">
            </div>
            <button id="confirmRedrawBtn" class="w-full bg-primary text-on-primary-container font-bold py-3 rounded-lg hover:brightness-110 transition-all">确认重绘</button>
        </div>
    </div>
`;
