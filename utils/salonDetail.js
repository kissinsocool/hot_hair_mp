const api = require('./api');

// 详情页刚拉取过的店铺数据，预约页在短时间内直接复用，避免进入预约时重复请求。
// 时间段和最终价格由预约页另行实时获取和确认，不依赖这份缓存。
const CACHE_MS = 60 * 1000;
const MAX_ENTRIES = 20;
// 点击店铺到详情页开始加载之间的间隔；超过后预取结果不再视为本次进入的请求。
const PREFETCH_MS = 10 * 1000;
const cache = new Map();
let prefetched = null;

function cacheKey(id) {
  const session = api.session();
  return `${(session && session.token) || 'anonymous'}:${id}`;
}

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

async function fetchDetail(id, key) {
  const data = await api.request(`/salons/${id}`);
  cache.delete(key);
  cache.set(key, { data: copy(data), fetchedAt: Date.now() });
  if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value);
  return data;
}

function freshPrefetch(key) {
  return prefetched && prefetched.key === key && Date.now() - prefetched.startedAt < PREFETCH_MS
    ? prefetched
    : null;
}

// 在跳转详情页之前提前发起详情请求，让请求与页面切换同时进行。
// summary 是列表里已有的店铺信息，详情页在数据返回前用它先展示头部。
function prefetch(id, summary) {
  const key = cacheKey(id);
  const promise = fetchDetail(id, key);
  // 预取失败由随后的 load 重新请求并提示，这里不重复处理。
  promise.catch(() => {});
  prefetched = { key, promise, startedAt: Date.now(), summary: summary || null };
}

function summary(id) {
  const entry = freshPrefetch(cacheKey(id));
  return entry ? entry.summary : null;
}

async function load(id, { maxAgeMs = CACHE_MS } = {}) {
  const key = cacheKey(id);
  // 预取就是为这次进入发起的请求，只使用一次，不影响之后每次进入都读取最新数据。
  const pending = freshPrefetch(key);
  if (prefetched && prefetched.key === key) prefetched = null;
  if (pending) {
    try {
      return await pending.promise;
    } catch (_) {
      // 预取失败时照常请求一次。
    }
  }
  const cached = cache.get(key);
  if (cached && maxAgeMs > 0 && Date.now() - cached.fetchedAt < maxAgeMs) return copy(cached.data);
  return fetchDetail(id, key);
}

// 同步读取仍在有效期内的缓存，没有时返回 null，不发请求。
// 预约页在 onLoad 里用它直接渲染首帧，不必先显示加载占位再切换。
function peek(id, { maxAgeMs = CACHE_MS } = {}) {
  const cached = cache.get(cacheKey(id));
  return cached && Date.now() - cached.fetchedAt < maxAgeMs ? copy(cached.data) : null;
}

function clear() {
  cache.clear();
  prefetched = null;
}

module.exports = { load, peek, prefetch, summary, clear, CACHE_MS, PREFETCH_MS };
