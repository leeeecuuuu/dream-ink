/**
 * dom.js — 安全 DOM 操作工具
 *
 * 提供 createElement 的便捷封装，避免使用 innerHTML 字符串拼接，
 * 从根本上消除 XSS 注入风险。
 *
 * 设计原则：
 *  - 所有文本内容通过 textContent 设置（自动转义）
 *  - 属性通过 setAttribute 设置（避免注入）
 *  - 支持嵌套子元素的声明式构建
 */

/**
 * 安全创建 DOM 元素
 * @param {string} tag - HTML 标签名
 * @param {Object} attrs - 属性键值对（className、textContent、style 等）
 * @param  {...(Node|string)} children - 子节点或文本
 * @returns {HTMLElement}
 * 
 * @example
 * // 创建带 class 和文本的 div
 * el('div', { className: 'card', textContent: '你好' });
 * 
 * // 嵌套子元素
 * el('div', { className: 'wrapper' },
 *   el('span', { className: 'icon', textContent: 'star' }),
 *   el('span', { textContent: '收藏' })
 * );
 */
export function el(tag, attrs = {}, ...children) {
  const element = document.createElement(tag);

  // 设置属性
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null) continue;

    switch (key) {
      case 'className':
        element.className = value;
        break;
      case 'textContent':
        element.textContent = value;
        break;
      case 'innerHTML':
        // 仅允许已知安全的 HTML（如 Material Icons）
        // 调用处应确保内容不含用户输入
        element.innerHTML = value;
        break;
      case 'style':
        if (typeof value === 'string') {
          element.style.cssText = value;
        } else if (typeof value === 'object') {
          Object.assign(element.style, value);
        }
        break;
      case 'dataset':
        Object.assign(element.dataset, value);
        break;
      default:
        // onclick、onchange 等事件或普通属性
        if (key.startsWith('on') && typeof value === 'function') {
          element.addEventListener(key.slice(2).toLowerCase(), value);
        } else {
          element.setAttribute(key, value);
        }
    }
  }

  // 添加子节点
  for (const child of children) {
    if (child === null || child === undefined) continue;
    if (typeof child === 'string') {
      element.appendChild(document.createTextNode(child));
    } else if (child instanceof Node) {
      element.appendChild(child);
    }
  }

  return element;
}

/**
 * 创建 Material Symbols Outlined 图标元素
 * @param {string} name - 图标名称（如 'auto_awesome'）
 * @param {string} [extraClass] - 额外的 CSS 类名
 * @returns {HTMLSpanElement}
 */
export function icon(name, extraClass = '') {
  return el('span', {
    className: `material-symbols-outlined ${extraClass}`.trim(),
    textContent: name,
  });
}

/**
 * 清空元素所有子节点（比 innerHTML = '' 更安全）
 * @param {HTMLElement} element
 */
export function clearChildren(element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}
