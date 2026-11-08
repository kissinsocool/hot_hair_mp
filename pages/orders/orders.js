const { onShareAppMessage } = require('../../utils/share');
const api = require('../../utils/api');
const app = getApp();
const bookingSocket = require('../../utils/bookingSocket');
const layout = require('../../utils/layout');
const orderUtils = require('../../utils/orders');
const analytics = require('../../utils/analytics');
const PAGE_SIZE = 20;
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
    this.load();
    this.unsubscribeBookingSocket = bookingSocket.subscribe((event) => {
      if (event.event === 'authenticated' || event.event === 'booking.created' || event.event === 'booking.updated') {
        this.load();
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

  async load() {
    if (this.loadingOrders) { this.ordersDirty = true; return; }
    this.loadingOrders = true;
    const requestToken = (api.session() || {}).token;
    const version = (this.ordersVersion || 0) + 1;
    this.ordersVersion = version;
    this.setData({ loading: !this.data.orders.length, loadingMoreOrders: false });
    try {
      const [result, unread] = await Promise.all([
        api.requestPage('/bookings', { page: 1, limit: PAGE_SIZE }),
        api.request('/booking-messages/unread-count')
      ]);
      if (version !== this.ordersVersion || requestToken !== (api.session() || {}).token) return;
      this.setData({
        orders: result.items.map(orderUtils.formatOrder),
        orderPage: 1,
        hasMoreOrders: result.hasMore,
        unreadMessageCount: Number(unread.count) || 0
      });
    } catch (err) {
      wx.showToast({ title: err.message, icon: 'none' });
    } finally {
      this.loadingOrders = false;
      this.setData({ loading: false });
      if (this.ordersDirty) {
        this.ordersDirty = false;
        if ((api.session() || {}).token) this.load();
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
      this.setData({
        orders: this.data.orders.concat(result.items.map(orderUtils.formatOrder)),
        orderPage: page,
        hasMoreOrders: result.hasMore
      });
    } catch (err) {
      wx.showToast({ title: err.message, icon: 'none' });
    } finally {
      if (version === this.ordersVersion) this.setData({ loadingMoreOrders: false });
    }
  },

  async cancel(e) {
    const order = this.data.orders.find((item) => item.id === e.currentTarget.dataset.id);
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
          this.load();
        } catch (err) {
          wx.showToast({ title: err.message, icon: 'none' });
        }
      }
    });
  },

  review(e) {
    const order = this.data.orders.find((item) => item.id === e.currentTarget.dataset.id);
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
    const order = this.data.orders.find((item) => item.id === e.currentTarget.dataset.id);
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
