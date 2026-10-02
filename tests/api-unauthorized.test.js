const assert = require('node:assert/strict');

let storedSession = { token: 'expired-token' };
let currentRoute = 'pages/orders/orders';
let requestOptions = [];
let navigateCount = 0;
let finishNavigation;
let pageStack;

const app = { globalData: { apiBaseUrl: 'https://example.com/api', session: storedSession } };
global.getApp = () => app;
global.getCurrentPages = () => pageStack || [{ route: currentRoute }];
global.wx = {
  getStorageSync: () => storedSession,
  removeStorageSync: () => { storedSession = null; },
  setStorageSync: (_key, value) => { storedSession = value; },
  request: (options) => { requestOptions.push(options); },
  navigateTo: ({ success }) => {
    navigateCount += 1;
    finishNavigation = () => {
      currentRoute = 'pages/login/login';
      success();
    };
  },
  reLaunch: () => { throw new Error('navigateTo should succeed in this test'); }
};

const api = require('../utils/api');

async function main() {
  const first = api.request('/bookings');
  const second = api.request('/auth/coupons');
  requestOptions[0].success({ statusCode: 401, data: {} });
  requestOptions[1].success({ statusCode: 401, data: {} });

  assert.equal(navigateCount, 1);
  finishNavigation();
  await assert.rejects(first, /\u767b\u5f55\u72b6\u6001\u5df2\u5931\u6548/);
  await assert.rejects(second, /\u767b\u5f55\u72b6\u6001\u5df2\u5931\u6548/);
  assert.equal(storedSession, null);
  assert.equal(app.globalData.session, null);

  currentRoute = 'pages/orders/orders';
  requestOptions = [];
  api.saveSession({ token: 'old-token' });
  const staleRequest = api.request('/bookings');
  api.saveSession({ token: 'new-token' });
  requestOptions[0].success({ statusCode: 401, data: {} });

  await assert.rejects(staleRequest, /\u767b\u5f55\u72b6\u6001\u5df2\u5931\u6548/);
  assert.equal(api.session().token, 'new-token');
  assert.equal(navigateCount, 1);

  let loginPage;
  global.Page = (options) => { loginPage = options; };
  pageStack = [
    { route: 'pages/orders/orders' },
    { route: 'pages/login/login' }
  ];
  require('../pages/login/login');
  loginPage.onLoad();
  assert.equal(app.globalData.pendingLoginReturnRoute, 'pages/orders/orders');

  api.clearSession();
  let switchedTab = '';
  const protectedPages = {};
  global.wx.switchTab = ({ url }) => { switchedTab = url; };
  for (const pageName of ['favorites', 'orders', 'profile']) {
    let definition;
    global.Page = (options) => { definition = options; };
    require('../pages/' + pageName + '/' + pageName);
    const page = {
      ...definition,
      data: { ...definition.data },
      setData(values) { Object.assign(this.data, values); }
    };
    protectedPages[pageName] = page;

    app.globalData.pendingLoginReturnRoute = 'pages/' + pageName + '/' + pageName;
    switchedTab = '';
    page.onShow();
    assert.equal(switchedTab, '/pages/home/home');
    assert.equal(app.globalData.pendingLoginReturnRoute, '');
  }

  const previousNavigateCount = navigateCount;
  switchedTab = '';
  protectedPages.favorites.onShow();
  assert.equal(switchedTab, '');
  assert.equal(navigateCount, previousNavigateCount + 1);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
