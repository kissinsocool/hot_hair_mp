const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

let pageDefinition;
let requestUrl = '';
let navigateUrl = '';

global.getApp = () => ({
  globalData: {
    apiBaseUrl: 'https://example.com/api',
    mediaBaseUrl: '',
    session: { token: 'token' }
  }
});
global.Page = options => { pageDefinition = options; };
global.wx = {
  getStorageSync: () => ({ token: 'token' }),
  request(options) {
    requestUrl = options.url;
    options.success({
      statusCode: 200,
      data: {
        id: 'booking-1',
        salonId: 'salon-1',
        salonName: '靓丝造型',
        salonPhone: '010-12345678',
        salonAddress: '北京市东城区测试路1号',
        staffId: 'staff-1',
        staffName: '小靓',
        serviceId: 'service-1',
        serviceName: '剪发',
        servicePriceFen: 19900,
        staffExtraServiceFeeFen: 2000,
        originalAmountFen: 21900,
        couponTitle: '新人券',
        couponDiscountFen: 3000,
        payableAmountFen: 18900,
        status: 'rejected',
        rejectReason: '该时间段无法接单',
        startTime: '2030-01-02T10:30:00+08:00',
        createdAt: '2030-01-01T10:00:00+08:00',
        complaint: {
          reviewStatus: 'pending',
          description: '服务问题',
          createdAt: '2030-01-03T10:00:00+08:00'
        }
      }
    });
  },
  navigateTo({ url }) { navigateUrl = url; }
};

require('../pages/order-detail/order-detail');

const page = {
  ...pageDefinition,
  bookingId: 'booking-1',
  data: { ...pageDefinition.data },
  setData(values) { Object.assign(this.data, values); }
};

page.load().then(() => {
  assert.equal(requestUrl, 'https://example.com/api/bookings/booking-1');
  assert.equal(page.data.order.payableAmountText, '¥189');
  assert.equal(page.data.order.couponDiscountText, '- ¥30');
  assert.equal(page.data.order.reasonText, '该时间段无法接单');
  assert.equal(page.data.order.complaint.statusText, '审核中');

  page.openSalon();
  assert.equal(navigateUrl, '/pages/detail/detail?id=salon-1');

  const root = path.join(__dirname, '..');
  const appConfig = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
  const ordersTemplate = fs.readFileSync(path.join(root, 'pages/orders/orders.wxml'), 'utf8');
  const detailTemplate = fs.readFileSync(path.join(root, 'pages/order-detail/order-detail.wxml'), 'utf8');
  const detailStyles = fs.readFileSync(path.join(root, 'pages/order-detail/order-detail.wxss'), 'utf8');
  assert.ok(appConfig.pages.includes('pages/order-detail/order-detail'));
  assert.match(ordersTemplate, /bindtap="openOrderDetail" data-id="\{\{item\.id\}\}"/);
  assert.match(detailTemplate, /费用明细/);
  assert.match(detailTemplate, /投诉进度/);
  assert.match(detailTemplate, /订单编号：\{\{order\.orderNo\}\}<\/view>\s*<view class="order-number">下单时间：\{\{order\.createdTimeText\}\}<\/view>/);
  assert.match(detailTemplate, /class="salon-link" bindtap="openSalon"><text>\{\{order\.salonName\}\}<\/text>/);
  assert.doesNotMatch(detailTemplate, /联系门店|地图导航|bindtap="cancel"/);
  assert.match(detailStyles, /\.row > text:first-child/);
  assert.match(detailStyles, /\.order-number\s*\{[^}]*font-size:\s*26rpx;[^}]*font-weight:\s*400;/s);
  assert.match(detailStyles, /\.salon-link\s*\{[^}]*color:\s*#d06884;/s);
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
