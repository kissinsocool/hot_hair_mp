const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

test('all salon posts use paginated API data and preview their own image gallery', async () => {
  let definition;
  const calls = [];
  const previews = [];
  const navigations = [];
  global.getApp = () => ({ globalData: { apiBaseUrl: 'https://example.com/api' } });
  global.Page = page => { definition = page; };
  global.wx = {
    previewImage: options => previews.push(options),
    navigateTo: ({ url }) => navigations.push({ url }),
    showToast() {},
    getStorageSync: () => null
  };
  const api = require('../utils/api');
  const original = { request: api.request, requestPage: api.requestPage, displayImageUrl: api.displayImageUrl };
  const detailRequests = [];
  api.request = async (url) => {
    detailRequests.push(url);
    return { services: [{ id: 'svc-1', name: '剪发套餐', note: '洗护\n造型', tagIds: ['wash_cut_blow'], priceFen: 9800 }] };
  };
  api.requestPage = async (url, options) => {
    calls.push({ url, options });
    return {
      items: [{
        id: 'post-1',
        authorStaffId: 'staff/1',
        authorName: '小林',
        authorImageUrl: '/staff.jpg',
        content: '今日作品',
        imageUrls: ['/one.jpg', '/two.jpg'],
        createdAt: '2026-09-24T10:00:00Z',
        serviceId: 'svc-1',
        serviceName: '剪发套餐'
      }, {
        id: 'post-2',
        content: '旧套餐动态',
        imageUrls: [],
        serviceId: 'removed',
        serviceName: '旧套餐'
      }],
      hasMore: false
    };
  };
  api.displayImageUrl = async value => value ? `https://example.com${value}` : '';
  try {
    require('../pages/salon-posts/salon-posts');
    const page = {
      ...definition,
      data: { ...definition.data },
      setData(values) { Object.assign(this.data, values); }
    };
    await page.onLoad({ salonId: 'salon/1' });
    assert.deepEqual(calls[0], {
      url: '/salons/salon%2F1/posts',
      options: { page: 1, limit: 10 }
    });
    assert.equal(page.data.posts[0].imageUrls[1], 'https://example.com/two.jpg');
    assert.equal(detailRequests.length, 1);
    assert.deepEqual(page.data.posts[0].relatedService, {
      id: 'svc-1', name: '剪发套餐', tags: ['洗剪吹'], noteText: '洗护，造型', priceFen: 9800, discountTenths: undefined, originalPriceFen: undefined
    });
    assert.equal(page.data.posts[1].relatedService, null);
    assert.equal(page.data.posts[1].serviceUnavailable, true);
    assert.equal(page.data.posts[0].salonId, 'salon/1');
    assert.equal(page.data.posts[0].dateText, '2026-09-24');

    let componentDefinition;
    global.Component = component => { componentDefinition = component; };
    require('../components/salon-post-card/salon-post-card');
    const card = { data: { post: page.data.posts[0], favorite: false }, events: [], triggerEvent(name, detail) { this.events.push([name, detail]); }, ...componentDefinition.methods };
    card.previewImage({ currentTarget: { dataset: { url: 'https://example.com/two.jpg' } } });
    assert.deepEqual(previews[0], {
      urls: ['https://example.com/one.jpg', 'https://example.com/two.jpg'],
      current: 'https://example.com/two.jpg'
    });
    card.openStaff({ currentTarget: { dataset: { id: page.data.posts[0].authorStaffId } } });
    assert.deepEqual(navigations[0], {
      url: '/pages/staff/staff?id=staff%2F1&salonId=salon%2F1'
    });
    card.toggleFavorite();
    assert.deepEqual(card.events, [['favoritechange', { id: 'post-1', favorite: true }]]);
  } finally {
    api.request = original.request;
    api.requestPage = original.requestPage;
    api.displayImageUrl = original.displayImageUrl;
    require('../utils/salonDetail').clear();
    delete global.getApp;
    delete global.Page;
    delete global.Component;
    delete global.wx;
  }
});

test('salon detail renders posts above reviews with an all-posts entry', () => {
  const template = fs.readFileSync(path.join(__dirname, '../pages/detail/detail.wxml'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '../pages/detail/detail.wxss'), 'utf8');
  assert.ok(template.indexOf('店铺动态') < template.indexOf('客户评价'));
  assert.match(template, /<view wx:if="\{\{salon\.latestPosts\.length > 0\}\}" class="section">\s*<view class="section-title">店铺动态<\/view>/);
  assert.doesNotMatch(template, /暂无动态/);
  assert.doesNotMatch(template, /class="card section salon-posts-section"/);
  assert.match(template, /<salon-post-card wx:for="\{\{salon\.latestPosts\}\}"[^>]* compact bind:favoritechange="togglePostFavorite"/);
  assert.match(styles, /\.salon-post-slide\s*\{[^}]*flex:\s*0 0 82%;/s);
  const favorites = fs.readFileSync(path.join(__dirname, '../pages/favorites/favorites.wxml'), 'utf8');
  // 收藏页的套餐卡片是单独的样式：左侧店铺封面，右侧店铺名称和简介，下方是紧凑的关联套餐。
  assert.doesNotMatch(favorites, /<salon-post-card/);
  const pkg = favorites.slice(favorites.indexOf('class="fav-pkg-card"'));
  assert.ok(pkg.indexOf('fav-pkg-image') < pkg.indexOf('fav-pkg-name'));
  assert.ok(pkg.indexOf('fav-pkg-name') < pkg.indexOf('fav-pkg-desc'));
  assert.ok(pkg.indexOf('fav-pkg-desc') < pkg.indexOf('<post-service-card'));
  assert.match(pkg, /<post-service-card [^>]* compact \/>/);
  assert.match(pkg, /wx:for="\{\{item\.salonTags\}\}"/, '标签用店铺标签');
  assert.doesNotMatch(pkg, /relatedService\.tags/);
  const postsRow = template.slice(template.indexOf('class="salon-posts-row"'), template.indexOf('</scroll-view>', template.indexOf('class="salon-posts-row"')));
  assert.match(postsRow, /<view wx:if="\{\{salon\.hasMorePosts\}\}" class="salon-posts-all" bindtap="showAllPosts" aria-role="button"[^>]*>[\s\S]*<view class="salon-posts-all-text"><text>全<\/text><text>部<\/text><text>动<\/text><text>态<\/text><\/view>\s*<view class="salon-posts-all-arrow" aria-hidden="true"><\/view>\s*<\/view>\s*<\/view>\s*$/);
  assert.doesNotMatch(template, /展示更多/);
});

test('all-posts page renders shared post cards with author details below post images', () => {
  const page = fs.readFileSync(path.join(__dirname, '../pages/salon-posts/salon-posts.wxml'), 'utf8');
  assert.match(page, /<salon-post-card wx:for="\{\{posts\}\}" wx:key="id" post="\{\{item\}\}" favorite="\{\{favoritePostIds\[item\.id\]\}\}" bind:favoritechange="onFavoriteChange" \/>/);
  const template = fs.readFileSync(path.join(__dirname, '../components/salon-post-card/salon-post-card.wxml'), 'utf8');
  assert.ok(template.indexOf('post-favorite') < template.indexOf('post-content'), '收藏按钮在卡片右上角');
  assert.ok(template.indexOf('post-images') < template.indexOf('post-head'));
  assert.match(template, /bindtap="openStaff" data-id="\{\{post\.authorStaffId\}\}"[^>]*>\{\{post\.authorName\}\}<\/text>/);
  assert.match(template, / · 投稿时间：\{\{post\.dateText\}\}/);
  assert.ok(template.indexOf('post-images') < template.indexOf('<post-service-card'));
  assert.ok(template.indexOf('<post-service-card') < template.indexOf('post-head'));
  assert.match(template, /<post-service-card salon-id="\{\{post\.salonId\}\}" service="\{\{post\.relatedService\}\}" service-name="\{\{post\.serviceName\}\}" unavailable="\{\{post\.serviceUnavailable\}\}" compact="\{\{compact\}\}" \/>/);
});
