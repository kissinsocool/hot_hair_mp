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
        discountText: formatFen(coupon && coupon.discountFen),
        minimumText: formatFen(coupon && coupon.minimumSpendFen),
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

function formatFen(value) {
  const amount = Number(value || 0) / 100;
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function formatExpiry(value) {
  if (!value) return '有效期未设置';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return `${value}到期`;
  const pad = (number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}到期`;
}
