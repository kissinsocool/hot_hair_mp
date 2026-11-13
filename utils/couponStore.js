const api = require('./api');
const freshness = require('./freshness');

// 账号优惠券列表在首页提醒、「我」页、确认页和新人礼包页之间共享。
// 有效期与页面数据一致（freshness）：同一账号 30 秒内、期间本端没有写操作（领券、下单、取消都会改变券状态）
// 且没有收到预约推送（商家拒单会退回优惠券）时直接复用，否则重新读取。
let cache = null;

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

// force：需要以服务端最新状态做决定时（领券前、价格或券变化后重新核对）跳过缓存。
async function load({ force = false } = {}) {
  if (!force && cache && freshness.isFresh(cache.stamp)) return copy(cache.coupons);
  const stamp = freshness.stamp();
  const result = await api.request('/auth/coupons');
  const coupons = Array.isArray(result) ? result : [];
  cache = { stamp, coupons: copy(coupons) };
  return coupons;
}

function invalidate() {
  cache = null;
}

module.exports = { load, invalidate };
