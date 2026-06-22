/**
 * modals.js — 模态框管理模块
 *
 * 统一管理所有模态框的打开/关闭/背景点击关闭行为。
 */

import { $ } from '../utils/helpers.js';
import { state } from '../state/app-state.js';
import { bus } from '../utils/event-bus.js';

/**
 * 初始化所有模态框的通用事件绑定
 */
export function initModals() {
  // 通用模态框绑定：[打开按钮ID, 模态框ID, 关闭按钮ID]
  const modalBindings = [
    ['infoBtn', 'infoModal', 'closeInfoBtn'],
    ['apiConfigBtn', 'apiConfigModal', 'closeApiConfigBtn'],
    ['openLibraryBtn', 'libraryModal', 'closeLibraryBtn'],
    ['syncConfigBtn', 'syncConfigModal', 'closeSyncConfigBtn'],
  ];

  modalBindings.forEach(([btnId, modalId, closeId]) => {
    const modal = $(modalId);

    if ($(btnId) && modal) {
      $(btnId).onclick = () => {
        modal.style.display = 'flex';
        // 咒语书打开时初始化数据
        if (modalId === 'libraryModal') {
          if (!state.promptLib.length) {
            state.promptLib.push({ folderName: 'Default', prompts: [] });
          }
          bus.emit('promptLib:change');
        }
      };
    }

    if ($(closeId) && modal) {
      $(closeId).onclick = () => (modal.style.display = 'none');
    }

    // 背景点击关闭
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
      });
    }
  });

  // 历史详情模态框
  const hdClose = $('hdCloseBtn');
  if (hdClose) {
    hdClose.onclick = () => ($('historyDetailModal').style.display = 'none');
  }


  const hdModal = $('historyDetailModal');
  if (hdModal) {
    hdModal.addEventListener('click', (e) => {
      if (e.target.id === 'historyDetailModal') {
        hdModal.style.display = 'none';
      }
    });
  }

  // 云同步弹窗「完成」按钮
  const applySyncBtn = $('applySyncConfigBtn');
  if (applySyncBtn) {
    applySyncBtn.onclick = () => {
      const modal = $('syncConfigModal');
      if (modal) modal.style.display = 'none';
    };
  }

  // 指南 Tab 切换
  document.querySelectorAll('.info-tab').forEach((tab) => {
    tab.onclick = () => {
      document.querySelectorAll('.info-tab').forEach((t) => {
        t.classList.remove('active', 'text-primary', 'border-primary', 'font-bold');
        t.classList.add('text-on-surface-variant', 'border-transparent', 'font-medium');
      });
      document.querySelectorAll('.info-pane').forEach((p) => p.classList.add('hidden'));
      tab.classList.add('active', 'text-primary', 'border-primary', 'font-bold');
      tab.classList.remove('text-on-surface-variant', 'border-transparent', 'font-medium');
      const target = $(tab.dataset.target);
      if (target) target.classList.remove('hidden');
    };
  });
}
