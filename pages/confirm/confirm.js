const api = require('../../utils/api');

Page({
  data: {
    booking: {},
    timeText: '',
    submitting: false,
    successVisible: false
  },

  onLoad(query) {
    const booking = query.data ? JSON.parse(decodeURIComponent(query.data)) : {};
    const start = new Date(booking.startTime);
    const servicePrice = parsePrice(booking.servicePrice);
    const extraFee = Number(booking.extraServiceFee || 0);
    booking.servicePriceText = formatPrice(servicePrice) || booking.servicePrice || '到店确认';
    booking.extraFeeText = formatPrice(extraFee);
    booking.totalText = servicePrice ? formatPrice(servicePrice + extraFee) : booking.servicePriceText;
    booking.dateText = Number.isNaN(start.getTime()) ? '' : booking.startTime.slice(0, 10);
    booking.arrivalTimeText = Number.isNaN(start.getTime()) ? '' : booking.startTime.slice(11, 16);
    this.setData({ booking, timeText: api.formatTime(booking.startTime) });
  },

  async submit() {
    this.setData({ submitting: true });
    try {
      const booking = this.data.booking;
      await api.request('/bookings', {
        method: 'POST',
        data: {
          staffId: booking.staffId,
          serviceId: booking.serviceId,
          startTime: booking.startTime,
          ...(booking.candidateStaffIds && booking.candidateStaffIds.length ? { candidateStaffIds: booking.candidateStaffIds } : {})
        }
      });
      this.setData({ successVisible: true });
    } catch (err) {
      wx.showToast({ title: err.message, icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  openMessages() {
    this.setData({ successVisible: false });
    wx.navigateTo({ url: '/pages/messages/messages' });
  }
});

function parsePrice(value) {
  const digits = String(value || '').replace(/[^\d]/g, '');
  return Number(digits || 0);
}

function formatPrice(value) {
  if (!value) return '¥0';
  return `¥${String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}
