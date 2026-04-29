/**
 * library.js — 咒语书模块
 *
 * 管理提示词库的文件夹和卡片的渲染及 CRUD 操作。
 * 使用 createElement 安全构建 DOM。
 */

import { $ } from '../utils/helpers.js';
import { el, icon, clearChildren } from '../utils/dom.js';
import { idb } from '../storage/idb.js';
import { localFS } from '../storage/local-fs.js';
import { state } from '../state/app-state.js';
import { showToast } from './toast.js';
import { showHistoryDetail } from './history.js';
import { bus } from '../utils/event-bus.js';

/**
 * 持久化咒语书数据
 */
export const saveLib = async () => {
  if (localFS.isActive()) await localFS.saveJSON('prompts.json', state.promptLib);
  else idb.set('nanscript_prompt_lib', state.promptLib);
};

/**
 * 渲染文件夹列表（左侧分类目录）
 */
export function renderFolders() {
  const list = $('folderList');
  if (!list) return;
  clearChildren(list);

  state.promptLib.forEach((f, i) => {
    // 文件夹名称
    const nameSpan = el('span', { className: 'flex items-center gap-2 line-clamp-1' },
      icon('folder', 'text-[18px]'),
      ` ${f.folderName}`
    );

    // 编辑按钮
    const editBtn = el('button', {
      className: 'ef',
      title: '重命名',
    }, icon('edit', 'text-[16px] p-1 hover:text-on-surface text-on-surface-variant transition-colors'));

    // 删除按钮
    const delBtn = el('button', {
      className: 'df',
      title: '删除',
    }, icon('close', 'text-[16px] p-1 text-error hover:bg-error/10 rounded transition-colors'));

    const actions = el('div', { className: 'flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity' },
      editBtn, delBtn
    );

    const isActive = i === state.curFolder;
    const row = el('div', {
      className: `group flex justify-between items-center p-2.5 rounded-lg cursor-pointer text-sm font-medium transition-colors ${
        isActive ? 'bg-primary/10 text-primary' : 'text-on-surface hover:bg-surface-container-high'
      }`,
    }, nameSpan, actions);

    row.onclick = () => {
      state.curFolder = i;
      bus.emit('promptLib:change');
    };

    editBtn.onclick = (e) => {
      e.stopPropagation();
      const n = prompt('重命名分类:', f.folderName);
      if (n && n.trim()) {
        f.folderName = n.trim();
        saveLib();
        bus.emit('promptLib:change');
        showToast('分类已重命名');
      }
    };

    delBtn.onclick = (e) => {
      e.stopPropagation();
      if (confirm(`删除分类 [${f.folderName}]？`)) {
        state.promptLib.splice(i, 1);
        state.curFolder = Math.max(0, state.curFolder - 1);
        saveLib();
        bus.emit('promptLib:change');
      }
    };

    list.appendChild(row);
  });

  // 同步触发卡片渲染
  bus.emit('promptLib:promptsChange');
}

/**
 * 渲染当前文件夹下的提示词卡片
 */
export async function renderPrompts() {
  const grid = $('promptGrid');
  const title = $('currentFolderName');
  if (!grid || !title) return;

  if (!state.promptLib.length) {
    title.textContent = '暂无分类';
    clearChildren(grid);
    grid.appendChild(el('div', {
      style: 'color:var(--text-muted)',
      textContent: '请先创建分类',
    }));
    return;
  }

  const folder = state.promptLib[state.curFolder];
  title.textContent = `📂 ${folder.folderName}`;
  clearChildren(grid);

  for (let i = 0; i < folder.prompts.length; i++) {
    const p = folder.prompts[i];

    // 获取图源
    let imgSrc = p.thumb || p.fullImage || '';
    if (!imgSrc && p.thumbFile && localFS.isActive()) {
      imgSrc = await localFS.getImageURL(p.thumbFile, 'thumbs').catch(() => '');
    }

    // 卡片图片区域
    const cardImg = el('img', {
      src: imgSrc,
      className: 'w-full h-full object-cover',
      style: imgSrc ? 'display:block' : 'display:none',
    });
    const imgBox = el('div', { className: 'h-32 bg-surface-container-lowest overflow-hidden' }, cardImg);

    // 卡片名称（安全 textContent）
    const cardTitle = el('div', {
      className: 'font-bold text-sm text-on-surface mb-2 truncate pr-6',
      textContent: p.name,
    });

    // 卡片内容（安全 textContent）
    const cardContent = el('div', {
      className: 'text-xs text-on-surface-variant line-clamp-2 leading-relaxed',
      textContent: p.content,
    });

    // 编辑/删除按钮
    const editBtn = el('button', { className: 'ep' },
      icon('edit', 'text-[14px] p-1 text-on-surface-variant hover:text-on-surface transition-colors'));
    const delBtn = el('button', { className: 'dp' },
      icon('delete', 'text-[14px] p-1 text-error hover:bg-error/10 rounded transition-colors'));

    const actionBox = el('div', {
      className: 'absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-surface-container rounded-md p-0.5 shadow border border-outline-variant',
    }, editBtn, delBtn);

    const infoBox = el('div', { className: 'p-4 relative' }, cardTitle, cardContent, actionBox);

    const card = el('div', {
      className: 'bg-surface-container border border-outline-variant rounded-xl overflow-hidden cursor-pointer hover:-translate-y-1 hover:shadow-lg hover:border-primary transition-all group',
    }, imgBox, infoBox);

    // 事件绑定
    card.onclick = () => showHistoryDetail(p, i, 'library');

    editBtn.onclick = (e) => {
      e.stopPropagation();
      const nn = prompt('修改名称:', p.name);
      if (nn === null) return;
      const nc = prompt('修改内容:', p.content);
      if (nc === null) return;
      if (!nn.trim() || !nc.trim()) return showToast('不能为空', 'error');
      p.name = nn.trim();
      p.content = nc.trim();
      saveLib();
      bus.emit('promptLib:promptsChange');
      showToast('已更新');
    };

    delBtn.onclick = (e) => {
      e.stopPropagation();
      folder.prompts.splice(i, 1);
      saveLib();
      bus.emit('promptLib:promptsChange');
    };

    grid.appendChild(card);
  }
}

// 订阅事件总线
bus.on('promptLib:change', renderFolders);
bus.on('promptLib:promptsChange', renderPrompts);
