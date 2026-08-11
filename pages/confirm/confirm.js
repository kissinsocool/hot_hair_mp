const api = require('../../utils/api');
const couponUtils = require('../../utils/coupons');
const { formatFen } = require('../../utils/money');

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
    bookingStatusTemplateIds: [],
    submitting: false,
    successVisible: false
  },

  onLoad(query) {
    const booking = query.data ? JSON.parse(decodeURIComponent(query.data)) : {};
    const start = new Date(booking.startTime);
    const servicePriceFen = nonNegativeFen(booking.servicePriceFen);
    const extraServiceFeeFen = nonNegativeFen(booking.extraServiceFeeFen);
    const totalFen = servicePriceFen + extraServiceFeeFen;
    booking.servicePriceText = formatFen(servicePriceFen);
    booking.extraFeeText = formatFen(extraServiceFeeFen);
    booking.totalFen = totalFen;
    booking.totalText = formatFen(totalFen);
    booking.dateText = Number.isNaN(start.getTime()) ? '' : booking.startTime.slice(0, 10);
    booking.arrivalTimeText = Number.isNaN(start.getTime()) ? '' : booking.startTime.slice(11, 16);
    this.setData({
      booking,
      timeText: api.formatTime(booking.startTime),
      payableText: booking.totalText
    });
    this.loadCoupons();
    this.loadSubscriptionSettings();
  },

  async loadSubscriptionSettings() {
    try {
      const settings = await api.request('/auth/subscription-settings');
      this.setData({
        bookingStatusTemplateIds: Array.isArray(settings.bookingStatusTemplateIds)
          ? settings.bookingStatusTemplateIds.filter(Boolean).slice(0, 3)
          : []
      });
    } catch (_) {}
  },

  requestBookingSubscription() {
    const tmplIds = this.data.bookingStatusTemplateIds;
    if (!tmplIds.length || !wx.requestSubscribeMessage) return Promise.resolve();
    return new Promise((resolve) => {
      wx.requestSubscribeMessage({
        tmplIds,
        success: (result) => {
          if (!tmplIds.some((id) => result[id] === 'accept')) return resolve();
          wx.login({
            success: ({ code }) => {
              if (!code) return resolve();
              api.request('/auth/wechat/openid', {
                method: 'POST',
                data: { loginCode: code }
              }).then(resolve).catch(resolve);
            },
            fail: resolve
          });
        },
        fail: resolve
      });
    });
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
    if (this._submitting) return;
    this._submitting = true;
    this.setData({ submitting: true });
    try {
      await this.requestBookingSubscription();
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
      this._submitting = false;
      this.setData({ submitting: false });
    }
  },

  openMessages() {
    this.setData({ successVisible: false });
    wx.navigateTo({ url: '/pages/messages/messages' });
  }
});

function nonNegativeFen(value) {
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : 0;
}
