const api = require('./api');
const STORAGE_KEY = 'analyticsAnonymousId';
let sequence = 0;
let cachedAnonymousId = '';

function anonymousId() {
  // 匿名 ID 写入后不再变化，只在首次埋点时读取 storage。
  if (cachedAnonymousId) return cachedAnonymousId;
  let id = wx.getStorageSync(STORAGE_KEY);
  if (!id) {
    id = `anon-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    wx.setStorageSync(STORAGE_KEY, id);
  }
  cachedAnonymousId = id;
  return id;
}

function track(name, properties = {}) {
  const visitorId = anonymousId();
  sequence += 1;
  return api.request('/analytics/events', {
    method: 'POST',
    // 埋点不改变用户数据，不应让页面缓存失效。
    affectsUserData: false,
    data: {
      eventId: `${visitorId}-${Date.now()}-${sequence}`,
      anonymousId: visitorId,
      name,
      salonId: properties.salonId || '',
      serviceId: properties.serviceId || '',
      bookingId: properties.bookingId || '',
      sourceBookingId: properties.sourceBookingId || ''
    }
  }).catch(() => {});
}

module.exports = { track };
