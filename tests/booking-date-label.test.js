const assert = require('node:assert/strict');

let pageDefinition;
global.getApp = () => ({
  globalData: {
    apiBaseUrl: 'https://example.com/api',
    mediaBaseUrl: '',
    session: { token: 'token' }
  }
});
global.Page = (options) => { pageDefinition = options; };
global.wx = {
  getStorageSync: (key) => key === 'analyticsAnonymousId' ? 'anonymous-id' : { token: 'token' },
  setStorageSync() {},
  request(options) {
    const data = options.url.includes('/salons/')
      ? { services: [], staff: [], closedDates: [] }
      : [];
    options.success({ statusCode: 200, data });
  },
  showToast() {}
};

require('../pages/booking/booking');

const page = {
  ...pageDefinition,
  salonId: 'salon-1',
  data: { ...pageDefinition.data },
  setData(values) { Object.assign(this.data, values); }
};

page.load().then(() => {
  assert.equal(page.data.dates[0].label, '今天');
  assert.equal(page.data.dates[1].label, '明天');
  assert.match(page.data.dates[2].label, /^周[日一二三四五六]$/);
  assert.equal(page.data.dates[0].isRelativeDate, true);
  assert.equal(page.data.dates[1].isRelativeDate, true);
  assert.equal(page.data.dates[2].isRelativeDate, false);
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
