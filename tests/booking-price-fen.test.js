const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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

const optionsPage = {
  data: {
    salon: {
      staff: [{ id: 'staff-1', name: 'Tony', extraServiceFeeFen: 39900 }],
      services: [{ id: 'service-1', name: '剪发', durationMinutes: 90, priceFen: 19900 }]
    },
    dates: [],
    slots: [],
    slotsLoading: false,
    selectedStaffId: 'staff-1',
    selectedServiceId: 'service-1',
    selectedDate: '',
    selectedTime: '',
    activeServiceCategory: 'cut'
  },
  setData(values) { Object.assign(this.data, values); }
};
bookingPage.refreshOptions.call(optionsPage);
assert.equal(optionsPage.data.staffOptions[1].extraServiceFeeText, '¥399');
assert.equal(optionsPage.data.serviceOptions[0].durationText, '90 min');

bookingPage.submit.call({
  salonId: 'salon-1',
  data: {
    canSubmit: true,
    selectedServiceId: 'service-1',
    selectedStaffId: 'staff-1',
    selectedDate: '2030-01-02',
    selectedTime: '10:30',
    salon: {
      name: '靓丝造型',
      services: [{ id: 'service-1', name: '剪发', priceFen: 19900 }],
      staff: [{ id: 'staff-1', name: '小靓', extraServiceFeeFen: 2000 }]
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

async function checkServicePricing() {
  const services = [
    { id: 'cut', tagIds: ['wash_cut_blow'], priceFen: 19900 },
    { id: 'color', tagIds: ['color'], priceFen: 19900 },
    { id: 'perm', tagIds: ['perm'], priceFen: 19900 },
    { id: 'care', tagIds: ['scalp_care'], priceFen: 19900 },
    { id: 'nutrition', tagIds: ['nutrition'], priceFen: 19900 },
    { id: 'mixed', tagIds: ['color', 'scalp_care'], priceFen: 19900 }
  ];
  const booking = {
    ...bookingPage,
    salonId: 'salon-1',
    data: {
      ...bookingPage.data,
      salon: { name: 'Salon', services, staff: [{ id: 'staff-1', extraServiceFeeFen: 2000 }] },
      selectedStaffId: 'staff-1'
    },
    setData(values) { Object.assign(this.data, values); }
  };
  for (const [id, category] of [
    ['cut', 'cut'], ['color', 'colorPerm'], ['perm', 'colorPerm'],
    ['care', 'scalpCare'], ['nutrition', 'scalpCare'], ['mixed', 'scalpCare'], ['cut', 'cut']
  ]) {
    booking.selectServiceCategory({ currentTarget: { dataset: { category } } });
    await booking.selectService({ currentTarget: { dataset: { id } } });
    const extraFeeFen = id === 'cut' ? 2000 : 0;
    assert.equal(booking.data.staffOptions[1].extraServiceFeeText, extraFeeFen ? '¥20' : '', id);
    Object.assign(booking.data, {
      canSubmit: true, selectedDate: '2030-01-02', selectedTime: '10:30'
    });
    await booking.submit();
    const data = JSON.parse(decodeURIComponent(confirmUrl.split('data=')[1]));
    assert.equal(data.extraServiceFeeFen, extraFeeFen, id);
    page.onLoad({ data: encodeURIComponent(JSON.stringify(data)) });
    assert.equal(page.data.booking.totalFen, 19900 + extraFeeFen, id);
    // Keep subsequent selection tests independent of availability requests.
    booking.setData({ selectedDate: '' });
  }

  // A tab change must not retain a bookable service hidden in another category.
  Object.assign(booking.data, {
    selectedDate: '2030-01-02', selectedTime: '10:30',
    slots: [{ time: '10:30', isAvailable: true }]
  });
  booking.refreshOptions();
  assert.equal(booking.data.canSubmit, true);
  booking.selectServiceCategory({ currentTarget: { dataset: { category: 'colorPerm' } } });
  assert.equal(booking.data.selectedServiceId, '');
  assert.equal(booking.data.selectedTime, '');
  assert.equal(booking.data.canSubmit, false);
  assert.equal(booking.data.staffOptions[1].extraServiceFeeText, '');
  booking.selectServiceCategory({ currentTarget: { dataset: { category: 'cut' } } });
  assert.equal(booking.data.staffOptions[1].extraServiceFeeText, '¥20');

  booking.setData({ selectedServiceId: 'cut', selectedStaffId: '__no_preference__', canSubmit: true, selectedTime: '10:30' });
  await booking.submit();
  const noPreference = JSON.parse(decodeURIComponent(confirmUrl.split('data=')[1]));
  assert.equal(noPreference.extraServiceFeeFen, 0);

  const template = fs.readFileSync(path.join(__dirname, '../pages/confirm/confirm.wxml'), 'utf8');
  assert.match(template, /wx:if="\{\{booking\.extraServiceFeeFen > 0\}\}"[^>]*><text>理发师额外服务费/);
}

checkServicePricing().catch(error => { console.error(error); process.exitCode = 1; });
