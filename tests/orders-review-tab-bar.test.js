const assert = require('node:assert/strict');

let definition;
let mediaPickerOpened = false;
const session = { token: 'token', user: {} };

global.getApp = () => ({
  globalData: {
    apiBaseUrl: 'https://example.com/api',
    mediaBaseUrl: '',
    session,
    pendingLoginReturnRoute: ''
  }
});
global.Page = (options) => { definition = options; };
global.wx = {
  getStorageSync: () => session,
  chooseMedia() { mediaPickerOpened = true; },
  connectSocket: () => ({
    onMessage() {},
    onClose() {},
    onError() {},
    close() {}
  })
};

require('../pages/orders/orders');

const tabBar = {
  hidden: false,
  hide() { this.hidden = true; },
  show() { this.hidden = false; }
};
const page = {
  ...definition,
  data: {
    ...definition.data,
    orders: [{ id: 'booking-1', reviewed: false, complained: false }]
  },
  setData(values) { Object.assign(this.data, values); },
  getTabBar() { return tabBar; },
  load() {}
};

page.review({ currentTarget: { dataset: { id: 'booking-1', type: 'review' } } });
assert.equal(tabBar.hidden, true);
assert.equal(page.data.sheetVisible, true);
page.chooseReviewTag({ currentTarget: { dataset: { name: '服务周到' } } });
assert.deepEqual(page.data.sheetTags.filter((tag) => tag.selected).map((tag) => tag.name), ['服务周到']);

page.pickImages();
assert.equal(mediaPickerOpened, true);
page.onHide();
page.onShow();
assert.equal(tabBar.hidden, true, 'returning from the media picker must keep the review tab bar hidden');

page.closeSheet();
assert.equal(tabBar.hidden, false, 'closing the review sheet must reveal the tab bar');

page.review({ currentTarget: { dataset: { id: 'booking-1', type: 'complaint' } } });
page.pickImages();
page.onHide();
page.onShow();
assert.equal(tabBar.hidden, true, 'returning from the media picker must keep the complaint tab bar hidden');

page.closeSheet();
tabBar.hide();
page.onShow();
assert.equal(tabBar.hidden, false, 'showing the orders page without a sheet must reveal the tab bar');

page.onHide();

delete global.Page;
delete global.wx;
delete global.getApp;
