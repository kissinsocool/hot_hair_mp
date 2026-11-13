const { onShareAppMessage } = require('../../utils/share');
const api = require('../../utils/api');
const app = getApp();
const bookingSocket = require('../../utils/bookingSocket');
const layout = require('../../utils/layout');
const orderUtils = require('../../utils/orders');
const analytics = require('../../utils/analytics');
const freshness = require('../../utils/freshness');
const unreadMessages = require('../../utils/unreadMessages');
const { appendPatch } = require('../../utils/dataPatch');
const PAGE_SIZE = 20;
// 刷新时按已加载的页数一次重新读取，最多为分页接口单次上限 100 条。
const MAX_RELOAD_PAGES = 100 / PAGE_SIZE;
const ONLINE_CANCEL_LEAD_MS = 24 * 60 * 60 * 1000;
const initiallyLoggedIn = Boolean(api.session() && api.session().token);

Page({
  onShareAppMessage,

  data: {
    loggedIn: initiallyLoggedIn,
    loading: initiallyLoggedIn,
    refreshing: false,
    orders: [],
    orderPage: 0,
    hasMoreOrders: false,
    loadingMoreOrders: false,
    statusBarHeight: 0,
    navBarHeight: 44,
    appBarHeight: 44,
    unreadMessageCount: 0
  },

  onLoad() {
    this.setNavSize();
  },

  setNavSize() {
    this.setData(layout.appBarSize());
  },

  onShow() {
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) tabBar.show();
    if (this.unsubscribeBookingSocket) this.unsubscribeBookingSocket();
    this.unsubscribeBookingSocket = null;
    const session = api.session();
    const loggedIn = Boolean(session && session.token);
    this.setData({ loggedIn });
    if (!loggedIn) {
      this.setData({ unreadMessageCount: 0 });
      if (app.globalData.pendingLoginReturnRoute === 'pages/orders/orders') {
        app.globalData.pendingLoginReturnRoute = '';
        wx.switchTab({ url: '/pages/home/home' });
      } else {
        wx.navigateTo({ url: '/pages/login/login' });
      }
      return;
    }
    // 短时间内返回且期间没有本端写操作和预约推送时，保留已加载的分页和滚动位置。
    // 连接断开期间可能漏掉的推送，由下面重新鉴权后的刷新补上。
    if (!freshness.isFresh(this.ordersStamp)) this.load({ keepLoaded: true });
    this.unsubscribeBookingSocket = bookingSocket.subscribe((event) => {
      if (event.event === 'authenticated' || event.event === 'booking.created' || event.event === 'booking.updated') {
        this.load({ keepLoaded: true, forceUnread: true });
      }
    });
  },

  refresh() {
    if (this.data.refreshing) return;
    this.setData({ refreshing: true });
    this.load().finally(() => this.setData({ refreshing: false }));
  },

  onHide() {
    if (this.unsubscribeBookingSocket) this.unsubscribeBookingSocket();
    this.unsubscribeBookingSocket = null;
  },

  onUnload() {
    if (this.unsubscribeBookingSocket) this.unsubscribeBookingSocket();
    this.unsubscribeBookingSocket = null;
  },

  // keepLoaded：重新读取已加载的全部页，推送、取消订单或返回页面时不把用户翻到的列表截回第一页。
  // 下拉刷新等主动刷新只读第一页。
  async load({ keepLoaded = false, forceUnread = false } = {}) {
    if (this.loadingOrders) { this.ordersDirty = true; return; }
    this.loadingOrders = true;
    const requestToken = (api.session() || {}).token;
    const version = (this.ordersVersion || 0) + 1;
    this.ordersVersion = version;
    const stamp = freshness.stamp();
    const pages = keepLoaded ? Math.min(Math.max(1, this.data.orderPage), MAX_RELOAD_PAGES) : 1;
    this.setData({ loading: !this.data.orders.length, loadingMoreOrders: false });
    try {
      const [result, unreadCount] = await Promise.all([
        api.requestPage('/bookings', { page: 1, limit: PAGE_SIZE * pages }),
        // 未读数与首页共用短期缓存；只是角标，读取失败时保留当前值，不影响订单列表。
        unreadMessages.count({ force: forceUnread }).catch(() => this.data.unreadMessageCount)
      ]);
      if (version !== this.ordersVersion || requestToken !== (api.session() || {}).token) return;
      const orders = result.items.map(orderUtils.formatOrder);
      // 完整订单只留在逻辑层，视图层只拿卡片显示的字段。
      this.orderSources = new Map(orders.map((order) => [order.id, order]));
      this.setData({
        orders: orders.map(orderUtils.orderCardView),
        orderPage: pages,
        hasMoreOrders: result.hasMore,
        unreadMessageCount: unreadCount
      });
      this.ordersStamp = stamp;
    } catch (err) {
      wx.showToast({ title: err.message, icon: 'none' });
    } finally {
      this.loadingOrders = false;
      this.setData({ loading: false });
      if (this.ordersDirty) {
        this.ordersDirty = false;
        if ((api.session() || {}).token) this.load({ keepLoaded: true, forceUnread: true });
      }
    }
  },

  async loadMore() {
    if (this.loadingOrders || this.data.loadingMoreOrders || !this.data.hasMoreOrders) return;
    const version = this.ordersVersion;
    const page = this.data.orderPage + 1;
    this.setData({ loadingMoreOrders: true });
    try {
      const result = await api.requestPage('/bookings', { page, limit: PAGE_SIZE });
      if (version !== this.ordersVersion) return;
      const orders = result.items.map(orderUtils.formatOrder);
      orders.forEach((order) => this.orderSources.set(order.id, order));
      this.setData({
        ...appendPatch('orders', this.data.orders, orders.map(orderUtils.orderCardView)),
        orderPage: page,
        hasMoreOrders: result.hasMore
      });
    } catch (err) {
      wx.showToast({ title: err.message, icon: 'none' });
    } finally {
      if (version === this.ordersVersion) this.setData({ loadingMoreOrders: false });
    }
  },

  orderSource(id) {
    return (this.orderSources && this.orderSources.get(id)) || null;
  },

  async cancel(e) {
    const order = this.orderSource(e.currentTarget.dataset.id);
    if (!order) return;
    const canCancelOnline = order.status === 'pending' || order.startTimeMs - Date.now() >= ONLINE_CANCEL_LEAD_MS;
    if (!canCancelOnline) {
      wx.showModal({
        title: '无法直接取消',
        content: '距离到店时间不足24小时，请致电商家，协商后由商家为您取消。\n\n无故取消或未到店累计3次，账号将被停用，无法继续预约。',
        showCancel: false,
        confirmText: '知道了'
      });
      return;
    }
    wx.showModal({
      title: '取消订单',
      content: order.status === 'pending'
        ? '当前订单还在等待商家确认，可以随时取消。确定要取消这次预约吗？'
        : '当前距离到店时间超过24小时，可以直接取消。确定要取消这次预约吗？',
      cancelText: '再想想',
      confirmText: '确认取消',
      confirmColor: '#ff5252',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await api.request(`/bookings/${order.id}/cancel`, { method: 'PATCH' });
          wx.showToast({ title: '订单已取消' });
          this.load({ keepLoaded: true, forceUnread: true });
        } catch (err) {
          wx.showToast({ title: err.message, icon: 'none' });
        }
      }
    });
  },

  review(e) {
    const order = this.orderSource(e.currentTarget.dataset.id);
    if (!order) return;
    const type = e.currentTarget.dataset.type || 'review';
    if ((type === 'review' && order.reviewed) || (type === 'complaint' && order.complained)) return;
    wx.navigateTo({
      url: '/pages/review-editor/review-editor',
      success: ({ eventChannel }) => eventChannel.emit('init', { mode: type, booking: order })
    });
  },

  onSalonImageError(e) {
    const index = this.data.orders.findIndex(item => item.id === e.currentTarget.dataset.id);
    if (index >= 0) this.setData({ [`orders[${index}].salonImageUrl`]: '' });
  },

  openOrderDetail(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/order-detail/order-detail?id=${encodeURIComponent(id)}` });
  },

  rebook(e) {
    const order = this.orderSource(e.currentTarget.dataset.id);
    if (!order) return;
    analytics.track('rebooking_started', {
      salonId: order.salonId,
      serviceId: order.serviceId,
      sourceBookingId: order.id
    });
    wx.navigateTo({
      url: `/pages/booking/booking?id=${order.salonId}&serviceId=${order.serviceId}`
    });
  },

  openMessages() {
    if (!api.requireLogin()) return;
    wx.navigateTo({ url: '/pages/messages/messages' });
  }
});
