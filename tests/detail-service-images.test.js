const assert = require('node:assert/strict');
const { test } = require('node:test');

test('service cards load only the cover, then preview the ordered gallery without navigating', async () => {
  let definition;
  const resolved = [];
  const previews = [];
  const events = [];
  const navigations = [];
  global.getApp = () => ({ globalData: { apiBaseUrl: 'https://example.com/api' } });
  global.Page = (page) => { definition = page; };
  global.wx = {
    previewImage: (options) => previews.push(options),
    navigateTo: (options) => navigations.push(options),
    showToast: ({ title }) => assert.fail(title)
  };
  const api = require('../utils/api');
  const analytics = require('../utils/analytics');
  const original = { request: api.request, displayImageUrl: api.displayImageUrl, requireLogin: api.requireLogin, track: analytics.track };
  api.request = async (path) => {
    assert.equal(path, '/salons/salon-1');
    return {
      acceptsSameDayBooking: true,
      afterSalesPolicyIds: ['haircut_7_day_adjustment', 'color_perm_15_day_redo'],
      weeklyClosedDays: [1, 3],
      services: [
        { id: 'multi', name: '剪发套餐', note: '洗护与造型', durationMinutes: 60, tagIds: ['wash_cut_blow'], priceFen: 798000, imageUrl: '/old.jpg', imageUrls: ['/first.jpg', '/second.jpg', '/third.jpg'] },
        { id: 'legacy', imageUrl: '/legacy.jpg' },
        { id: 'empty', imageUrl: '/old.jpg', imageUrls: [] },
        { id: 'missing' }
      ],
      latestPosts: [
        { id: 'post-1', serviceId: 'multi', imageUrls: [] },
        { id: 'post-2', serviceId: 'removed', serviceName: '旧套餐', imageUrls: [] }
      ]
    };
  };
  api.displayImageUrl = async (url) => {
    resolved.push(url);
    return url ? `https://example.com${url}` : '';
  };
  analytics.track = (...args) => events.push(args);
  api.requireLogin = () => true;
  try {
    require('../pages/detail/detail');
    const page = {
      ...definition,
      data: { ...definition.data, id: 'salon-1' },
      setData(values) { Object.assign(this.data, values); },
      loadFavoriteState() {}
    };
    await page.load();
    assert.equal(page.data.loading, false);
    assert.deepEqual(resolved.filter(Boolean), ['/first.jpg', '/legacy.jpg']);
    assert.equal(page.data.salon.services[0].imageUrl, 'https://example.com/first.jpg');
    assert.equal(page.data.salon.weeklyClosedDaysText, '每周一、三休息');
    assert.deepEqual(page.data.salon.afterSalesPolicies, [
      '剪发七日内不满意可重新调整',
      '染烫十五日内不满意免费重做'
    ]);
    assert.equal(previews.length, 0);
    assert.equal(page.data.salon.latestPosts[0].relatedService.name, '剪发套餐');
    assert.deepEqual(page.data.salon.latestPosts[0].relatedService.tags, ['洗剪吹']);
    assert.equal(page.data.salon.latestPosts[0].relatedService.priceText, '¥7,980');
    assert.equal(page.data.salon.latestPosts[0].relatedService.noteText, '洗护与造型');
    assert.equal(page.data.salon.latestPosts[0].relatedService.durationText, '60分钟');
    assert.equal(page.data.salon.latestPosts[1].relatedService, null);

    await page.openService({ currentTarget: { dataset: { id: 'multi' } } });
    assert.deepEqual(resolved.filter(Boolean), ['/first.jpg', '/legacy.jpg', '/second.jpg', '/third.jpg']);
    assert.deepEqual(previews.pop(), {
      current: 'https://example.com/first.jpg',
      urls: ['https://example.com/first.jpg', 'https://example.com/second.jpg', 'https://example.com/third.jpg']
    });
    assert.deepEqual(events[0], ['service_click', { salonId: 'salon-1', serviceId: 'multi' }]);

    await page.openService({ currentTarget: { dataset: { id: 'legacy' } } });
    assert.deepEqual(previews.pop(), {
      current: 'https://example.com/legacy.jpg', urls: ['https://example.com/legacy.jpg']
    });
    for (const id of ['empty', 'missing', 'unknown']) {
      await page.openService({ currentTarget: { dataset: { id } } });
    }
    assert.equal(previews.length, 0);
    assert.equal(navigations.length, 0);
    page.bookPostService({ currentTarget: { dataset: { id: 'multi' } } });
    assert.deepEqual(navigations, [{ url: '/pages/booking/booking?id=salon-1&serviceId=multi' }]);
  } finally {
    api.request = original.request;
    api.displayImageUrl = original.displayImageUrl;
    api.requireLogin = original.requireLogin;
    analytics.track = original.track;
    delete global.getApp;
    delete global.Page;
    delete global.wx;
  }
});
