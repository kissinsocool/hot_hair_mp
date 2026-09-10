const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

let pageDefinition;
const requestedUrls = [];
global.getApp = () => ({
  globalData: { apiBaseUrl: 'https://example.com/api', mediaBaseUrl: '' }
});
global.Page = (options) => { pageDefinition = options; };
global.wx = {
  getStorageSync() { return null; },
  request(options) {
    requestedUrls.push(options.url);
    const salonId = options.url.endsWith('/salon-1') ? 'salon-1' : 'salon-2';
    options.success({
      statusCode: 200,
      data: {
        id: salonId,
        name: `门店${salonId.at(-1)}`,
        address: '测试地址',
        description: '这是首页简介',
        image: '/salon-cover.jpg',
        services: [{
          id: `service-${salonId.at(-1)}`,
          name: salonId === 'salon-1' ? '剪发套餐' : '染发套餐',
          note: salonId === 'salon-1' ? '洗剪吹' : '染发护理',
          priceFen: salonId === 'salon-1' ? 16800 : 26800,
          imageUrls: ['/service.jpg']
        }]
      }
    });
  }
};

require('../pages/home/home');

const page = {
  ...pageDefinition,
  data: { ...pageDefinition.data, favorites: ['salon-1'] },
  setData(values) { Object.assign(this.data, values); }
};

(async () => {
  const originalRandom = Math.random;
  Math.random = () => 0.999;
  try {
    await page.loadRecommendedPackages([
      { id: 'salon-1', distanceText: '附近约 300 m' },
      { id: 'salon-2', distanceText: '附近约 500 m' }
    ]);
  } finally {
    Math.random = originalRandom;
  }

  assert.deepEqual(requestedUrls, [
    'https://example.com/api/salons/salon-1',
    'https://example.com/api/salons/salon-2'
  ]);
  assert.deepEqual(page.data.recommendedPackages.map((item) => item.salonId), ['salon-2', 'salon-1']);
  const firstSalonPackage = page.data.recommendedPackages.find((item) => item.salonId === 'salon-1');
  assert.equal(firstSalonPackage.priceText, '¥168');
  assert.equal(firstSalonPackage.image, 'https://example.com/salon-cover.jpg');
  assert.equal(firstSalonPackage.salonDescription, '这是首页简介');
  assert.equal(firstSalonPackage.distanceText, '附近约 300 m');
  assert.equal(firstSalonPackage.isFavorite, true);
  assert.equal(page.data.showRecommendedPackages, false);

  const template = fs.readFileSync(path.join(__dirname, '../pages/home/home.wxml'), 'utf8');
  const source = fs.readFileSync(path.join(__dirname, '../pages/home/home.js'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '../pages/home/home.wxss'), 'utf8');
  const recommendationTemplate = template.match(/<view wx:if="\{\{showRecommendedPackages && recommendedPackages\.length\}\}"[\s\S]*?<\/scroll-view>\s*<\/view>/)[0];
  assert.match(source, /if \(this\.data\.showRecommendedPackages\) this\.loadRecommendedPackages\(normalizedSalons\);/);
  assert.match(template, /wx:for="\{\{recommendedPackages\}\}"/);
  assert.match(template, />经典套餐推荐<\/view>/);
  assert.match(template, /class="salon-list-title">附近店铺<\/view>/);
  assert.match(template, /bindtap="openRecommendedPackage"/);
  assert.doesNotMatch(recommendationTemplate, /item\.addressText/);
  assert.match(recommendationTemplate, /\{\{item\.salonDescription\}\}/);
  assert.match(recommendationTemplate, /class="package-salon" bindtap="openDetail"/);
  assert.match(recommendationTemplate, /class="package-service"[\s\S]*?bindtap="openRecommendedPackage"/);
  assert.match(styles, /\.package-recommendations-title,[\s\S]*?\.salon-list-title\s*\{[^}]*color:\s*#625656;[^}]*font-size:\s*36rpx;[^}]*font-weight:\s*700;/s);
  assert.match(styles, /\.package-track\s*\{[^}]*gap:\s*22rpx;/s);
  assert.match(styles, /\.package-card\s*\{[^}]*width:\s*592rpx;[^}]*height:\s*330rpx;/s);
  assert.match(styles, /\.package-card\s*\{[^}]*padding:\s*30rpx;[^}]*border:\s*1rpx solid rgba\(90, 78, 74, 0\.05\);[^}]*border-radius:\s*18rpx;/s);
  assert.match(styles, /\.package-image\s*\{[^}]*width:\s*198rpx;[^}]*height:\s*150rpx;/s);
  assert.match(styles, /\.package-service\s*\{[^}]*height:\s*96rpx;/s);
  assert.match(styles, /\.salon-list-section\s*\{[^}]*background:\s*#f7f4f2;/s);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
