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
    navigateTo: options => navigations.push(options),
    showToast() {}
  };
  const api = require('../utils/api');
  const original = { requestPage: api.requestPage, displayImageUrl: api.displayImageUrl };
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
        createdAt: '2026-09-24T10:00:00Z'
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
    page.previewImage({ currentTarget: { dataset: { postIndex: 0, url: 'https://example.com/two.jpg' } } });
    assert.deepEqual(previews[0], {
      urls: ['https://example.com/one.jpg', 'https://example.com/two.jpg'],
      current: 'https://example.com/two.jpg'
    });
    page.openStaff({ currentTarget: { dataset: { id: page.data.posts[0].authorStaffId } } });
    assert.deepEqual(navigations[0], {
      url: '/pages/staff/staff?id=staff%2F1&salonId=salon%2F1'
    });
  } finally {
    api.requestPage = original.requestPage;
    api.displayImageUrl = original.displayImageUrl;
    delete global.getApp;
    delete global.Page;
    delete global.wx;
  }
});

test('salon detail renders posts below reviews with an all-posts entry', () => {
  const template = fs.readFileSync(path.join(__dirname, '../pages/detail/detail.wxml'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '../pages/detail/detail.wxss'), 'utf8');
  assert.ok(template.indexOf('客户评价') < template.indexOf('店铺动态'));
  assert.doesNotMatch(template, /class="card section salon-posts-section"/);
  assert.match(template, /wx:for="\{\{salon\.latestPosts\}\}"/);
  assert.match(styles, /\.salon-post\s*\{[^}]*border:\s*1rpx solid #eadbd2;[^}]*background:\s*#fff;[^}]*box-shadow:/s);
  assert.ok(template.indexOf('salon-post-images') < template.indexOf('salon-post-head'));
  assert.match(template, /bindtap="openStaff" data-id="\{\{item\.authorStaffId\}\}"[^>]*>\{\{item\.authorName\}\}<\/text>/);
  assert.match(template, / · 投稿时间：\{\{item\.dateText\}\}/);
  assert.match(template, /wx:if="\{\{salon\.hasMorePosts\}\}"[^>]*>展示更多<\/button>/);
});

test('all-posts page renders author details below post images', () => {
  const template = fs.readFileSync(path.join(__dirname, '../pages/salon-posts/salon-posts.wxml'), 'utf8');
  assert.ok(template.indexOf('post-images') < template.indexOf('post-head'));
  assert.match(template, /bindtap="openStaff" data-id="\{\{item\.authorStaffId\}\}"[^>]*>\{\{item\.authorName\}\}<\/text>/);
  assert.match(template, / · 投稿时间：\{\{item\.dateText\}\}/);
});
