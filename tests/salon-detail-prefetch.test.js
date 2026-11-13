const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

let now = 1000;
const requests = [];
let definition;
Date.now = () => now;
global.getApp = () => ({ globalData: { apiBaseUrl: 'https://example.com/api', mediaBaseUrl: '', session: null, sessionLoaded: true } });
global.wx = { getStorageSync: () => null };
global.Page = (value) => { definition = value; };
const api = require('../utils/api');
const ad = require('../utils/ad');
const salonDetail = require('../utils/salonDetail');
ad.load = async () => ad.DEFAULT;
api.requestPage = async () => ({ items: [] });
let respond = async (requestPath) => ({ id: requestPath, name: '完整店铺', services: [], staff: [], reviews: [], reviewCount: 8, rating: 4.5 });
api.request = async (requestPath) => { requests.push(requestPath); return respond(requestPath); };
require('../pages/detail/detail');

function createPage() {
  return {
    ...definition,
    data: { ...definition.data },
    writes: [],
    setData(values) { this.writes.push(values); Object.assign(this.data, values); },
    loadFavoriteState() {}
  };
}

(async () => {
  // 预取的请求就是详情页这次进入的请求，不会再发第二次。
  salonDetail.prefetch('salon-1', { id: 'salon-1', name: '列表店铺', description: '简介', businessDistrict: ' 三里屯 ', rating: 4.5, reviewCount: 8 });
  assert.deepEqual(requests, ['/salons/salon-1'], '跳转前已发起详情请求');
  const page = createPage();
  page.onLoad({ id: 'salon-1' });
  assert.equal(page.data.salon.name, '列表店铺', '详情返回前先展示列表里的店铺信息');
  assert.equal(page.data.salon.businessDistrict, '三里屯');
  assert.equal(page.data.salon.ratingText, '4.5');
  assert.equal(page.data.salon.starIcons.length, 5);
  assert.equal(page.data.loading, true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(requests.length, 1);
  assert.equal(page.data.salon.name, '完整店铺');
  assert.equal(page.data.loading, false);

  // 预取只使用一次：再次进入详情页仍读取最新数据。
  const again = createPage();
  again.onLoad({ id: 'salon-1' });
  assert.equal(again.data.salon, null, '没有预取时不展示预览');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(requests.length, 2);

  // 列表数据没有评分信息时不展示评分行。
  salonDetail.prefetch('salon-2', { id: 'salon-2', name: '收藏店铺' });
  const noRating = createPage();
  noRating.onLoad({ id: 'salon-2' });
  assert.equal('starIcons' in noRating.data.salon, false);
  await new Promise((resolve) => setImmediate(resolve));

  // 超时未被使用的预取不再复用，也不提供预览。
  salonDetail.prefetch('salon-3', { id: 'salon-3', name: '过期' });
  now += salonDetail.PREFETCH_MS;
  assert.equal(salonDetail.summary('salon-3'), null);
  const before = requests.length;
  await salonDetail.load('salon-3', { maxAgeMs: 0 });
  assert.equal(requests.length, before + 1);

  // 预取失败时详情页照常请求一次；仍失败则显示错误页。
  respond = async () => { throw new Error('网络错误'); };
  salonDetail.prefetch('salon-4', { id: 'salon-4', name: '失败店铺' });
  const failed = createPage();
  const failedBefore = requests.length;
  failed.onLoad({ id: 'salon-4' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(requests.length, failedBefore + 1, '预取失败后重新请求');
  assert.equal(failed.data.errorMessage, '网络错误');
  assert.equal(failed.data.loading, false);

  const template = fs.readFileSync(path.join(__dirname, '../pages/detail/detail.wxml'), 'utf8');
  // 没有列表摘要时整页骨架屏；有摘要时头部先展示，下方内容用骨架屏占位。
  assert.match(template, /<view wx:if="\{\{loading && !salon\}\}" class="detail"[^>]*>[\s\S]*?<template is="detail-body-skeleton" \/>/);
  assert.match(template, /<view wx:if="\{\{loading\}\}"[^>]*>\s*<template is="detail-body-skeleton" \/>\s*<\/view>\s*<block wx:else>/);
  // 骨架屏沿用真实区块的类名，尺寸跟随页面样式。
  assert.match(template, /<import src="\/styles\/service-card-skeleton\.wxml" \/>/);
  const skeleton = template.match(/<template name="detail-body-skeleton">([\s\S]*?)<\/template>/)[1]
    + fs.readFileSync(path.join(__dirname, '../styles/service-card-skeleton.wxml'), 'utf8');
  for (const className of ['promo', 'promo-swiper', 'salon-intro', 'info-card', 'section-title', 'service-card', 'service-image-wrap', 'service-meta']) {
    assert.match(skeleton, new RegExp(`class="[^"]*\\b${className}\\b`), className);
  }
  assert.match(template, /<view wx:if="\{\{!loading\}\}" class="bar">/);
})().catch((error) => { console.error(error); process.exitCode = 1; });
