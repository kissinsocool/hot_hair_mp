const assert = require('node:assert/strict');
const { test } = require('node:test');

test('detail setData carries only template fields and the first three reviews', async () => {
  let definition;
  const calls = [];
  const writes = [];
  global.getApp = () => ({ globalData: { apiBaseUrl: 'https://example.com/api' } });
  global.Page = (page) => { definition = page; };
  global.wx = { getStorageSync: () => null, showToast: ({ title }) => assert.fail(title), makePhoneCall: (options) => calls.push(options) };
  const api = require('../utils/api');
  const original = { request: api.request, displayImageUrl: api.displayImageUrl, requestPage: api.requestPage };
  const resolved = [];
  api.displayImageUrl = async (value) => { resolved.push(value); return value || ''; };
  api.requestPage = async () => ({ items: [] });
  api.request = async () => ({
    id: 'salon-1',
    name: '店铺',
    phone: '13800000000',
    address: '上海市浦东新区张江路88号',
    location: { latitude: 31.2, longitude: 121.6 },
    internalNotes: '不应传给视图层',
    reviewCount: 20,
    services: [{ id: 'svc', name: '剪发', imageUrls: ['/a.jpg', '/b.jpg'], priceFen: 100, internal: 'x' }],
    staff: [{ id: 'st', name: '小林', imageUrl: '/s.jpg', schedule: ['不渲染'] }],
    latestPosts: [{ id: 'p', content: '作品', authorImageUrl: '/author.jpg', imageUrls: [] }],
    reviews: Array.from({ length: 20 }, (_, index) => ({ id: `r${index}`, comment: '好', imageUrls: [`/review-${index}.jpg`], raw: 'x' }))
  });
  try {
    delete require.cache[require.resolve('../pages/detail/detail')];
    require('../pages/detail/detail');
    const page = {
      ...definition,
      data: { ...definition.data, id: 'salon-1' },
      setData(values) { writes.push(values); Object.assign(this.data, values); },
      loadFavoriteState() {}
    };
    await page.load();
    const { salon, visibleReviews } = page.data;
    for (const key of ['reviews', 'phone', 'location', 'internalNotes', 'address']) {
      assert.ok(!(key in salon), `${key} 不进入视图数据`);
    }
    assert.equal(salon.phoneText, '13800000000');
    assert.ok(!('internal' in salon.services[0]) && !('imageUrls' in salon.services[0]));
    assert.ok(!('schedule' in salon.staff[0]));
    assert.ok(!('authorImageUrl' in salon.latestPosts[0]));
    assert.ok(!resolved.includes('/author.jpg'), '模板未使用的作者头像不解析');
    assert.equal(visibleReviews.length, 3);
    assert.ok(!('raw' in visibleReviews[0]));
    assert.ok(!resolved.includes('/review-3.jpg'), '只处理需要展示的评价图片');
    page.callPhone();
    assert.deepEqual(calls, [{ phoneNumber: '13800000000' }]);
  } finally {
    Object.assign(api, original);
    delete global.getApp;
    delete global.Page;
    delete global.wx;
  }
});
