const { formatFenAmount } = require('../../utils/money');

Component({
  properties: {
    coupon: {
      type: Object,
      value: {}
    },
    selectable: {
      type: Boolean,
      value: false
    },
    selected: {
      type: Boolean,
      value: false
    }
  },

  data: {
    title: '优惠券',
    discountText: '0',
    minimumText: '0',
    expiryText: '有效期未设置',
    disabled: false
  },

  observers: {
    coupon(coupon) {
      const status = String((coupon && coupon.status) || '').toLowerCase();
      this.setData({
        title: coupon && coupon.title ? coupon.title : '优惠券',
        discountText: formatFenAmount(coupon && coupon.discountFen),
        minimumText: formatFenAmount(coupon && coupon.minimumSpendFen),
        expiryText: formatExpiry(coupon && (coupon.validUntil || coupon.endDate || coupon.expiresAt)),
        disabled: Boolean(status && !['available', 'unclaimed', 'pending'].includes(status))
      });
    }
  },

  methods: {
    handleTap() {
      if (!this.data.selectable || this.data.disabled) return;
      this.triggerEvent('select', { id: this.data.coupon.id });
    }
  }
});

function formatExpiry(value) {
  if (!value) return '有效期未设置';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return `${value}到期`;
  const pad = (number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}到期`;
}
