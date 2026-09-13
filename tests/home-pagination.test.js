const assert = require('node:assert/strict');

global.getApp = () => ({
  globalData: { apiBaseUrl: 'https://example.com/api', mediaBaseUrl: '', session: null }
});
const toasts = [];
global.wx = {
  getStorageSync: () => null,
  showToast(options) { toasts.push(options); }
};
global.Page = (options) => { global.homePageDefinition = options; };

const api = require('../utils/api');
require('../pages/home/home');

const original = {
  request: api.request,
  requestPage: api.requestPage,
  displayImageUrl: api.displayImageUrl
};
const pageRequests = [];
const salonsForPage = (page) => Array.from({ length: 10 }, (_, index) => ({
  id: `salon-${page}-${index}`,
  name: `店铺 ${page}-${index}`,
  tags: []
}));

api.request = async () => salonsForPage(1);
api.requestPage = async (path, options) => {
  pageRequests.push({ path, options });
  return { items: salonsForPage(options.page), hasMore: options.page === 1, total: 20 };
};
api.displayImageUrl = async (value) => value;

const page = {
  ...global.homePageDefinition,
  data: { ...global.homePageDefinition.data },
  setData(values, callback) {
    Object.assign(this.data, values);
    if (callback) callback();
  }
};

(async () => {
  try {
    await page.loadSalons();
    assert.deepEqual(pageRequests[0], {
      path: '/salons?latitude=39.9042&longitude=116.4074',
      options: { page: 1, limit: 10 }
    });

    await page.loadMore();
    assert.deepEqual(pageRequests[1], {
      path: '/salons?latitude=39.9042&longitude=116.4074',
      options: { page: 2, limit: 10 }
    });
    assert.equal(page.data.salons.length, 20);
    assert.equal(page.data.loadingMore, false);

    const renderCallbacks = [];
    const renderPage = {
      ...global.homePageDefinition,
      salonListVersion: 1,
      data: {
        ...global.homePageDefinition.data,
        salons: salonsForPage(1),
        visibleSalons: salonsForPage(1),
        visibleCount: 10,
        salonPage: 1,
        hasMoreSalons: true,
        loading: false
      },
      setData(values, callback) {
        Object.assign(this.data, values);
        if (callback) renderCallbacks.push(callback);
      }
    };
    api.requestPage = async (_path, options) => ({
      items: salonsForPage(options.page),
      hasMore: false,
      page: options.page
    });
    const rendering = renderPage.loadMore();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(renderPage.data.loadingMore, true);
    assert.equal(renderCallbacks.length, 1);
    renderCallbacks.shift()();
    await rendering;
    assert.equal(renderPage.data.loadingMore, false);

    const duplicatePage = {
      ...global.homePageDefinition,
      data: { ...global.homePageDefinition.data },
      setData(values, callback) {
        Object.assign(this.data, values);
        if (callback) callback();
      }
    };
    api.requestPage = async (_path, options) => ({
      items: salonsForPage(1),
      hasMore: true,
      page: options.page
    });
    await duplicatePage.loadSalons();
    await duplicatePage.loadMore();
    assert.equal(duplicatePage.data.salons.length, 10);
    assert.equal(toasts.at(-1).title, '未加载到新店铺，请稍后重试');
  } finally {
    api.request = original.request;
    api.requestPage = original.requestPage;
    api.displayImageUrl = original.displayImageUrl;
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
