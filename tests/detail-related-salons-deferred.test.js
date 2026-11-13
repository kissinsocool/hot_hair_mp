const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

// 「相关店铺」滚动接近时才请求：进入详情页不立即拉附近店铺列表。
global.getApp = () => ({ globalData: { apiBaseUrl: 'https://example.com/api', mediaBaseUrl: '', session: null, sessionLoaded: true } });
global.wx = { getStorageSync: () => null, showToast() {} };
let definition;
global.Page = (value) => { definition = value; };
require('../pages/detail/detail');
const api = require('../utils/api');
const ad = require('../utils/ad');
const salonDetail = require('../utils/salonDetail');
ad.load = async () => ad.DEFAULT;

function createPage() {
  const observers = [];
  const page = {
    ...definition,
    data: { ...definition.data },
    observers,
    setData(values, callback) { Object.assign(this.data, values); if (callback) callback(); },
    createIntersectionObserver() {
      const observer = {
        disconnected: false,
        relativeToViewport(margins) { this.margins = margins; return this; },
        observe(selector, callback) { this.selector = selector; this.callback = callback; },
        disconnect() { this.disconnected = true; }
      };
      observers.push(observer);
      return observer;
    }
  };
  return page;
}

async function loadDetail(source) {
  salonDetail.clear();
  const listRequests = [];
  api.request = async () => source;
  api.requestPage = async (url) => { listRequests.push(url); return { items: [{ id: 'other', name: '其他店铺' }] }; };
  const page = createPage();
  page.onLoad({ id: 'current' });
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  return { page, listRequests };
}

const salon = { id: 'current', name: '当前店铺', services: [], staff: [], reviews: [], location: { latitude: 31.2, longitude: 121.6 } };

test('the nearby list is requested only when the section approaches the viewport, and only once', async () => {
  const { page, listRequests } = await loadDetail(salon);
  assert.equal(page.data.loading, false);
  assert.deepEqual(listRequests, [], '详情加载完成时不请求附近店铺');
  assert.equal(page.observers.length, 1);
  const [observer] = page.observers;
  assert.equal(observer.selector, '.related-salons-anchor');
  assert.ok(observer.margins.bottom > 0, '提前一段距离开始加载');

  observer.callback({ intersectionRatio: 0 });
  assert.deepEqual(listRequests, [], '还没接近时不请求');
  observer.callback({ intersectionRatio: 1 });
  assert.deepEqual(listRequests, ['/salons?latitude=31.2&longitude=121.6']);
  assert.equal(observer.disconnected, true);
  observer.callback({ intersectionRatio: 1 });
  assert.equal(listRequests.length, 1, '停止观察后的迟到回调不重复请求');
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(page.data.relatedSalons.map((item) => item.id), ['other']);
});

test('leaving before the section is reached never requests the list', async () => {
  const { page, listRequests } = await loadDetail(salon);
  const [observer] = page.observers;
  page.onUnload();
  assert.equal(observer.disconnected, true);
  observer.callback({ intersectionRatio: 1 });
  assert.deepEqual(listRequests, []);
});

test('a salon without coordinates or a failed detail load does not observe', async () => {
  const withoutLocation = await loadDetail({ ...salon, location: undefined });
  assert.equal(withoutLocation.page.observers.length, 0);

  salonDetail.clear();
  api.request = async () => { throw new Error('network unavailable'); };
  const failed = createPage();
  failed.onLoad({ id: 'current' });
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(failed.data.errorMessage, 'network unavailable');
  assert.equal(failed.observers.length, 0);
});

test('the anchor sits in the loaded body right before the related section and has a height', () => {
  const template = fs.readFileSync(path.join(__dirname, '../pages/detail/detail.wxml'), 'utf8');
  const anchor = template.indexOf('class="related-salons-anchor"');
  assert.ok(anchor > template.indexOf('<block wx:else>') && anchor < template.indexOf('class="related-salons"'));
  const styles = fs.readFileSync(path.join(__dirname, '../pages/detail/detail.wxss'), 'utf8');
  assert.match(styles, /\.related-salons-anchor\s*\{[^}]*height:\s*1px/);
});
