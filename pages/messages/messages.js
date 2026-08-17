const api = require('../../utils/api');
const bookingSocket = require('../../utils/bookingSocket');
const layout = require('../../utils/layout');
const orderUtils = require('../../utils/orders');
const PAGE_SIZE = 20;

Page({
  data: {
    loading: true,
    messages: [],
    messagePage: 0,
    hasMoreMessages: false,
    loadingMoreMessages: false,
    statusBarHeight: 0,
    appBarHeight: 44
  },

  onLoad() {
    this.setData(layout.appBarSize());
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

  onReachBottom() {
    this.loadMore();
  },

  goBack() {
    wx.navigateBack();
  },

  async load() {
    if (this.loadingMessages) return;
    this.loadingMessages = true;
    const version = (this.messagesVersion || 0) + 1;
    this.messagesVersion = version;
    this.setData({ loading: true, loadingMoreMessages: false });
    try {
      const result = await api.requestPage('/booking-messages', { page: 1, limit: PAGE_SIZE });
      if (version !== this.messagesVersion) return;
      this.setData({
        messages: result.items.map(orderUtils.formatMessage),
        messagePage: 1,
        hasMoreMessages: result.hasMore
      });
      if (result.items.length) {
        await api.request('/booking-messages/read', {
          method: 'PATCH',
          data: { through: result.items[0].createdAt }
        });
      }
    } catch (err) {
      wx.showToast({ title: err.message, icon: 'none' });
    } finally {
      this.loadingMessages = false;
      this.setData({ loading: false });
    }
  },

  async loadMore() {
    if (this.loadingMessages || this.data.loadingMoreMessages || !this.data.hasMoreMessages) return;
    const version = this.messagesVersion;
    const page = this.data.messagePage + 1;
    this.setData({ loadingMoreMessages: true });
    try {
      const result = await api.requestPage('/booking-messages', { page, limit: PAGE_SIZE });
      if (version !== this.messagesVersion) return;
      this.setData({
        messages: this.data.messages.concat(result.items.map(orderUtils.formatMessage)),
        messagePage: page,
        hasMoreMessages: result.hasMore
      });
    } catch (err) {
      wx.showToast({ title: err.message, icon: 'none' });
    } finally {
      if (version === this.messagesVersion) this.setData({ loadingMoreMessages: false });
    }
  }
});
