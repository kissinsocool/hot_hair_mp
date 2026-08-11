const assert = require('node:assert/strict');

let bookingPage;
let confirmPage;
let confirmUrl = '';

global.getApp = () => ({
  globalData: {
    apiBaseUrl: 'https://example.com/api',
    mediaBaseUrl: '',
    session: { token: 'token' }
  }
});
global.wx = {
  getStorageSync: () => ({ token: 'token' }),
  navigateTo({ url }) { confirmUrl = url; },
  request(options) {
    const data = options.url.endsWith('/auth/subscription-settings')
      ? { bookingStatusTemplateIds: [] }
      : [];
    options.success({ statusCode: 200, data });
  }
};

global.Page = options => { bookingPage = options; };
require('../pages/booking/booking');

bookingPage.submit.call({
  salonId: 'salon-1',
  data: {
    selectedServiceId: 'service-1',
    selectedStaffId: 'staff-1',
    selectedDate: '2030-01-02',
    selectedTime: '10:30',
    salon: {
      name: '靓丝造型',
      services: [{ id: 'service-1', name: '染发', price: '¥199.00', priceFen: 19900 }],
      staff: [{ id: 'staff-1', name: '小靓', extraServiceFee: 20, extraServiceFeeFen: 2000 }]
    }
  }
});

const payload = JSON.parse(decodeURIComponent(confirmUrl.split('data=')[1]));
assert.equal(payload.servicePriceFen, 19900);
assert.equal(payload.extraServiceFeeFen, 2000);
assert.equal(Object.hasOwn(payload, 'servicePrice'), false);

delete require.cache[require.resolve('../pages/confirm/confirm')];
global.Page = options => { confirmPage = options; };
require('../pages/confirm/confirm');

const page = {
  ...confirmPage,
  data: { ...confirmPage.data },
  setData(values) { Object.assign(this.data, values); }
};
page.onLoad({ data: encodeURIComponent(JSON.stringify(payload)) });

assert.equal(page.data.booking.servicePriceText, '¥199');
assert.equal(page.data.booking.extraFeeText, '¥20');
assert.equal(page.data.booking.totalFen, 21900);
assert.equal(page.data.payableText, '¥219');
