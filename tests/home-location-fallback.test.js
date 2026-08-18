const assert = require('node:assert/strict');

let pageDefinition;
let locationCallbacks;

global.getApp = () => ({
  globalData: { apiBaseUrl: 'https://example.com/api', mediaBaseUrl: '', session: null }
});
global.wx = {
  getStorageSync: () => null,
  getFuzzyLocation(options) { locationCallbacks = options; }
};
global.Page = (options) => { pageDefinition = options; };

require('../pages/home/home');

const page = {
  ...pageDefinition,
  data: { ...pageDefinition.data },
  loadCount: 0,
  setData(values) { Object.assign(this.data, values); },
  loadSalons() { this.loadCount += 1; }
};

page.locate();
locationCallbacks.fail();
locationCallbacks.complete();
assert.equal(page.data.latitude, 39.9042);
assert.equal(page.data.longitude, 116.4074);
assert.equal(page.data.locationText, '选择定位');
assert.equal(page.formatDistance(0.5), '');
assert.equal(page.loadCount, 1);

page.locate();
locationCallbacks.success({ latitude: 40.1, longitude: 116.5 });
locationCallbacks.complete();
assert.equal(page.data.latitude, 40.1);
assert.equal(page.data.longitude, 116.5);
assert.equal(page.data.locationText, '选择定位');
assert.equal(page.data.locatedOnce, true);
assert.equal(page.formatDistance(0.5), '附近约 500 m');
page.data.locationIsFuzzy = false;
assert.equal(page.formatDistance(1.25), '距离你 1.3 km');
assert.equal(page.loadCount, 2);
