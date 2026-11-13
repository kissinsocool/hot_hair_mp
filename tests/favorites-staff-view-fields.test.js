const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// 收藏页、理发师页只把模板用到的字段交给视图层；页面跳转从逻辑层的完整数据读取。
const root = path.join(__dirname, '..');
const requests = [];
const navigations = [];
let definition;
global.getApp = () => ({ globalData: { apiBaseUrl: 'https://example.com/api', mediaBaseUrl: '', session: { token: 'A' }, sessionLoaded: true } });
global.getCurrentPages = () => [];
global.Page = (value) => { definition = value; };
global.wx = {
  getStorageSync: () => null,
  navigateTo({ url }) { navigations.push(url); },
  showToast() {},
  request(options) { requests.push(options); }
};
require.cache[require.resolve('../utils/bookingSocket')] = {
  exports: { lastEventAt: () => 0, reset() {}, subscribe: () => () => {} }
};
const flush = () => new Promise((resolve) => setImmediate(resolve));
async function respondAll(handler) {
  await flush();
  for (const request of requests.filter((item) => !item.done)) {
    request.done = true;
    request.success({ statusCode: 200, data: handler(request.url), header: {} });
  }
  await flush();
  await flush();
}
const createPage = () => ({ ...definition, data: structuredClone(definition.data), setData(values) { Object.assign(this.data, values); } });

function sectionFields(template, listName) {
  const start = template.indexOf(`wx:for="{{${listName}}}"`);
  assert.ok(start >= 0, `模板里有 ${listName} 列表`);
  // 截到下一个分类的列表之前；套餐分类里嵌套的标签循环用的是 tag，不影响 item 字段。
  const end = ['salons', 'staff', 'posts']
    .map((name) => template.indexOf(`wx:for="{{${name}}}"`, start + 1))
    .filter((index) => index > start)
    .sort((a, b) => a - b)[0];
  const text = template.slice(start, end);
  return [...new Set([...text.matchAll(/item\.([A-Za-z]+)/g)].map((match) => match[1]))];
}

(async () => {
  require('../pages/favorites/favorites');
  const source = fs.readFileSync(path.join(root, 'pages/favorites/favorites.js'), 'utf8');
  const template = fs.readFileSync(path.join(root, 'pages/favorites/favorites.wxml'), 'utf8');
  for (const key of ['salons', 'staff', 'posts']) {
    const declared = source.match(new RegExp(`${key}: \\[([\\s\\S]*?)\\]`))[1];
    for (const field of sectionFields(template, key)) {
      assert.ok(declared.includes(`'${field}'`), `favorites ${key}: 模板字段 ${field} 必须在 CARD_FIELDS 里`);
    }
  }

  const page = createPage();
  page.onShow();
  await respondAll(() => [{
    id: 's1', name: '店一', description: '简介', coverImage: '/cover.jpg', isFeatured: true,
    services: [{ id: 'svc', name: '剪发' }], staff: [{ id: 'st1' }], reviewCount: 3, rating: 4.5
  }]);
  assert.deepEqual(Object.keys(page.data.salons[0]).sort(), ['descriptionText', 'id', 'image', 'nameText']);
  // 打开详情时，交给详情页先展示头部的仍是完整的店铺信息。
  const salonDetail = require('../utils/salonDetail');
  page.openDetail({ currentTarget: { dataset: { id: 's1' } } });
  const summary = salonDetail.summary('s1');
  assert.equal(summary.name, '店一');
  assert.equal(summary.isFeatured, true);
  assert.equal(summary.reviewCount, 3);
  assert.equal(navigations.at(-1), '/pages/detail/detail?id=s1');
  await respondAll(() => ({ id: 's1' }));

  page.switchTab({ currentTarget: { dataset: { key: 'staff' } } });
  await respondAll(() => [{ id: 'st1', name: 'MoMo', roleId: 'senior_barber', salonId: 'salon/1', salonName: '难波店', bio: '', imageUrl: '', reviews: [{ id: 'r' }] }]);
  assert.deepEqual(Object.keys(page.data.staff[0]).sort(), ['bioText', 'id', 'image', 'nameText', 'subText']);
  page.openStaff({ currentTarget: { dataset: { id: 'st1' } } });
  assert.equal(navigations.at(-1), '/pages/staff/staff?id=st1&salonId=salon%2F1', '店铺编号从完整数据读取');

  // 取消收藏后，视图和完整数据都移除这一条。
  const removing = page.toggleStaff({ currentTarget: { dataset: { id: 'st1' } } });
  await respondAll(() => ({ favorite: false }));
  await removing;
  assert.deepEqual(page.data.staff, []);
  const before = navigations.length;
  page.openStaff({ currentTarget: { dataset: { id: 'st1' } } });
  assert.equal(navigations.length, before);

  // 理发师页：接口返回的店铺套餐列表等不进入视图层，模板字段齐全。
  require('../pages/staff/staff');
  const staffTemplate = fs.readFileSync(path.join(root, 'pages/staff/staff.wxml'), 'utf8');
  const staffPage = createPage();
  requests.length = 0;
  const loading = staffPage.onLoad({ id: 'st1', salonId: 'salon-1' });
  await respondAll((url) => url.includes('/reviews')
    ? { items: [], hasMore: false }
    : { id: 'st1', name: 'Tony', rating: 4.8, reviewCount: 12, salonName: '靓丝', roleId: 'senior_barber', experience: '5年', imageUrl: '/a.jpg', favoriteCount: 3, salonServices: [{ id: 'svc', name: '剪发' }], internal: 'x' });
  await loading;
  const view = staffPage.data.staff;
  assert.ok(!('salonServices' in view) && !('internal' in view));
  assert.ok(!('services' in staffPage.data));
  for (const field of new Set([...staffTemplate.matchAll(/staff\.([A-Za-z]+)/g)].map((match) => match[1]))) {
    assert.ok(field in view, `staff: 模板字段 ${field} 必须在视图数据里`);
  }
  assert.equal(view.name, 'Tony');
  assert.equal(view.ratingText, '4.8');
  assert.equal(view.starIcons.length, 5);
  assert.equal(view.reviewCount, 12);
  assert.equal(staffPage.data.favoriteCount, 3);
  assert.equal(staffPage.data.salonName, '靓丝');
  staffPage.book();
  assert.equal(navigations.at(-1), '/pages/booking/booking?id=salon-1&staffId=st1');
})().catch((error) => { console.error(error); process.exitCode = 1; });
