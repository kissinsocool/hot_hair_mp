const assert = require('node:assert/strict');

let componentDefinition;
let pageDefinition;
let pages = [
  { route: 'pages/profile/profile' },
  { route: 'pages/login/login' }
];
const app = {
  globalData: {
    apiBaseUrl: 'https://example.com/api',
    mediaBaseUrl: '',
    session: null,
    pendingLoginReturnRoute: ''
  }
};

global.getApp = () => app;
global.getCurrentPages = () => pages;
global.Component = (options) => { componentDefinition = options; };
global.Page = (options) => { pageDefinition = options; };
global.wx = {
  getStorageSync: () => null,
  setStorageSync() {},
  removeStorageSync() {},
  request(options) {
    const path = options.url.replace('https://example.com/api', '');
    options.success({
      statusCode: 200,
      data: path === '/auth/me' ? { user: { displayName: '用户' } } : []
    });
  },
  navigateTo() {},
  switchTab() {},
  showToast() {}
};

require('../custom-tab-bar/index');

const tabBar = {
  data: {
    ...componentDefinition.data,
    list: componentDefinition.data.list.map((item) => ({ ...item }))
  },
  setData(values) { Object.assign(this.data, values); },
  ...componentDefinition.methods
};
componentDefinition.lifetimes.attached.call(tabBar);
assert.equal(tabBar.data.initialized, false);

require('../pages/profile/profile');

const profile = {
  ...pageDefinition,
  data: { ...pageDefinition.data },
  setData(values) { Object.assign(this.data, values); },
  getTabBar() { return tabBar; }
};

app.globalData.session = { token: 'token', user: { displayName: '用户' } };
pages = [{ route: 'pages/profile/profile' }];
profile.onShow();

assert.equal(tabBar.data.initialized, true);
assert.equal(tabBar.data.selected, 3);
assert.equal(tabBar.data.hidden, false);

profile.data.sheetVisible = true;
tabBar.hide();
profile.onShow();
assert.equal(tabBar.data.hidden, true);
