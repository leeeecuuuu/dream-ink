/**
 * webdav-sync.js — WebDAV 同步初始化
 *
 * 负责绑定 UI 事件并调度 webdav 模块执行上传、下载。
 */

import { $, ls } from '../utils/helpers.js';
import { webdav } from '../storage/webdav.js';
import { showToast } from '../ui/toast.js';
import { bus } from '../utils/event-bus.js';

export function initWebDAV() {
  // 恢复保存的凭据到表单
  const wUrl = ls('nanscript_webdav_url');
  const wProxy = ls('nanscript_webdav_proxy');
  const wUser = ls('nanscript_webdav_user');
  const wPass = ls('nanscript_webdav_pass');
  if (wUrl && $('webdavUrl')) $('webdavUrl').value = wUrl;
  if (wProxy && $('webdavProxy')) $('webdavProxy').value = wProxy;
  if (wUser && $('webdavUser')) $('webdavUser').value = wUser;
  if (wPass && $('webdavPass')) $('webdavPass').value = wPass;
  if (webdav.isConfigured()) {
    const badge = $('webdavBadge');
    if (badge) badge.classList.remove('hidden');
  }

  // 保存凭据
  const saveBtn = $('webdavSaveBtn');
  if (saveBtn) saveBtn.onclick = () => {
    const url = $('webdavUrl').value.trim();
    const proxy = $('webdavProxy')?.value.trim() || '';
    const user = $('webdavUser').value.trim();
    const pass = $('webdavPass').value.trim();
    if (!url || !user || !pass) return showToast('请填写完整的 WebDAV 信息', 'error');
    webdav.saveCredentials(url, user, pass, proxy);
    const badge = $('webdavBadge');
    if (badge) badge.classList.remove('hidden');
    showToast('WebDAV 凭据已保存');
  };

  // 测试连接
  const testBtn = $('webdavTestBtn');
  if (testBtn) testBtn.onclick = async () => {
    const url = $('webdavUrl').value.trim();
    const proxy = $('webdavProxy')?.value.trim() || '';
    const user = $('webdavUser').value.trim();
    const pass = $('webdavPass').value.trim();
    if (!url || !user || !pass) return showToast('请先填写 WebDAV 信息', 'error');
    // 临时保存以便测试
    webdav.saveCredentials(url, user, pass, proxy);
    const st = $('webdavStatus');
    if (st) {
        st.textContent = '正在测试连接...';
        st.classList.remove('hidden');
    }
    const result = await webdav.testConnection();
    if (st) {
        st.textContent = result.message;
        st.className = `text-[11px] font-bold ${result.ok ? 'text-success' : 'text-error'}`;
    }
    if (result.ok) showToast('WebDAV 连接成功 ✅');
    else showToast(result.message, 'error');
  };

  // 上传到云端
  const upBtn = $('webdavUploadBtn');
  if (upBtn) upBtn.onclick = async () => {
    if (!webdav.isConfigured()) return showToast('请先保存 WebDAV 凭据', 'error');
    upBtn.disabled = true;
    const st = $('webdavStatus');
    if (st) { st.textContent = '正在上传...'; st.classList.remove('hidden'); }
    try {
      const { success, failed } = await webdav.uploadAll();
      if (st) {
          st.textContent = `✅ 上传完成: ${success} 成功` + (failed ? `, ${failed} 失败` : '');
          st.className = 'text-[11px] font-bold text-success';
      }
      showToast(`☁️ 云端同步完成: ${success} 个文件`);
    } catch (e) {
      if (st) {
          st.textContent = `❌ 上传失败: ${e.message}`;
          st.className = 'text-[11px] font-bold text-error';
      }
      showToast(e.message, 'error');
    } finally { upBtn.disabled = false; }
  };

  // 从云端恢复
  const downBtn = $('webdavDownloadBtn');
  if (downBtn) downBtn.onclick = async () => {
    if (!webdav.isConfigured()) return showToast('请先保存 WebDAV 凭据', 'error');
    if (!confirm('从云端恢复将合并远端数据到本地。继续？')) return;
    downBtn.disabled = true;
    const st = $('webdavStatus'); 
    if (st) { st.textContent = '正在下载...'; st.classList.remove('hidden'); }
    try {
      const { success, failed, skipped } = await webdav.downloadAll({
        renderHistory: () => bus.emit('historyData:change'),
        renderFolders: () => bus.emit('promptLib:change'),
        syncModelInput: () => {}, 
        updatePreview: () => bus.emit('preview:update'),
      });
      if (st) {
          st.textContent = `✅ 恢复完成: ${success} 合并` + (skipped ? `, ${skipped} 跳过` : '') + (failed ? `, ${failed} 失败` : '');
          st.className = 'text-[11px] font-bold text-success';
      }
      showToast(`☁️ 云端恢复完成`);
    } catch (e) {
      if (st) {
          st.textContent = `❌ 恢复失败: ${e.message}`;
          st.className = 'text-[11px] font-bold text-error';
      }
      showToast(e.message, 'error');
    } finally { downBtn.disabled = false; }
  };
}
