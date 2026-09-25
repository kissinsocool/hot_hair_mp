Page({
  data: {
    coupons: [],
    selectedCouponId: ''
  },

  onLoad() {
    this.eventChannel = this.getOpenerEventChannel();
    this.eventChannel.on('init', ({ coupons = [], selectedCouponId = '' }) => {
      this.setData({
        coupons: markSelected(coupons, selectedCouponId),
        selectedCouponId
      });
    });
  },

  selectCoupon(e) {
    const id = String(e.detail.id) === String(this.data.selectedCouponId) ? '' : e.detail.id;
    this.setData({
      coupons: markSelected(this.data.coupons, id),
      selectedCouponId: id
    });
    this.eventChannel.emit('selected', { id });
  }
});

function markSelected(coupons, selectedId) {
  return coupons.map((coupon) => ({
    ...coupon,
    selected: String(coupon.id) === String(selectedId)
  }));
}
