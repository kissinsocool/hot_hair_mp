const api = require('../../utils/api');
const couponUtils = require('../../utils/coupons');

Page({
  data: {
    booking: {},
    timeText: '',
    coupons: [],
    selectedCouponId: '',
    selectedCoupon: null,
    couponLoading: false,
    couponText: '请选择优惠券',
    couponDiscountText: '',
    payableText: '¥0.00',
    submitting: false,
    successVisible: false
  },

  onLoad(query) {
    const booking = query.data ? JSON.parse(decodeURIComponent(query.data)) : {};
    const start = new Date(booking.startTime);
    const servicePrice = parsePrice(booking.servicePrice);
    const extraFee = Number(booking.extraServiceFee || 0);
    const totalFen = Math.max(0, Math.round((servicePrice + extraFee) * 100));
    booking.servicePriceText = formatPrice(servicePrice) || booking.servicePrice || '到店确认';
    booking.extraFeeText = formatPrice(extraFee);
    booking.totalFen = totalFen;
    booking.totalText = servicePrice ? formatFen(totalFen) : booking.servicePriceText;
    booking.dateText = Number.isNaN(start.getTime()) ? '' : booking.startTime.slice(0, 10);
    booking.arrivalTimeText = Number.isNaN(start.getTime()) ? '' : booking.startTime.slice(11, 16);
    this.setData({
      booking,
      timeText: api.formatTime(booking.startTime),
      payableText: booking.totalText
    });
    this.loadCoupons();
  },

  async loadCoupons() {
    this.setData({ couponLoading: true });
    try {
      const coupons = await api.request('/auth/coupons');
      const eligibleCoupons = couponUtils.sortCoupons(
        coupons.filter((coupon) => (
          String(coupon.status || '').toLowerCase() === 'available'
          && Number(coupon.minimumSpendFen || 0) <= this.data.booking.totalFen
        ))
      );
      const selectedStillEligible = eligibleCoupons.some(
        (coupon) => String(coupon.id) === String(this.data.selectedCouponId)
      );
      this.setData({ coupons: eligibleCoupons });
      this.applyCoupon(selectedStillEligible ? this.data.selectedCouponId : '');
    } catch (err) {
      this.setData({ coupons: [] });
      this.applyCoupon('');
    } finally {
      this.setData({ couponLoading: false });
    }
  },

  chooseCoupon() {
    if (this.data.couponLoading) return;
    wx.navigateTo({
      url: '/pages/coupons/coupons',
      events: {
        selected: ({ id }) => this.applyCoupon(id)
      },
      success: (res) => {
        res.eventChannel.emit('init', {
          coupons: this.data.coupons,
          selectedCouponId: this.data.selectedCouponId
        });
      }
    });
  },

  applyCoupon(id) {
    const selectedCoupon = this.data.coupons.find(
      (coupon) => String(coupon.id) === String(id)
    ) || null;
    const discountFen = selectedCoupon
      ? Math.max(0, Number(selectedCoupon.discountFen || 0))
      : 0;
    this.setData({
      selectedCouponId: selectedCoupon ? selectedCoupon.id : '',
      selectedCoupon,
      couponText: selectedCoupon ? selectedCoupon.title || '优惠券' : '请选择优惠券',
      couponDiscountText: selectedCoupon ? `- ${formatFen(discountFen)}` : '',
      payableText: formatFen(this.data.booking.totalFen - discountFen)
    });
  },

  async submit() {
    this.setData({ submitting: true });
    try {
      const booking = this.data.booking;
      const data = {
        salonId: booking.salonId,
        staffId: booking.staffId,
        serviceId: booking.serviceId,
        startTime: booking.startTime
      };
      if (this.data.selectedCouponId) data.couponId = this.data.selectedCouponId;
      await api.request('/bookings', {
        method: 'POST',
        data
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

function formatFen(value) {
  const amount = Number(value || 0) / 100;
  return `¥${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}
