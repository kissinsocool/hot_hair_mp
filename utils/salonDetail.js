const api = require('./api');

// 详情页刚拉取过的店铺数据，预约页在短时间内直接复用，避免进入预约时重复请求。
// 时间段和最终价格由预约页另行实时获取和确认，不依赖这份缓存。
const CACHE_MS = 60 * 1000;
const MAX_ENTRIES = 20;
const cache = new Map();

function cacheKey(id) {
  const session = api.session();
  return `${(session && session.token) || 'anonymous'}:${id}`;
}

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

async function load(id, { maxAgeMs = CACHE_MS } = {}) {
  const key = cacheKey(id);
  const cached = cache.get(key);
  if (cached && maxAgeMs > 0 && Date.now() - cached.fetchedAt < maxAgeMs) return copy(cached.data);
  const data = await api.request(`/salons/${id}`);
  cache.delete(key);
  cache.set(key, { data: copy(data), fetchedAt: Date.now() });
  if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value);
  return data;
}

function clear() {
  cache.clear();
}

module.exports = { load, clear, CACHE_MS };
