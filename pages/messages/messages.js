const { onShareAppMessage } = require('../../utils/share');
const api = require('../../utils/api');
const bookingSocket = require('../../utils/bookingSocket');
const unreadMessages = require('../../utils/unreadMessages');
const layout = require('../../utils/layout');
const orderUtils = require('../../utils/orders');
const freshness = require('../../utils/freshness');
const loginGate = require('../../utils/loginGate');
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
    // 未登录时打开登录页；用户没有登录就返回时离开本页，不反复跳回登录页。
    if (!loginGate.ensure(this)) return;
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
    const stamp = freshness.stamp();
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
        // 同一批消息已标记过时不重复提交：推送连接鉴权后的补刷新经常读到与刚才相同的内容。
        // 列表里出现任何新消息时这个标识都会变化。
        const readKey = `${requestToken}:${result.items.map((item) => item.id).join(',')}`;
        if (readKey !== this.readKey) {
          await api.request('/booking-messages/read', {
            method: 'PATCH',
            // 标记已读只改变未读数（下面单独失效），不改变订单、收藏、优惠券等页面数据，不必让它们重新读取。
            affectsUserData: false,
            data: { through: result.items[0].createdAt }
          });
          this.readKey = readKey;
          unreadMessages.invalidate();
        }
      }
      this.messagesStamp = stamp;
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
