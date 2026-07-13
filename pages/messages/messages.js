const api = require('../../utils/api');
const bookingSocket = require('../../utils/bookingSocket');
const messages = require('../../utils/messages');
const orderUtils = require('../../utils/orders');

Page({
  data: {
    loading: true,
    orders: []
  },

  onLoad() {
    if (!api.requireLogin()) return;
    this.load();
    this.unsubscribeBookingSocket = bookingSocket.subscribe((event) => {
      if (event.event === 'booking.created' || event.event === 'booking.updated') {
        this.load();
      }
    });
  },

  onUnload() {
    if (this.unsubscribeBookingSocket) this.unsubscribeBookingSocket();
    this.unsubscribeBookingSocket = null;
  },

  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh());
  },

  goBack() {
    wx.navigateBack();
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/home' });
  },

  async load() {
    this.setData({ loading: true });
    try {
      const orders = await api.request('/bookings');
      this.setData({ orders: orders.map(orderUtils.formatMessage) });
      wx.setStorageSync(messages.READ_KEY, messages.latestMessageKey(orders));
    } catch (err) {
      wx.showToast({ title: err.message, icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  }
});
