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

module.exports = {
  sortCoupons
};
