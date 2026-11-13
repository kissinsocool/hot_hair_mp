const { onShareAppMessage } = require('../../utils/share');
const api = require('../../utils/api');
const couponUtils = require('../../utils/coupons');
const couponStore = require('../../utils/couponStore');
const { formatFen } = require('../../utils/money');

// 后端 POST /bookings 允许 note 最长 500 字；前端收紧到 200 字，便于商家快速阅读。
const NOTE_MAX_LENGTH = 200;

Page({
  onShareAppMessage,

  data: {
    booking: {},
    timeText: '',
    coupons: [],
    selectedCouponId: '',
    selectedCoupon: null,
    couponLoading: false,
    // 优惠券读取失败与「没有可用券」区分开，避免用户误以为自己没有券。
    couponLoadFailed: false,
    couponText: '请选择优惠券',
    couponDiscountText: '',
    payableText: '¥0.00',
    bookingStatusTemplateIds: [],
    note: '',
    noteMaxLength: NOTE_MAX_LENGTH,
    submitting: false,
    // 预约已创建：本页不再允许提交，避免关闭成功提示或返回后重复下单。
    submitted: false,
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

  // 商家接单时会立即发送提醒。用户同意订阅后，先完成 OpenID 绑定再创建预约。
  requestBookingSubscription() {
    const tmplIds = this.data.bookingStatusTemplateIds;
    if (!tmplIds.length || !wx.requestSubscribeMessage) return Promise.resolve();
    return new Promise((resolve) => {
      wx.requestSubscribeMessage({
        tmplIds,
        success: (result) => {
          if (!tmplIds.some((id) => result[id] === 'accept')) return resolve();
          this.bindSubscriptionOpenId().then(resolve, resolve);
        },
        fail: resolve
      });
    });
  },

  bindSubscriptionOpenId() {
    return new Promise((resolve, reject) => {
      wx.login({
        success: ({ code }) => {
          if (!code) return resolve();
          api.request('/auth/wechat/openid', {
            method: 'POST',
            affectsUserData: false,
            // 微信换取 OpenID 失败也返回 401，预约请求会单独处理真实的会话失效。
            skipUnauthorized: true,
            data: { loginCode: code }
          }).then(resolve, reject);
        },
        fail: resolve
      });
    });
  },

  // force：价格或券状态发生变化后重新核对，不使用共享缓存。
  async loadCoupons({ force = false } = {}) {
    this.setData({ couponLoading: true, couponLoadFailed: false });
    try {
      const coupons = await couponStore.load({ force });
      const eligibleCoupons = couponUtils.usableCoupons(coupons, this.data.booking.totalFen);
      const selectedStillEligible = eligibleCoupons.some(
        (coupon) => String(coupon.id) === String(this.data.selectedCouponId)
      );
      this.setData({ coupons: eligibleCoupons });
      this.applyCoupon(selectedStillEligible ? this.data.selectedCouponId : '');
    } catch (err) {
      this.setData({ coupons: [], couponLoadFailed: true });
      this.applyCoupon('');
    } finally {
      this.setData({ couponLoading: false });
    }
  },

  chooseCoupon() {
    if (this.data.couponLoading) return;
    if (this.data.couponLoadFailed) return this.loadCoupons({ force: true });
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

  onNoteInput(e) {
    this.setData({ note: String(e.detail.value || '').slice(0, NOTE_MAX_LENGTH) });
  },

  async submit() {
    if (this._submitting || this.data.submitted) return;
    this._submitting = true;
    this.setData({ submitting: true });
    try {
      await this.requestBookingSubscription();
      const booking = this.data.booking;
      // A retry from this page must refer to the same booking attempt.
      if (!this.clientRequestId) {
        this.clientRequestId = [Date.now(), Math.random().toString(36).slice(2), Math.random().toString(36).slice(2)].join('-');
      }
      const data = {
        clientRequestId: this.clientRequestId,
        salonId: booking.salonId,
        staffId: booking.staffId,
        serviceId: booking.serviceId,
        startTime: booking.startTime,
        expectedOriginalAmountFen: booking.totalFen,
        expectedPayableAmountFen: booking.totalFen - (this.data.selectedCoupon ? nonNegativeFen(this.data.selectedCoupon.discountFen) : 0)
      };
      if (this.data.selectedCouponId) data.couponId = this.data.selectedCouponId;
      const note = this.data.note.trim();
      if (note) data.note = note;
      const result = await api.request('/bookings', {
        method: 'POST',
        data
      });
      if (result && result.booking) {
        const actual = result.booking;
        this.updatePrice({
          servicePriceFen: actual.servicePriceFen,
          extraServiceFeeFen: actual.staffExtraServiceFeeFen,
          originalAmountFen: actual.originalAmountFen,
          couponDiscountFen: actual.couponDiscountFen,
          payableAmountFen: actual.payableAmountFen
        });
      }
      this.setData({ submitted: true, successVisible: true });
    } catch (err) {
      if (err.code === 'BOOKING_PRICE_CHANGED' && err.data && err.data.quote) {
        this.updatePrice(err.data.quote);
        await this.loadCoupons({ force: true });
        wx.showModal({ title: '价格已更新', content: '套餐价格或优惠已变更，请核对新金额后再次提交。', showCancel: false });
      } else if (err.code === 'BOOKING_SLOT_UNAVAILABLE') {
        // 所选时间已不可约（被他人约走、理发师不可用、休息日等）：回到预约页重新选时间。
        // 预约页返回时会重新读取时间段，并保留仍有效的套餐、理发师和日期。
        wx.showModal({
          title: '该时间已不可预约',
          content: err.message || '请重新选择预约时间',
          showCancel: false,
          // 微信限制按钮文字最多 4 个汉字，超出时弹窗调用失败。
          confirmText: '重新选择',
          success: () => wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/home/home' }) })
        });
      } else if (err.timeout) {
        // 请求超时时预约可能已经创建，直接重试可能重复下单，先让用户到订单页核对。
        wx.showModal({
          title: '提交结果未确认',
          content: '网络超时，预约可能已提交成功。请先到「订单」页查看，确认没有这笔预约后再重新提交。',
          confirmText: '查看订单',
          cancelText: '稍后再说',
          success: ({ confirm }) => { if (confirm) wx.switchTab({ url: '/pages/orders/orders' }); }
        });
      } else {
        if (err.statusCode === 409) await this.loadCoupons({ force: true });
        wx.showToast({ title: err.message, icon: 'none' });
      }
    } finally {
      this._submitting = false;
      this.setData({ submitting: false });
    }
  },

  updatePrice(quote) {
    const booking = {
      ...this.data.booking,
      servicePriceFen: quote.servicePriceFen,
      extraServiceFeeFen: quote.extraServiceFeeFen,
      servicePriceText: formatFen(quote.servicePriceFen),
      extraFeeText: formatFen(quote.extraServiceFeeFen),
      totalFen: quote.originalAmountFen,
      totalText: formatFen(quote.originalAmountFen)
    };
    this.setData({
      booking,
      payableText: formatFen(quote.payableAmountFen),
      couponDiscountText: quote.couponDiscountFen ? `- ${formatFen(quote.couponDiscountFen)}` : ''
    });
  },

  // 用消息页替换确认页：预约已提交，返回时回到预约页（会刷新时间段），而不是回到可再次提交的确认页。
  openMessages() {
    wx.redirectTo({ url: '/pages/messages/messages' });
  }
});

function nonNegativeFen(value) {
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : 0;
}
