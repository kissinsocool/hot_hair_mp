const api = require('../../utils/api');
const orderUtils = require('../../utils/orders');
const analytics = require('../../utils/analytics');

Page({
  data: {
    loading: true,
    errorMessage: '',
    order: null
  },

  onLoad(query) {
    if (!api.requireLogin()) return;
    this.bookingId = String(query.id || '');
    if (!this.bookingId) {
      this.setData({ loading: false, errorMessage: '订单编号无效' });
      return;
    }
    this.load();
  },

  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh());
  },

  async load() {
    this.setData({ loading: true, errorMessage: '' });
    try {
      const booking = await api.request(`/bookings/${encodeURIComponent(this.bookingId)}`);
      this.setData({ order: orderUtils.formatOrderDetail(booking) });
    } catch (err) {
      this.setData({ errorMessage: err.message || '订单加载失败' });
    } finally {
      this.setData({ loading: false });
    }
  },

  openSalon() {
    const salonId = this.data.order && this.data.order.salonId;
    if (salonId) wx.navigateTo({ url: `/pages/detail/detail?id=${encodeURIComponent(salonId)}` });
  },

  rebook() {
    const order = this.data.order;
    if (!order) return;
    analytics.track('rebooking_started', {
      salonId: order.salonId,
      serviceId: order.serviceId,
      sourceBookingId: order.id
    });
    wx.navigateTo({
      url: `/pages/booking/booking?id=${encodeURIComponent(order.salonId)}&serviceId=${encodeURIComponent(order.serviceId)}`
    });
  }
});
