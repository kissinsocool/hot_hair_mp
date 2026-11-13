const api = require('./api');

// 预约页优惠券提醒的关闭记录。按账号保存用户关闭时已有的券，
// 之后只有出现新券才再次提醒，避免关掉后每次进入预约页都弹出。
const STORAGE_KEY = 'couponTipDismissed';

function currentUserKey() {
  return api.userKey((api.session() || {}).user || {});
}

function couponIds(coupons) {
  return coupons.map((coupon) => String(coupon.id));
}

function readDismissed() {
  try {
    const stored = wx.getStorageSync(STORAGE_KEY);
    return stored && stored.userKey === currentUserKey() && Array.isArray(stored.couponIds)
      ? stored.couponIds
      : [];
  } catch (_) {
    return [];
  }
}

function hasUndismissedCoupon(coupons) {
  const dismissed = new Set(readDismissed());
  return couponIds(coupons).some((id) => !dismissed.has(id));
}

function dismiss(coupons) {
  try {
    wx.setStorageSync(STORAGE_KEY, { userKey: currentUserKey(), couponIds: couponIds(coupons) });
  } catch (_) {}
}

module.exports = { hasUndismissedCoupon, dismiss };
