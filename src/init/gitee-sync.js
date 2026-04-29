/**
 * gitee-sync.js — Gitee 同步初始化
 */

import { $, ls } from '../utils/helpers.js';
import { gitee } from '../storage/gitee.js';
import { showToast } from '../ui/toast.js';
import { bus } from '../utils/event-bus.js';

export function initGitee() {
    // 恢复凭据
    if ($('giteeToken')) $('giteeToken').value = gitee.token;
    if ($('giteeGistId')) $('giteeGistId').value = gitee.gistId;
    if (gitee.isConfigured()) $('giteeBadge')?.classList.remove('hidden');

    // 保存并初始化
    $('giteeSaveBtn').onclick = async () => {
        const token = $('giteeToken').value.trim();
        const gistId = $('giteeGistId').value.trim();
        if (!token) return showToast('请输入 Gitee 私人令牌', 'error');

        gitee.saveConfig(token, gistId);
        showToast('Gitee 配置已保存');
        $('giteeBadge')?.classList.remove('hidden');

        // 如果没有 Gist ID，尝试查找或创建
        if (!gistId) {
            const st = $('giteeStatus');
            st.textContent = '正在查找已有的 DreamInk 备份...';
            st.classList.remove('hidden');
            try {
                const existing = await gitee.findExistingGist();
                if (existing) {
                    gitee.saveConfig(token, existing.id);
                    $('giteeGistId').value = existing.id;
                    st.textContent = '✅ 已关联到现有备份';
                    showToast('已自动关联到现有的 Gist 备份');
                } else {
                    st.textContent = '未找到备份，将在首次上传时创建';
                }
            } catch (e) {
                st.textContent = '❌ 初始化失败: ' + e.message;
                st.className = 'text-[11px] font-bold text-error';
            }
        }
    };

    // 上传
    $('giteeUploadBtn').onclick = async () => {
        if (!gitee.isConfigured()) return showToast('请先配置 Gitee 令牌', 'error');
        const st = $('giteeStatus');
        st.textContent = '正在备份到 Gitee...';
        st.classList.remove('hidden');
        try {
            await gitee.uploadAll();
            st.textContent = '✅ 备份成功';
            st.className = 'text-[11px] font-bold text-success';
            showToast('☁️ 已成功备份到 Gitee');
            if ($('giteeGistId')) $('giteeGistId').value = gitee.gistId;
        } catch (e) {
            st.textContent = '❌ 备份失败: ' + e.message;
            st.className = 'text-[11px] font-bold text-error';
            showToast(e.message, 'error');
        }
    };

    // 下载
    $('giteeDownloadBtn').onclick = async () => {
        if (!gitee.isConfigured() || !gitee.gistId) return showToast('请先配置并关联 Gist ID', 'error');
        if (!confirm('从 Gitee 恢复将合并远端数据到本地。继续？')) return;
        
        const st = $('giteeStatus');
        st.textContent = '正在从 Gitee 恢复...';
        st.classList.remove('hidden');
        try {
            const count = await gitee.downloadAll({
                renderHistory: () => bus.emit('historyData:change'),
                renderFolders: () => bus.emit('promptLib:change'),
                updatePreview: () => bus.emit('preview:update'),
            });
            st.textContent = `✅ 恢复完成 (${count} 项内容)`;
            st.className = 'text-[11px] font-bold text-success';
            showToast('☁️ 云端恢复完成');
        } catch (e) {
            st.textContent = '❌ 恢复失败: ' + e.message;
            st.className = 'text-[11px] font-bold text-error';
            showToast(e.message, 'error');
        }
    };
}
