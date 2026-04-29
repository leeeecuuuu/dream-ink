/**
 * idb.js — IndexedDB 存储封装
 *
 * 提供简单的 key-value 存取接口，用于替代 localStorage
 * 存储大容量数据（历史记录、画廊数据、Base64 图片等）。
 */

const DB_NAME = 'BananaKingDB';
const DB_VERSION = 1;
const STORE_NAME = 'appData';

/**
 * 打开 IndexedDB 连接
 * @returns {Promise<IDBDatabase>}
 * @private
 */
function _open() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = (e) => reject(e.target.error);
    request.onsuccess = (e) => resolve(e.target.result);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

/**
 * 写入数据
 * @param {string} key - 存储键
 * @param {*} value - 任意可序列化值
 * @returns {Promise<void>}
 */
export async function idbSet(key, value) {
  const db = await _open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const request = tx.objectStore(STORE_NAME).put(value, key);
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e.target.error);
  });
}

/**
 * 读取数据
 * @param {string} key - 存储键
 * @returns {Promise<*>} 存储的值，不存在时为 undefined
 */
export async function idbGet(key) {
  const db = await _open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

// 兼容旧版代码的对象形式导出
export const idb = { set: idbSet, get: idbGet };
