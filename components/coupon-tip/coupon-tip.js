const api = require('../../utils/api');
const couponUtils = require('../../utils/coupons');
const couponTip = require('../../utils/couponTip');
const couponStore = require('../../utils/couponStore');
const { formatFen } = require('../../utils/money');

// 优惠券提醒卡片，随页面内容排列，外边距由使用方通过 tip-class 指定。
// 用户会参考手里的券挑套餐，所以展示账号下全部可用券，不随所选套餐变化；
// 关闭记录各页面共用，关闭后直到账号里出现新的可用券才再次提醒。
Component({
  externalClasses: ['tip-class'],

  data: {
    visible: false,
    count: 0,
    savingText: ''
  },

  lifetimes: {
    attached() {
      this.refresh();
    }
  },

  pageLifetimes: {
    // 从其他页面返回时刷新：可能刚登录、刚用掉券，或在别的页面关闭过提醒。
    show() {
      this.refresh();
    }
  },

  methods: {
    async refresh() {
      if (this.refreshing) return;
      const session = api.session();
      if (!(session && session.token)) {
        if (this.data.visible) this.setData({ visible: false });
        return;
      }
      this.refreshing = true;
      let coupons = [];
      try {
        coupons = couponUtils.availableCoupons(await couponStore.load());
      } catch (_) {
        // 提醒只是辅助信息，加载失败时静默隐藏。
      } finally {
        this.refreshing = false;
      }
      this.coupons = coupons;
      if (!coupons.length || !couponTip.hasUndismissedCoupon(coupons)) {
        if (this.data.visible) this.setData({ visible: false });
        return;
      }
      // availableCoupons 已按抵扣金额从高到低排序。
      this.setData({
        visible: true,
        count: coupons.length,
        savingText: formatFen(Math.max(0, Number(coupons[0].discountFen) || 0))
      });
    },

    // 点击卡片查看全部优惠券，了解各券门槛和有效期后再挑套餐。
    // 用户已看过券，与点关闭一样记为已处理，之后不再提醒。
    openCoupons() {
      this.dismiss();
      couponUtils.openMyCoupons();
    },

    dismiss() {
      couponTip.dismiss(this.coupons || []);
      this.setData({ visible: false });
    }
  }
});
