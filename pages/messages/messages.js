const { onShareAppMessage } = require('../../utils/share');
const api = require('../../utils/api');
const bookingSocket = require('../../utils/bookingSocket');
const unreadMessages = require('../../utils/unreadMessages');
const layout = require('../../utils/layout');
const orderUtils = require('../../utils/orders');
const freshness = require('../../utils/freshness');
const { appendPatch } = require('../../utils/dataPatch');
const PAGE_SIZE = 20;
// 刷新时按已加载的页数一次重新读取，最多为分页接口单次上限 100 条。
const MAX_RELOAD_PAGES = 100 / PAGE_SIZE;

Page({
  onShareAppMessage,

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
  },

  onShow() {
    if (!api.requireLogin()) return;
    if (this.unsubscribeBookingSocket) this.unsubscribeBookingSocket();
    // 短时间内返回且期间没有本端写操作和预约推送时，保留已加载的分页和滚动位置。
    if (!freshness.isFresh(this.messagesStamp)) this.load({ keepLoaded: true });
    this.unsubscribeBookingSocket = bookingSocket.subscribe((event) => {
      if (event.event === 'authenticated' || event.event === 'booking.created' || event.event === 'booking.updated') {
        this.load({ keepLoaded: true });
      }
    });
  },

  onHide() {
    if (this.unsubscribeBookingSocket) this.unsubscribeBookingSocket();
    this.unsubscribeBookingSocket = null;
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

  openOrder(e) {
    const id = e.currentTarget.dataset.id;
    if (id) wx.navigateTo({ url: `/pages/order-detail/order-detail?id=${encodeURIComponent(id)}` });
  },

  goBack() {
    wx.navigateBack();
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/home' });
  },

  // keepLoaded：重新读取已加载的全部页，推送或返回页面时不把用户翻到的列表截回第一页。
  async load({ keepLoaded = false } = {}) {
    if (this.loadingMessages) { this.messagesDirty = true; return; }
    this.loadingMessages = true;
    const requestToken = (api.session() || {}).token;
    const version = (this.messagesVersion || 0) + 1;
    this.messagesVersion = version;
    const pages = keepLoaded ? Math.min(Math.max(1, this.data.messagePage), MAX_RELOAD_PAGES) : 1;
    this.setData({ loading: true, loadingMoreMessages: false });
    try {
      const result = await api.requestPage('/booking-messages', { page: 1, limit: PAGE_SIZE * pages });
      if (version !== this.messagesVersion || requestToken !== (api.session() || {}).token) return;
      this.setData({
        messages: result.items.map((item) => orderUtils.messageView(orderUtils.formatMessage(item))),
        messagePage: pages,
        hasMoreMessages: result.hasMore
      });
      if (result.items.length) {
        await api.request('/booking-messages/read', {
          method: 'PATCH',
          data: { through: result.items[0].createdAt }
        });
        unreadMessages.invalidate();
      }
      // 标记已读是本页自己的写操作，所以在它完成之后记录；
      // 本页可见期间的预约推送由订阅直接触发刷新，不依赖这个时间。
      this.messagesStamp = freshness.stamp();
    } catch (err) {
      wx.showToast({ title: err.message, icon: 'none' });
    } finally {
      this.loadingMessages = false;
      this.setData({ loading: false });
      if (this.messagesDirty) {
        this.messagesDirty = false;
        if ((api.session() || {}).token) this.load({ keepLoaded: true });
      }
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
        ...appendPatch('messages', this.data.messages, result.items.map((item) => orderUtils.messageView(orderUtils.formatMessage(item)))),
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
