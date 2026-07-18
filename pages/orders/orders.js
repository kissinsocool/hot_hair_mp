const api = require('../../utils/api');
const bookingSocket = require('../../utils/bookingSocket');
const layout = require('../../utils/layout');
const messages = require('../../utils/messages');
const orderUtils = require('../../utils/orders');
const MAX_IMAGE_BASE64_LENGTH = Math.ceil(800 * 1024 * 4 / 3);

Page({
  data: {
    loggedIn: false,
    loading: false,
    orders: [],
    sheetVisible: false,
    sheetType: 'review',
    sheetOrder: null,
    sheetRating: 0,
    sheetStars: buildStars(0),
    sheetContent: '',
    sheetImages: [],
    sheetSubmitting: false,
    statusBarHeight: 0,
    navBarHeight: 44,
    appBarHeight: 44,
    hasUnreadMessages: false
  },

  onLoad() {
    this.setNavSize();
  },

  setNavSize() {
    this.setData(layout.appBarSize());
  },

  onShow() {
    if (this.unsubscribeBookingSocket) this.unsubscribeBookingSocket();
    this.unsubscribeBookingSocket = null;
    const session = api.session();
    const loggedIn = Boolean(session && session.token);
    this.setData({ loggedIn });
    if (!loggedIn) {
      this.setData({ hasUnreadMessages: false });
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    this.load();
    this.unsubscribeBookingSocket = bookingSocket.subscribe((event) => {
      if (event.event === 'booking.created' || event.event === 'booking.updated') {
        this.load();
      }
    });
  },

  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh());
  },

  onHide() {
    if (this.unsubscribeBookingSocket) this.unsubscribeBookingSocket();
    this.unsubscribeBookingSocket = null;
    if (!this.data.sheetVisible) this.getTabBar().show();
  },

  onUnload() {
    if (this.unsubscribeBookingSocket) this.unsubscribeBookingSocket();
    this.unsubscribeBookingSocket = null;
  },

  async load() {
    this.setData({ loading: !this.data.orders.length });
    try {
      const orders = await api.requestAllPages('/bookings');
      const readKey = wx.getStorageSync(messages.READ_KEY) || '';
      this.setData({
        orders: orders.map(orderUtils.formatOrder),
        hasUnreadMessages: messages.hasUnreadBookingMessages(orders, readKey)
      });
    } catch (err) {
      wx.showToast({ title: err.message, icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  async cancel(e) {
    const order = this.data.orders.find((item) => item.id === e.currentTarget.dataset.id);
    if (!order) return;
    const canCancelOnline = order.status === 'pending' || order.startTimeMs - Date.now() >= 3 * 60 * 60 * 1000;
    if (!canCancelOnline) {
      wx.showModal({
        title: '无法直接取消',
        content: '距离预约开始不足3小时，请给商家打电话协商，由商家为您取消。\n\n如果直接爽约累计3次，账号将被拉黑。',
        showCancel: false,
        confirmText: '知道了'
      });
      return;
    }
    wx.showModal({
      title: '取消订单',
      content: order.status === 'pending'
        ? '当前订单还在等待商家确认，可以随时取消。确定要取消这次预约吗？'
        : '当前距离预约开始超过3小时，可以直接取消。确定要取消这次预约吗？',
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
    this.getTabBar().hide();
    this.setData({
      sheetVisible: true,
      sheetType: type,
      sheetOrder: order,
      sheetRating: 0,
      sheetStars: buildStars(0),
      sheetContent: '',
      sheetImages: [],
      sheetSubmitting: false
    });
  },

  openOrderSalon(e) {
    const salonId = e.currentTarget.dataset.salonId;
    if (!salonId) return;
    wx.navigateTo({ url: `/pages/detail/detail?id=${salonId}` });
  },

  openMessages() {
    if (!api.requireLogin()) return;
    wx.navigateTo({ url: '/pages/messages/messages' });
  },

  closeSheet() {
    if (this.data.sheetSubmitting) return;
    this.getTabBar().show();
    this.setData({ sheetVisible: false });
  },

  chooseRating(e) {
    const rating = Number(e.currentTarget.dataset.value);
    this.setData({ sheetRating: rating, sheetStars: buildStars(rating) });
  },

  onSheetContent(e) {
    this.setData({ sheetContent: e.detail.value });
  },

  pickImages() {
    const remain = 5 - this.data.sheetImages.length;
    if (remain <= 0) return;
    wx.chooseMedia({
      count: remain,
      mediaType: ['image'],
      sizeType: ['compressed'],
      success: async (res) => {
        const fs = wx.getFileSystemManager();
        const additions = [];
        for (const file of res.tempFiles || []) {
          try {
            const tempPath = await compressImage(file.tempFilePath);
            const data = fs.readFileSync(tempPath, 'base64');
            if (data.length > MAX_IMAGE_BASE64_LENGTH) {
              wx.showToast({ title: '图片过大，请换一张', icon: 'none' });
              continue;
            }
            additions.push({
              tempPath,
              fileName: tempPath.split('/').pop() || 'image.jpg',
              data
            });
          } catch (_) {}
        }
        this.setData({ sheetImages: this.data.sheetImages.concat(additions).slice(0, 5) });
      }
    });
  },

  removeImage(e) {
    const index = Number(e.currentTarget.dataset.index);
    const sheetImages = this.data.sheetImages.filter((_, idx) => idx !== index);
    this.setData({ sheetImages });
  },

  async submitSheet() {
    const content = this.data.sheetContent.trim();
    const isReview = this.data.sheetType === 'review';
    if (isReview && !this.data.sheetRating) {
      wx.showToast({ title: '请先选择星级', icon: 'none' });
      return;
    }
    if (!content) {
      wx.showToast({ title: isReview ? '请输入具体评价' : '请输入问题描述', icon: 'none' });
      return;
    }
    this.setData({ sheetSubmitting: true });
    try {
      const id = this.data.sheetOrder.id;
      const images = this.data.sheetImages.map(({ fileName, data }) => ({ fileName, data }));
      await api.request(isReview ? `/bookings/${id}/review` : `/bookings/${id}/complaint`, {
        method: 'POST',
        data: isReview
          ? { rating: this.data.sheetRating, comment: content, images }
          : { description: content, images }
      });
      wx.showToast({ title: isReview ? '评价晒单已提交' : '投诉已提交' });
      this.getTabBar().show();
      this.setData({ sheetVisible: false });
      this.load();
    } catch (err) {
      wx.showToast({ title: err.message || '提交失败，请稍后重试', icon: 'none' });
    } finally {
      this.setData({ sheetSubmitting: false });
    }
  }
});

function buildStars(rating) {
  return [1, 2, 3, 4, 5].map((value) => ({
    value,
    selected: value <= rating,
    icon: value <= rating ? '/assets/icons/star_gold.png' : '/assets/icons/star_border.png'
  }));
}

function compressImage(src) {
  return new Promise((resolve) => {
    if (!wx.compressImage) return resolve(src);
    wx.compressImage({
      src,
      quality: 35,
      success: (res) => resolve(res.tempFilePath || src),
      fail: () => resolve(src)
    });
  });
}
