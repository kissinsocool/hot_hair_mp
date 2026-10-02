const assert = require('node:assert/strict');
const { test } = require('node:test');

test('service cards load only the cover, then preview the ordered gallery without navigating', async () => {
  let definition;
  const resolved = [];
  const previews = [];
  const events = [];
  global.getApp = () => ({ globalData: { apiBaseUrl: 'https://example.com/api' } });
  global.Page = (page) => { definition = page; };
  global.wx = {
    previewImage: (options) => previews.push(options),
    navigateTo: () => assert.fail('service preview must not navigate'),
    showToast: ({ title }) => assert.fail(title)
  };
  const api = require('../utils/api');
  const analytics = require('../utils/analytics');
  const original = { request: api.request, displayImageUrl: api.displayImageUrl, track: analytics.track };
  api.request = async () => ({
    services: [
      { id: 'multi', imageUrl: '/old.jpg', imageUrls: ['/first.jpg', '/second.jpg', '/third.jpg'] },
      { id: 'legacy', imageUrl: '/legacy.jpg' },
      { id: 'empty', imageUrl: '/old.jpg', imageUrls: [] },
      { id: 'missing' }
    ]
  });
  api.displayImageUrl = async (url) => {
    resolved.push(url);
    return url ? `https://example.com${url}` : '';
  };
  analytics.track = (...args) => events.push(args);
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
    assert.equal(previews.length, 0);

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
  } finally {
    api.request = original.request;
    api.displayImageUrl = original.displayImageUrl;
    analytics.track = original.track;
    delete global.getApp;
    delete global.Page;
    delete global.wx;
  }
});
