const api = require('./api');

// 收藏 ID 在首页、详情页、收藏页之间共享；本端写操作会同步更新缓存，
// 短期缓存只用于减少 tab 切换和页面返回时的重复请求。
const CACHE_MS = 30 * 1000;
let cache = null;
let version = 0;

function currentToken() {
  const session = api.session();
  return (session && session.token) || '';
}

async function loadIds({ force = false } = {}) {
  const token = currentToken();
  if (!token) return [];
  if (!force && cache && cache.token === token && cache.expiresAt > Date.now()) return cache.ids.slice();
  const requestVersion = version;
  const result = await api.request('/favorites/ids');
  const ids = Array.isArray(result && result.salonIds) ? result.salonIds : [];
  // 请求期间发生过收藏变更时，这次响应可能已过时，不写入缓存。
  if (requestVersion === version && token === currentToken()) {
    cache = { token, ids: ids.slice(), expiresAt: Date.now() + CACHE_MS };
  }
  return ids.slice();
}

async function setFavorite(salonId, favorite) {
  const token = currentToken();
  version += 1;
  try {
    await api.request(`/favorites/${encodeURIComponent(salonId)}`, { method: favorite ? 'PUT' : 'DELETE' });
  } catch (err) {
    cache = null;
    throw err;
  }
  if (cache && cache.token === token) {
    const ids = new Set(cache.ids);
    if (favorite) ids.add(salonId);
    else ids.delete(salonId);
    cache = { ...cache, ids: [...ids] };
  }
}

function invalidate() {
  version += 1;
  cache = null;
}

module.exports = { loadIds, setFavorite, invalidate, CACHE_MS };
