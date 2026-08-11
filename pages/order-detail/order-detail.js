const api = require('../../utils/api');
const orderUtils = require('../../utils/orders');
const analytics = require('../../utils/analytics');

Page({
  data: {
    loading: true,
    errorMessage: '',
    order: null,
    canceling: false
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

  callSalon() {
    const phone = this.data.order && this.data.order.salonPhone;
    if (!phone) {
      wx.showToast({ title: '门店暂未配置电话', icon: 'none' });
      return;
    }
    wx.makePhoneCall({ phoneNumber: phone });
  },

  openMap() {
    const order = this.data.order || {};
    const coordinates = salonCoordinates(order);
    if (!coordinates) {
      wx.showToast({ title: '门店暂未配置导航位置', icon: 'none' });
      return;
    }
    wx.openLocation({
      ...coordinates,
      name: order.salonName || '预约门店',
      address: order.salonAddress || '',
      scale: 16,
      fail: () => wx.showToast({ title: '地图打开失败', icon: 'none' })
    });
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
  },

  cancel() {
    const order = this.data.order;
    if (!order || this.data.canceling) return;
    const canCancelOnline = order.status === 'pending'
      || order.startTimeMs - Date.now() >= 3 * 60 * 60 * 1000;
    if (!canCancelOnline) {
      wx.showModal({
        title: '无法直接取消',
        content: '距离预约开始不足3小时，请给商家打电话协商，由商家为您取消。',
        showCancel: false,
        confirmText: '知道了'
      });
      return;
    }
    wx.showModal({
      title: '取消订单',
      content: '确定要取消这次预约吗？',
      cancelText: '再想想',
      confirmText: '确认取消',
      confirmColor: '#ff5252',
      success: async (result) => {
        if (!result.confirm) return;
        this.setData({ canceling: true });
        try {
          await api.request(`/bookings/${encodeURIComponent(order.id)}/cancel`, { method: 'PATCH' });
          wx.showToast({ title: '订单已取消' });
          await this.load();
        } catch (err) {
          wx.showToast({ title: err.message, icon: 'none' });
        } finally {
          this.setData({ canceling: false });
        }
      }
    });
  }
});

function salonCoordinates(order = {}) {
  const location = order.salonLocation || {};
  const geoCoordinates = order.salonGeoLocation && order.salonGeoLocation.coordinates;
  const latitude = Number(location.latitude ?? location.lat ?? (geoCoordinates && geoCoordinates[1]));
  const longitude = Number(location.longitude ?? location.lng ?? location.lon ?? (geoCoordinates && geoCoordinates[0]));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}
