const assert = require('node:assert/strict');

let pageDefinition;
let locationCallbacks;

global.getApp = () => ({
  globalData: { apiBaseUrl: 'https://example.com/api', mediaBaseUrl: '', session: null }
});
global.wx = {
  getStorageSync: () => null,
  getLocation(options) { locationCallbacks = options; }
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
assert.equal(page.data.locationText, '北京服务区');
assert.equal(page.loadCount, 1);

page.locate();
locationCallbacks.success({ latitude: 40.1, longitude: 116.5 });
locationCallbacks.complete();
assert.equal(page.data.latitude, 40.1);
assert.equal(page.data.longitude, 116.5);
assert.equal(page.data.locationText, '当前位置');
assert.equal(page.data.locatedOnce, true);
assert.equal(page.loadCount, 2);
