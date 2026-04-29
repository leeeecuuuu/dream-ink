/**
 * event-bus.js — 全局事件总线
 *
 * 简单的发布-订阅模式 (EventEmitter) 实现。
 * 用于解耦各模块之间的状态同步，消除跨模块直接调用 renderXXX() 造成的强耦合。
 */

class EventEmitter {
  constructor() {
    this.events = {};
  }

  /**
   * 订阅事件
   * @param {string} event 事件名称
   * @param {Function} listener 回调函数
   * @returns {Function} 取消订阅的函数
   */
  on(event, listener) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
    return () => this.off(event, listener);
  }

  /**
   * 取消订阅
   * @param {string} event 事件名称
   * @param {Function} listener 回调函数
   */
  off(event, listener) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter(l => l !== listener);
  }

  /**
   * 触发事件
   * @param {string} event 事件名称
   * @param {...any} args 传递给回调的参数
   */
  emit(event, ...args) {
    if (!this.events[event]) return;
    this.events[event].forEach(listener => listener(...args));
  }
}

export const bus = new EventEmitter();
