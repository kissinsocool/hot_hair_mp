const api = require('./api');
const bookingSocket = require('./bookingSocket');

// 未读数只在预约事件或消息已读后变化；短期缓存避免每次切回首页都请求。
const CACHE_MS = 30 * 1000;
let cache = null;

function currentToken() {
  const session = api.session();
  return (session && session.token) || '';
}

async function count({ force = false } = {}) {
  const token = currentToken();
  if (!token) return 0;
  const fresh = cache
    && cache.token === token
    && cache.expiresAt > Date.now()
    && cache.fetchedAt >= bookingSocket.lastEventAt();
  if (!force && fresh) return cache.count;
  const fetchedAt = Date.now();
  const result = await api.request('/booking-messages/unread-count');
  const value = Number(result && result.count) || 0;
  if (token === currentToken()) cache = { token, count: value, fetchedAt, expiresAt: fetchedAt + CACHE_MS };
  return value;
}

function invalidate() {
  cache = null;
}

module.exports = { count, invalidate, CACHE_MS };
