const api = require('../../utils/api');
const bookingSocket = require('../../utils/bookingSocket');
const orderUtils = require('../../utils/orders');

Page({
  data: {
    loading: true,
    messages: []
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
      const messages = await api.requestAllPages('/booking-messages');
      this.setData({ messages: messages.map(orderUtils.formatMessage) });
      if (messages.length) {
        await api.request('/booking-messages/read', {
          method: 'PATCH',
          data: { through: messages[0].createdAt }
        });
      }
    } catch (err) {
      wx.showToast({ title: err.message, icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  }
});
