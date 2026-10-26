const { servicePriceDisplay, formatFenAmount } = require('../../utils/money');

Component({
  properties: {
    priceFen: { type: Number, value: 0 },
    originalPriceFen: { type: Number, value: 0 },
    discountTenths: { type: Number, value: 0 },
    compact: { type: Boolean, value: false }
  },
  data: { amountText: '0', discountText: '', originalPriceText: '' },
  observers: {
    'priceFen, discountTenths, originalPriceFen'(priceFen, discountTenths, originalPriceFen) {
      this.setData({
        ...servicePriceDisplay(priceFen, discountTenths, originalPriceFen),
        amountText: formatFenAmount(priceFen)
      });
    }
  }
});
