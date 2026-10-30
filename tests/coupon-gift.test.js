const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

let definition;
let requestOptions;
let requestCount = 0;
let navigatedTo = '';
let switchedTo = '';
const app = { globalData: { apiBaseUrl: 'https://example.com/api', session: null } };
const profile = {
  route: 'pages/profile/profile',
  data: { activeTab: 'reviews' },
  setData(values) { Object.assign(this.data, values); }
};
global.getApp = () => app;
global.getCurrentPages = () => [profile];
global.Page = (options) => { definition = options; };
global.wx = {
  getStorageSync: () => app.globalData.session,
  request(options) { requestOptions = options; requestCount += 1; },
  navigateTo({ url }) { navigatedTo = url; },
  showToast() {},
  switchTab({ url, success }) { switchedTo = url; if (success) success(); }
};

const campaign = require('../utils/couponCampaign');
const { navigationLink } = require('../utils/ad');
require('../pages/coupon-gift/coupon-gift');
const page = { ...definition, data: { ...definition.data }, setData(values) { Object.assign(this.data, values); } };

async function main() {
  const link = '/pages/coupon-gift/coupon-gift';
  assert.equal(navigationLink(link), link);
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../app.json'), 'utf8'));
  const registeredPages = config.pages.concat(
    config.subPackages.flatMap((pkg) => pkg.pages.map((page) => `${pkg.root}/${page}`))
  );
  assert.ok(registeredPages.includes(link.slice(1)));

  await page.onShow();
  assert.equal(requestCount, 0);
  await page.claim();
  assert.equal(navigatedTo, '/pages/login/login');
  // Cancelling login must not immediately reopen it or attempt a claim.
  navigatedTo = '';
  await page.onShow();
  assert.equal(navigatedTo, '');
  assert.equal(requestCount, 0);

  app.globalData.session = { token: 'user-token' };
  const imageLoading = campaign.loadPromotionImage();
  requestOptions.success({ statusCode: 200, data: { enabled: true, promotionImageUrl: '/gift.jpg' } });
  assert.equal(await imageLoading, 'https://example.com/gift.jpg');
  const cachedCount = requestCount;
  await campaign.loadPromotionImage();
  assert.equal(requestCount, cachedCount);

  const claimOnLoginReturn = page.onShow();
  assert.equal(requestOptions.url, 'https://example.com/api/auth/coupons');
  requestOptions.success({ statusCode: 200, data: [] });
  await new Promise(setImmediate);
  assert.equal(requestOptions.url, 'https://example.com/api/auth/coupon-campaign/claim');
  assert.equal(requestOptions.method, 'POST');
  assert.equal(requestOptions.header.Authorization, 'Bearer user-token');
  assert.equal(page.data.claiming, true);
  const pendingCount = requestCount;
  await page.claim();
  assert.equal(requestCount, pendingCount);
  requestOptions.success({ statusCode: 409, data: { message: '新人礼包活动未开启或已结束' } });
  await claimOnLoginReturn;
  assert.equal(page.data.errorMessage, '新人礼包活动未开启或已结束');
  assert.equal(page.data.claiming, false);
  await page.onShow();
  assert.equal(requestCount, pendingCount);

  const retry = page.claim();
  assert.equal(requestOptions.url, 'https://example.com/api/auth/coupons');
  requestOptions.success({ statusCode: 200, data: [
    { couponType: '99-20', claimedAt: '2026-10-30T00:00:00Z' },
    { couponType: '199-30', claimedAt: null }
  ] });
  await new Promise(setImmediate);
  assert.equal(requestOptions.url, 'https://example.com/api/auth/coupon-campaign/claim');
  requestOptions.success({ statusCode: 200, data: {} });
  await retry;
  assert.equal(page.data.claimed, true);
  assert.equal(page.data.claiming, false);
  assert.equal(switchedTo, '/pages/profile/profile');
  assert.equal(profile.data.activeTab, 'coupons');
  const afterSuccessCount = requestCount;
  await page.claim();
  assert.equal(requestCount, afterSuccessCount);

  // Both entry points share cache invalidation after a successful claim.
  const refreshed = campaign.loadPromotionImage();
  assert.equal(requestCount, afterSuccessCount + 1);
  requestOptions.success({ statusCode: 200, data: { enabled: false } });
  assert.equal(await refreshed, '');

  const alreadyClaimedPage = {
    ...definition,
    data: { ...definition.data },
    setData(values) { Object.assign(this.data, values); }
  };
  switchedTo = '';
  const beforeRevisit = requestCount;
  const revisit = alreadyClaimedPage.onShow();
  assert.equal(requestOptions.url, 'https://example.com/api/auth/coupons');
  requestOptions.success({ statusCode: 200, data: [
    { couponType: '99-20', claimedAt: '2026-10-30T00:00:00Z' },
    { couponType: '199-30', claimedAt: '2026-10-30T00:00:00Z' }
  ] });
  await revisit;
  assert.equal(alreadyClaimedPage.data.claimed, true);
  assert.equal(alreadyClaimedPage.data.errorMessage, '');
  assert.equal(alreadyClaimedPage.data.claiming, false);
  assert.equal(requestCount, beforeRevisit + 1);
  assert.equal(switchedTo, '');
  await alreadyClaimedPage.claim();
  assert.equal(requestCount, beforeRevisit + 1);
  alreadyClaimedPage.viewCoupons();
  assert.equal(switchedTo, '/pages/profile/profile');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
