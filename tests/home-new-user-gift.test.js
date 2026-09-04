const assert = require('node:assert/strict');

let storedSession = null;
let requestOptions;
let navigatedTo = '';
const app = {
  globalData: {
    apiBaseUrl: 'https://example.com/api',
    mediaBaseUrl: '',
    session: null
  }
};

global.getApp = () => app;
global.Page = (options) => { global.homePageDefinition = options; };
global.wx = {
  getStorageSync: () => storedSession,
  request: (options) => { requestOptions = options; },
  navigateTo: ({ url }) => { navigatedTo = url; }
};

require('../pages/home/home');

const page = {
  ...global.homePageDefinition,
  data: { ...global.homePageDefinition.data },
  setData(values) { Object.assign(this.data, values); }
};

async function main() {
  const publicLoading = page.loadNewUserGift();
  assert.equal(requestOptions.url, 'https://example.com/api/coupon-campaign');
  assert.equal(requestOptions.header.Authorization, undefined);
  requestOptions.success({
    statusCode: 200,
    data: {
      enabled: true,
      promotionImageUrl: '/new-user-gift.jpg'
    }
  });
  await publicLoading;
  assert.equal(page.data.newUserGiftVisible, true);
  assert.equal(page.data.newUserGiftImage, 'https://example.com/new-user-gift.jpg');

  await page.claimNewUserGift();
  assert.equal(navigatedTo, '/pages/login/login');

  storedSession = { token: 'new-user-token' };
  app.globalData.session = storedSession;
  const loading = page.loadNewUserGift();
  assert.equal(requestOptions.url, 'https://example.com/api/auth/coupon-campaign');
  assert.equal(requestOptions.header.Authorization, 'Bearer new-user-token');
  requestOptions.success({
    statusCode: 200,
    data: {
      enabled: true,
      promotionImageUrl: '/new-user-gift.jpg'
    }
  });
  await loading;

  assert.equal(page.data.newUserGiftVisible, true);
  assert.equal(page.data.newUserGiftImage, 'https://example.com/new-user-gift.jpg');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
