const SELECTABLE_STATUSES = ['available', 'unclaimed', 'pending'];

function isSelectable(coupon) {
  return SELECTABLE_STATUSES.includes(String(coupon.status || '').toLowerCase());
}

function sortCoupons(coupons) {
  return [...coupons].sort((left, right) => {
    const selectableOrder = Number(isSelectable(right)) - Number(isSelectable(left));
    if (selectableOrder) return selectableOrder;
    if (isSelectable(left)) {
      return Number(right.discountFen || 0) - Number(left.discountFen || 0);
    }
    return 0;
  });
}

// 账号下状态为可用的券，按抵扣金额从高到低排序（预约页优惠券提醒使用）。
function availableCoupons(coupons) {
  return sortCoupons((Array.isArray(coupons) ? coupons : [])
    .filter((coupon) => String(coupon.status || '').toLowerCase() === 'available'));
}

// 在可用券基础上再满足订单金额门槛（确认页可选的券）。
function usableCoupons(coupons, totalFen) {
  return availableCoupons(coupons)
    .filter((coupon) => Number(coupon.minimumSpendFen || 0) <= totalFen);
}

// 打开「我」页的优惠券列表。
function openMyCoupons() {
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

module.exports = {
  openMyCoupons,
  sortCoupons,
  availableCoupons,
  usableCoupons
};
