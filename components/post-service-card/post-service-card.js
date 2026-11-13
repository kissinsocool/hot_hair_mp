const api = require('../../utils/api');
const { servicePriceDisplay } = require('../../utils/money');

// 店铺动态里的关联套餐：在售时显示可预约卡片，下架后只保留名称提示。
Component({
  properties: {
    salonId: { type: String, value: '' },
    service: { type: Object, value: null },
    serviceName: { type: String, value: '' },
    unavailable: { type: Boolean, value: false },
    // 紧凑模式用于详情页横向卡片：左侧名称和简介各一行，右侧粉色价格，不显示标签和左侧标签条。
    compact: { type: Boolean, value: false }
  },

  data: { priceText: '', originalPriceText: '' },

  observers: {
    service(service) {
      if (!service) return;
      const { priceText, originalPriceText } = servicePriceDisplay(service.priceFen, service.discountTenths, service.originalPriceFen);
      this.setData({ priceText, originalPriceText });
    }
  },

  methods: {
    book() {
      const { salonId, service } = this.data;
      if (!salonId || !service || !api.requireLogin()) return;
      wx.navigateTo({ url: `/pages/booking/booking?id=${encodeURIComponent(salonId)}&serviceId=${encodeURIComponent(service.id)}` });
    }
  }
});
