const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

let definition;
global.getApp = () => ({ globalData: { apiBaseUrl: 'https://example.com/api', mediaBaseUrl: '', session: null } });
global.wx = { getStorageSync: () => null };
global.Page = options => { definition = options; };
require('../pages/home/home');

const page = {
  ...definition,
  data: { ...definition.data, locatedOnce: true, locationIsFuzzy: false, keyword: '', favorites: ['salon-1'] },
  setData(values, callback) { Object.assign(this.data, values); if (callback) callback(); },
  observeSalonCards() {},
};
const salon = page.normalizeSalon({ id: 'salon-1', name: '测试店铺', distanceKm: 1.2, businessDistrict: ' 龙湖天街 ' });
page.renderSalons([salon]);
assert.equal(page.data.salonCards[0].distanceText, '1.2 km');
assert.equal(page.data.salonCards[0].businessDistrict, '龙湖天街');
assert.equal(page.data.salonCards[0].isFavorite, true);
for (const businessDistrict of [undefined, null, '', 123]) {
  assert.equal(page.normalizeSalon({ businessDistrict }).businessDistrict, '');
}
page.data.locatedOnce = false;
const withoutLocation = page.normalizeSalon({ businessDistrict: '国贸', distanceKm: 1.2 });
assert.equal(withoutLocation.distanceText, '');
assert.equal(withoutLocation.businessDistrict, '国贸');
const template = fs.readFileSync(path.join(__dirname, '../pages/home/home.wxml'), 'utf8');
assert.match(template, /class="distance">\{\{item.distanceText\}\}<text wx:if="\{\{item.businessDistrict\}\}">/);
assert.match(template, /item.distanceText \? ' · ' : ''/);
