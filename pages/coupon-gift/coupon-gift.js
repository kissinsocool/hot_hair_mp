const api = require('../../utils/api');
const couponCampaign = require('../../utils/couponCampaign');
const { onShareAppMessage } = require('../../utils/share');

Page({
  onShareAppMessage,

  data: {
    loggedIn: false,
    claiming: false,
    claimed: false,
    errorMessage: ''
  },

  onShow() {
    const session = api.session();
    const loggedIn = Boolean(session && session.token);
    this.setData({ loggedIn });
    if (loggedIn && !this.claimAttempted) return this.claim();
  },

  async claim() {
    if (this.data.claiming || this.data.claimed || !api.requireLogin()) return;
    this.claimAttempted = true;
    this.setData({ claiming: true, errorMessage: '' });
    try {
      const coupons = await api.request('/auth/coupons');
      const giftCoupons = coupons.filter((coupon) => (
        ['99-20', '199-30'].includes(coupon.couponType)
      ));
      if (giftCoupons.length && giftCoupons.every((coupon) => Boolean(coupon.claimedAt))) {
        this.setData({ claimed: true });
        return;
      }
      await couponCampaign.claim();
      this.setData({ claimed: true });
      wx.showToast({ title: '新人礼包领取成功', icon: 'success' });
      this.viewCoupons();
    } catch (err) {
      this.setData({ errorMessage: err.message || '领取失败，请稍后重试' });
    } finally {
      this.setData({ claiming: false });
    }
  },

  viewCoupons() {
    wx.switchTab({
      url: '/pages/profile/profile',
      success() {
        const pages = getCurrentPages();
        const profile = pages[pages.length - 1];
        if (profile && profile.route === 'pages/profile/profile') {
          profile.setData({ activeTab: 'coupons' });
        }
      }
    });
  }
});
