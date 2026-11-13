const { onShareAppMessage } = require('../../utils/share');
const api = require('../../utils/api');
const orderUtils = require('../../utils/orders');
const analytics = require('../../utils/analytics');
const salonDetail = require('../../utils/salonDetail');
const loginGate = require('../../utils/loginGate');

Page({
  onShareAppMessage,

  data: {
    loading: true,
    errorMessage: '',
    order: null
  },

  // 订单编号在登录判断之前记下：未登录进入时，登录成功返回本页只触发 onShow，仍要知道加载哪个订单。
  onLoad(query) {
    this.bookingId = String(query.id || '');
    if (!this.bookingId) this.setData({ loading: false, errorMessage: '订单编号无效' });
  },

  onShow() {
    if (!this.bookingId || !loginGate.ensure(this)) return;
    return this.load();
  },

  reportIssue() {
    const order = this.data.order;
    if (!order || !order.canReportIssue) return;
    wx.navigateTo({
      url: '/pages/review-editor/review-editor',
      success: res => res.eventChannel.emit('init', { mode: 'complaint', booking: order })
    });
  },

  // 网络恢复后重新加载之前失败的内容。
  onNetworkRestored() {
    if (this.data.errorMessage && this.bookingId) this.load();
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
    if (!salonId) return;
    salonDetail.prefetch(salonId);
    wx.navigateTo({ url: `/pages/detail/detail?id=${encodeURIComponent(salonId)}` });
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
