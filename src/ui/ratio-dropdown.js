/**
 * ratio-dropdown.js — 画幅尺寸选择器模块
 *
 * 自定义下拉组件，使用安全 DOM 构建替代 innerHTML。
 */

import { $ } from '../utils/helpers.js';
import { el, clearChildren } from '../utils/dom.js';

/** 尺寸预设列表 */
const PRESETS = [
  {
    group: '标清 (SD)',
    items: [
      { val: '512x512', label: '512 x 512 (1:1)' },
      { val: '768x512', label: '768 x 512 (3:2)' },
      { val: '512x768', label: '512 x 768 (2:3)' },
    ],
  },
  {
    group: '高清 (HD)',
    items: [
      { val: '1024x1024', label: '1024 x 1024 (1:1 高清)' },
      { val: '1024x576', label: '1024 x 576 (16:9)' },
      { val: '576x1024', label: '576 x 1024 (9:16)' },
      { val: '1024x768', label: '1024 x 768 (4:3)' },
      { val: '768x1024', label: '768 x 1024 (3:4)' },
    ],
  },
  {
    group: '超清 (2K)',
    items: [
      { val: '2048x2048', label: '2048 x 2048 (1:1)' },
      { val: '1920x1080', label: '1920 x 1080 (16:9)' },
      { val: '1080x1920', label: '1080 x 1920 (9:16)' },
    ],
  },
  {
    group: '极致 (4K)',
    items: [
      { val: '2880x2880', label: '2880 x 2880 (1:1)' },
      { val: '3840x2160', label: '3840 x 2160 (16:9)' },
      { val: '2160x3840', label: '2160 x 3840 (9:16)' },
    ],
  },
  {
    group: '其他',
    items: [{ val: 'custom', label: '自定义尺寸...' }],
  },
];

/**
 * 初始化画幅选择下拉组件
 */
export function initRatioDropdown() {
  const btn = $('ratioSelectBtn');
  const text = $('ratioSelectText');
  const hiddenInput = $('ratioSelect');
  const drop = $('ratioDropdown');
  const customBox = $('customRatioContainer');
  if (!btn) return;

  // 安全渲染下拉列表（使用 createElement）
  clearChildren(drop);

  PRESETS.forEach((group) => {
    // 分组标题
    const groupTitle = el('div', {
      className: 'px-3 py-1.5 text-[10px] font-bold text-primary bg-primary/5 uppercase tracking-widest sticky top-0 backdrop-blur-md z-10',
      textContent: group.group,
    });
    drop.appendChild(groupTitle);

    // 选项容器
    const optContainer = el('div', { className: 'py-1' });

    group.items.forEach((item) => {
      const opt = el('div', {
        className: 'ratio-opt px-3 py-2 text-xs text-on-surface hover:bg-surface-container cursor-pointer transition-colors font-mono flex justify-between items-center',
        dataset: { val: item.val },
      }, el('span', { textContent: item.label }));

      opt.onclick = () => {
        updateUI(item.val);
        drop.classList.add('hidden');
        hiddenInput.dispatchEvent(new Event('change'));
      };

      optContainer.appendChild(opt);
    });

    drop.appendChild(optContainer);
  });

  /**
   * 根据值更新 UI 显示
   * @param {string} val
   */
  function updateUI(val) {
    hiddenInput.value = val;
    let foundLabel = val === 'custom' ? '自定义尺寸...' : val;
    for (const g of PRESETS) {
      const f = g.items.find((i) => i.val === val);
      if (f) {
        foundLabel = f.label;
        break;
      }
    }
    text.textContent = foundLabel;

    // 高亮选中项
    drop.querySelectorAll('.ratio-opt').forEach((optEl) => {
      if (optEl.dataset.val === val) {
        optEl.classList.add('bg-primary/10', 'text-primary', 'font-bold');
      } else {
        optEl.classList.remove('bg-primary/10', 'text-primary', 'font-bold');
      }
    });

    // 自定义尺寸输入框显隐
    if (val === 'custom') {
      customBox.classList.remove('hidden');
      customBox.classList.add('flex');
    } else {
      customBox.classList.add('hidden');
      customBox.classList.remove('flex');
    }
  }

  // 绑定事件
  btn.onclick = (e) => {
    e.stopPropagation();
    drop.classList.toggle('hidden');
  };

  document.addEventListener('click', (e) => {
    if (!btn.contains(e.target) && !drop.contains(e.target)) {
      drop.classList.add('hidden');
    }
  });

  // 暴露 updateUI 方法供外部调用
  window._updateRatioUI = updateUI;
}
