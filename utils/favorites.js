const api = require('./api');

// 收藏 ID 在首页、详情页、理发师页、店铺动态页和收藏页之间共享；本端写操作会同步更新缓存，
// 短期缓存只用于减少 tab 切换和页面返回时的重复请求。
const CACHE_MS = 30 * 1000;

function currentToken() {
  const session = api.session();
  return (session && session.token) || '';
}

// 每类收藏（店铺、理发师、动态）各自一份缓存，读写规则相同。
function createFavoriteStore({ idsPath, idsKey, itemPath }) {
  let cache = null;
  let version = 0;

  async function loadIds({ force = false } = {}) {
    const token = currentToken();
    if (!token) return [];
    if (!force && cache && cache.token === token && cache.expiresAt > Date.now()) return cache.ids.slice();
    const requestVersion = version;
    const result = await api.request(idsPath);
    const ids = Array.isArray(result && result[idsKey]) ? result[idsKey] : [];
    // 请求期间发生过收藏变更时，这次响应可能已过时，不写入缓存。
    if (requestVersion === version && token === currentToken()) {
      cache = { token, ids: ids.slice(), expiresAt: Date.now() + CACHE_MS };
    }
    return ids.slice();
  }

  // 返回服务端响应，理发师收藏会带回最新的被收藏数。
  async function setFavorite(id, favorite) {
    const token = currentToken();
    version += 1;
    let result;
    try {
      result = await api.request(itemPath(id), { method: favorite ? 'PUT' : 'DELETE' });
    } catch (err) {
      cache = null;
      throw err;
    }
    if (cache && cache.token === token) {
      const ids = new Set(cache.ids);
      if (favorite) ids.add(id);
      else ids.delete(id);
      cache = { ...cache, ids: [...ids] };
    }
    return result;
  }

  function invalidate() {
    version += 1;
    cache = null;
  }

  // 正在提交的条目：同一条目上一次请求未结束前忽略重复点击。
  const toggling = new Set();

  // 先更新界面再请求接口：apply(favorite) 立即反映新状态，请求失败时调用 apply(!favorite) 回滚后抛出错误。
  // 成功时返回 { result }（服务端响应），因重复点击被忽略时返回 null。
  async function toggle(id, favorite, apply) {
    if (toggling.has(id)) return null;
    toggling.add(id);
    apply(favorite);
    try {
      return { result: await setFavorite(id, favorite) };
    } catch (err) {
      apply(!favorite);
      throw err;
    } finally {
      toggling.delete(id);
    }
  }

  return { loadIds, setFavorite, toggle, invalidate };
}

const salons = createFavoriteStore({
  idsPath: '/favorites/ids',
  idsKey: 'salonIds',
  itemPath: (id) => `/favorites/${encodeURIComponent(id)}`
});

const staff = createFavoriteStore({
  idsPath: '/favorites/staff/ids',
  idsKey: 'staffIds',
  itemPath: (id) => `/favorites/staff/${encodeURIComponent(id)}`
});

const posts = createFavoriteStore({
  idsPath: '/favorites/posts/ids',
  idsKey: 'postIds',
  itemPath: (id) => `/favorites/posts/${encodeURIComponent(id)}`
});

// 页面模板里用对象按 ID 判断是否已收藏。
function idSet(ids) {
  return ids.reduce((result, id) => {
    result[id] = true;
    return result;
  }, {});
}

// 店铺收藏保持原有的顶层导出。
module.exports = { ...salons, staff, posts, idSet, CACHE_MS };
