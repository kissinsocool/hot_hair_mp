const assert = require('node:assert/strict');

let now = 100000;
const session = { token: 'A', user: { displayName: '用户' } };
const requests = [];
const navigations = [];
let definition;
Date.now = () => now;
const app = { globalData: { apiBaseUrl: 'https://example.com/api', mediaBaseUrl: '', sessionLoaded: true, session } };
global.getApp = () => app;
global.getCurrentPages = () => [];
global.Page = (value) => { definition = value; };
global.wx = {
  getStorageSync: () => null,
  setStorageSync() {},
  request(options) { requests.push(options); },
  navigateTo(options) { navigations.push(options.url); },
  showToast() {}
};
require.cache[require.resolve('../utils/bookingSocket')] = {
  exports: { lastEventAt: () => 0, reset() {}, subscribe: () => () => {} }
};
const favoriteStore = require('../utils/favorites');

const flush = () => new Promise((resolve) => setImmediate(resolve));
const paths = () => requests.map((request) => `${request.method} ${request.url.replace('https://example.com/api', '')}`);
async function respondAll(handler) {
  await flush();
  for (const request of requests.filter((item) => !item.done)) {
    request.done = true;
    request.success({ statusCode: 200, data: handler(request.url, request.method), header: {} });
  }
  await flush();
}

(async () => {
  // 理发师、动态收藏各自缓存，写操作后直接更新缓存，并返回服务端响应。
  let loading = favoriteStore.staff.loadIds();
  await respondAll(() => ({ staffIds: ['st1'] }));
  assert.deepEqual(await loading, ['st1']);
  const writing = favoriteStore.staff.setFavorite('st 2', true);
  await respondAll(() => ({ favorite: true, favoriteCount: 7 }));
  assert.deepEqual(await writing, { favorite: true, favoriteCount: 7 });
  assert.deepEqual((await favoriteStore.staff.loadIds()).sort(), ['st 2', 'st1']);
  loading = favoriteStore.posts.loadIds();
  await respondAll(() => ({ postIds: ['p1'] }));
  assert.deepEqual(await loading, ['p1']);
  assert.deepEqual(paths(), ['GET /favorites/staff/ids', 'PUT /favorites/staff/st%202', 'GET /favorites/posts/ids']);
  assert.deepEqual(favoriteStore.idSet(['a', 'b']), { a: true, b: true });

  // 收藏页：只加载当前分类；切换分类时按需加载，切回时不重复请求。
  require('../pages/favorites/favorites');
  const page = { ...definition, data: structuredClone(definition.data), setData(values) { Object.assign(this.data, values); } };
  requests.length = 0;
  now += 1000;
  page.onShow();
  await respondAll(() => [{ id: 's1', name: '店一' }]);
  assert.deepEqual(paths(), ['GET /favorites']);
  assert.equal(page.data.activeUnit, '家');

  page.switchTab({ currentTarget: { dataset: { key: 'staff' } } });
  await respondAll(() => [{ id: 'st1', name: 'MoMo', roleId: 'senior_barber', salonId: 'salon/1', salonName: '难波店', bio: '', imageUrl: '' }]);
  assert.deepEqual(paths(), ['GET /favorites', 'GET /favorites/staff']);
  assert.equal(page.data.activeUnit, '人');
  assert.equal(page.data.staff[0].subText, '难波店 · 高级理发师');
  assert.equal(page.data.staff[0].bioText, '暂无简介');

  page.bookStaff({ currentTarget: { dataset: { id: 'st1' } } });
  assert.deepEqual(navigations, ['/pages/booking/booking?id=salon%2F1&staffId=st1']);

  page.switchTab({ currentTarget: { dataset: { key: 'posts' } } });
  await respondAll(() => [{
    id: 'p1', salonId: 'salon/1', salonName: '难波店', salonDescription: '徒步5分钟', salonImageUrl: '/cover.jpg', salonTags: ['近地铁'], content: '新作品', authorName: 'MoMo', authorStaffId: 'st1',
    serviceId: 'svc-1', serviceName: '剪发', imageUrls: [], createdAt: '2026-11-01T02:00:00Z',
    relatedService: { id: 'svc-1', name: '剪发', tagIds: [], priceFen: 8800 }
  }, {
    id: 'p2', salonId: 'salon/1', salonName: '难波店', content: '旧套餐', serviceId: 'gone', serviceName: '旧套餐', imageUrls: [], relatedService: null
  }]);
  assert.equal(page.data.posts[0].relatedService.priceFen, 8800);
  assert.equal(page.data.posts[0].salonNameText, '难波店');
  assert.equal(page.data.posts[0].salonDescriptionText, '徒步5分钟');
  assert.equal(page.data.posts[1].salonDescriptionText, '暂无描述');
  assert.deepEqual(page.data.posts[0].salonTags, ['近地铁']);
  assert.deepEqual(page.data.posts[1].salonTags, [], '旧接口没有店铺标签时不显示');
  page.openPostSalon({ currentTarget: { dataset: { id: 'p1' } } });
  assert.equal(navigations[navigations.length - 1], '/pages/detail/detail?id=salon%2F1');
  assert.equal(page.data.posts[1].relatedService, null);
  assert.equal(page.data.posts[1].serviceUnavailable, true);

  page.switchTab({ currentTarget: { dataset: { key: 'salons' } } });
  await flush();
  assert.equal(paths().filter((item) => item === 'GET /favorites').length, 1, '切回已加载的分类不重复请求');

  // 取消收藏后从对应列表移除。
  page.switchTab({ currentTarget: { dataset: { key: 'posts' } } });
  const removing = page.togglePost({ currentTarget: { dataset: { id: 'p1' } } });
  await respondAll(() => ({ favorite: false }));
  await removing;
  assert.ok(paths().includes('DELETE /favorites/posts/p1'));
  assert.deepEqual(page.data.posts.map((post) => post.id), ['p2']);
  const removingStaff = page.toggleStaff({ currentTarget: { dataset: { id: 'st1' } } });
  await respondAll(() => ({ favorite: false, favoriteCount: 0 }));
  await removingStaff;
  assert.deepEqual(page.data.staff, []);
})().catch((error) => { console.error(error); process.exitCode = 1; });
