const assert = require('node:assert/strict');

let pageDefinition;
let navigateCount = 0;
let navigateBackCount = 0;
let switchedTab = '';
const app = {
  globalData: { apiBaseUrl: 'https://example.com/api', mediaBaseUrl: '', session: null }
};

global.getApp = () => app;
global.wx = {
  getStorageSync: () => app.globalData.session,
  setStorageSync() {},
  navigateTo() { navigateCount += 1; },
  navigateBack() { navigateBackCount += 1; },
  switchTab({ url }) { switchedTab = url; },
  request(options) {
    const path = options.url.replace('https://example.com/api', '');
    const data = path === '/salons/salon-1'
      ? { id: 'salon-1', services: [], staff: [], closedDates: [] }
      : [];
    options.success({ statusCode: 200, data });
  }
};
global.Page = (options) => { pageDefinition = options; };

require('../pages/booking/booking');

const page = {
  ...pageDefinition,
  data: { ...pageDefinition.data },
  setData(values) { Object.assign(this.data, values); }
};

async function main() {
  const cancelledPage = {
    ...pageDefinition,
    data: { ...pageDefinition.data },
    setData(values) { Object.assign(this.data, values); }
  };
  cancelledPage.onLoad({ id: 'salon-1' });
  assert.equal(navigateCount, 1);
  cancelledPage.onHide();
  await cancelledPage.onShow();
  assert.equal(navigateBackCount, 1);
  assert.equal(switchedTab, '');
  assert.equal(cancelledPage.data.loading, false);

  page.onLoad({ id: 'salon-1' });
  assert.equal(navigateCount, 2);
  page.onHide();

  app.globalData.session = { token: 'token' };
  await page.onShow();

  assert.equal(page.data.salon.id, 'salon-1');
  assert.equal(page.data.loading, false);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
