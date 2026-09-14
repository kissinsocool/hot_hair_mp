const api = require('./api');
const STORAGE_KEY = 'analyticsAnonymousId';
let sequence = 0;

function anonymousId() {
  let id = wx.getStorageSync(STORAGE_KEY);
  if (id) return id;
  id = `anon-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  wx.setStorageSync(STORAGE_KEY, id);
  return id;
}

function track(name, properties = {}) {
  const visitorId = anonymousId();
  sequence += 1;
  return api.request('/analytics/events', {
    method: 'POST',
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
