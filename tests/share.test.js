const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { test } = require('node:test');
const { onShareAppMessage } = require('../utils/share');

const root = path.join(__dirname, '..');
const app = require('../app.json');
const routes = app.pages.concat(app.subPackages.flatMap((pack) => pack.pages.map((page) => `${pack.root}/${page}`)));
const share = (route, data = {}) => onShareAppMessage.call({ route, data });

test('every registered page enables forwarding with the shared title and safe default destination', (t) => {
  const originalGetApp = global.getApp;
  const originalWx = global.wx;
  global.getApp = () => ({ globalData: { apiBaseUrl: 'https://example.com/api', mediaBaseUrl: 'https://example.com' } });
  global.wx = { getStorageSync: () => undefined };
  t.after(() => {
    if (originalGetApp === undefined) delete global.getApp;
    else global.getApp = originalGetApp;
    if (originalWx === undefined) delete global.wx;
    else global.wx = originalWx;
  });
  for (const route of routes) {
    const filename = path.join(root, `${route}.js`);
    let definition;
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
      require: createRequire(filename),
      Page: (page) => { definition = page; },
      getApp: global.getApp,
      wx: global.wx
    }, { filename });
    assert.equal(typeof definition.onShareAppMessage, 'function', route);
    const result = definition.onShareAppMessage.call({ route, data: definition.data || {} });
    assert.equal(result.path, '/pages/home/home', route);
    assert.equal(result.title, route === 'pages/home/home' ? '放心预约、安心享受｜美发预约' : '放心预约安心享受｜美发专属预约平台', route);
    assert.ok(fs.existsSync(path.join(root, result.imageUrl)), route);
  }
});

test('public shares preserve only the identifiers required to open the content', () => {
  const cases = [
    ['pages/detail/detail', { id: 'salon/1&x=2', salon: { name: '沙龙' } }, 'id=salon%2F1%26x%3D2'],
    ['pages/staff/staff', { id: 'staff/1', salonId: 'salon/1', staff: { name: '发型师' } }, 'id=staff%2F1&salonId=salon%2F1'],
    ['pages/salon-posts/salon-posts', { salonId: 'salon/1' }, 'salonId=salon%2F1'],
    ['pages/salon-reviews/salon-reviews', { salonId: 'salon/1', filter: 'photos' }, 'salonId=salon%2F1'],
    ['pages/style-gallery/style-gallery', { category: 'color', sort: 'distance' }, 'category=color']
  ];
  for (const [route, data, query] of cases) {
    const result = share(route, { ...data, latitude: 31.2, longitude: 121.5, token: 'secret' });
    assert.equal(result.path, `/${route}?${query}`);
    assert.equal(result.title, route === 'pages/detail/detail' ? '沙龙' : route === 'pages/staff/staff' ? '发型师' : '放心预约安心享受｜美发专属预约平台');
  }
  assert.equal(share('pages/staff/staff', { id: 'staff/1' }).path, '/pages/home/home');
  assert.equal(share('pages/style-gallery/style-gallery', { category: 'invalid' }).path, '/pages/home/home');
});

test('home always uses the saved screenshot regardless of page content or scroll position', () => {
  assert.deepEqual(share('pages/home/home'), {
    title: '放心预约、安心享受｜美发预约', path: '/pages/home/home',
    imageUrl: '/assets/images/home-share.jpg'
  });
  assert.equal(share('pages/home/home', { keyword: '搜索', salonCards: [], scrollTop: 1200 }).imageUrl,
    '/assets/images/home-share.jpg');
  const image = fs.readFileSync(path.join(root, 'assets/images/home-share.jpg'));
  assert.deepEqual([...image.subarray(0, 3)], [0xff, 0xd8, 0xff]);
});

test('salon and staff shares use their displayed public images', () => {
  const cover = 'https://media.example.com/cover.jpg?x-oss-process=image/resize,w_960';
  const portrait = 'https://media.example.com/staff.jpg?x-oss-process=image/resize,w_720';
  assert.equal(share('pages/detail/detail', { id: 'salon/1', salon: { image: cover } }).imageUrl, cover);
  assert.equal(share('pages/staff/staff', { id: 'staff/1', salonId: 'salon/1', staff: { imageUrl: portrait } }).imageUrl, portrait);
  for (const [route, data] of [
    ['pages/detail/detail', { id: 'salon/1', salon: null }],
    ['pages/detail/detail', { id: 'salon/1', salon: { image: '' } }],
    ['pages/staff/staff', { id: 'staff/1', salonId: 'salon/1', staff: null }],
    ['pages/staff/staff', { id: 'staff/1', salonId: 'salon/1', staff: { imageUrl: '' } }],
    ['pages/detail/detail', { salon: { image: cover } }],
    ['pages/staff/staff', { id: 'staff/1', staff: { imageUrl: portrait } }]
  ]) {
    assert.equal(share(route, data).imageUrl, '/assets/images/auth_hero.jpg');
  }
});

test('private pages never share private parameters or default page screenshots', () => {
  for (const route of routes.filter((route) => !['pages/home/home', 'pages/detail/detail', 'pages/staff/staff', 'pages/salon-posts/salon-posts', 'pages/salon-reviews/salon-reviews', 'pages/style-gallery/style-gallery'].includes(route))) {
    assert.deepEqual(share(route, { id: 'booking/1', token: 'secret', url: 'https://private.example', latitude: 31.2 }), {
      title: '放心预约安心享受｜美发专属预约平台', path: '/pages/home/home', imageUrl: '/assets/images/auth_hero.jpg'
    });
  }
});

test('content share titles use salon and staff names without changing their images or paths', () => {
  const salon = share('pages/detail/detail', { id: 'salon/1', salon: { name: '靓丝造型', image: 'https://example.com/cover.jpg' } });
  assert.equal(salon.title, '靓丝造型');
  assert.equal(share('pages/detail/detail', {
    id: 'salon/1', salon: { name: '靓丝造型', description: '专业剪染设计', fullDescription: '详情页长简介' }
  }).title, '靓丝造型 「专业剪染设计」');
  assert.equal(share('pages/detail/detail', {
    id: 'salon/1', salon: { name: '靓丝造型', description: '', fullDescription: '详情页长简介' }
  }).title, '靓丝造型');
  assert.equal(salon.path, '/pages/detail/detail?id=salon%2F1');
  const staff = share('pages/staff/staff', {
    id: 'staff/1', salonId: 'salon/1', salonName: '靓丝造型',
    staff: { name: 'Tony', imageUrl: 'https://example.com/tony.jpg' }
  });
  assert.equal(staff.title, '靓丝造型  Tony');
  assert.equal(staff.imageUrl, 'https://example.com/tony.jpg');
  assert.equal(staff.path, '/pages/staff/staff?id=staff%2F1&salonId=salon%2F1');
  assert.equal(share('pages/detail/detail', { id: '1', salon: {} }).title, '放心预约安心享受｜美发专属预约平台');
  assert.equal(share('pages/staff/staff', { id: '1', salonId: '2', staff: {} }).title, '放心预约安心享受｜美发专属预约平台');
});
