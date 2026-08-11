const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

let definition;
let requestedTemplateIds = [];
let apiRequest;
let bookingRequestCount = 0;

global.getApp = () => ({
  globalData: {
    apiBaseUrl: 'https://example.com/api',
    mediaBaseUrl: '',
    session: { token: 'token' }
  }
});
global.Page = options => { definition = options; };
global.wx = {
  getStorageSync: () => ({ token: 'token' }),
  requestSubscribeMessage({ tmplIds, success }) {
    requestedTemplateIds = tmplIds;
    success({ [tmplIds[0]]: 'accept' });
  },
  login({ success }) { success({ code: 'login-code' }); },
  request(options) {
    apiRequest = options;
    if (options.url.endsWith('/bookings')) bookingRequestCount += 1;
    options.success({ statusCode: 200, data: { ok: true } });
  }
};

require('../pages/confirm/confirm');

const page = {
  ...definition,
  data: {
    ...definition.data,
    bookingStatusTemplateIds: ['template-1'],
    booking: {
      salonId: 'salon-1',
      staffId: 'staff-1',
      serviceId: 'service-1',
      startTime: '2030-01-02T10:30:00'
    }
  },
  setData(values) { Object.assign(this.data, values); }
};

(async () => {
  await page.requestBookingSubscription();
  assert.deepEqual(requestedTemplateIds, ['template-1']);
  assert.equal(apiRequest.url, 'https://example.com/api/auth/wechat/openid');
  assert.equal(apiRequest.method, 'POST');
  assert.deepEqual(apiRequest.data, { loginCode: 'login-code' });

  await Promise.all([page.submit(), page.submit()]);
  assert.equal(bookingRequestCount, 1);
  assert.equal(page.data.submitting, false);

  const template = fs.readFileSync(path.join(__dirname, '../pages/confirm/confirm.wxml'), 'utf8');
  assert.match(template, /disabled="\{\{submitting\}\}"/);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
