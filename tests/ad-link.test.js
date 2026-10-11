const assert = require('node:assert/strict');

global.getApp = () => ({
  globalData: { apiBaseUrl: 'https://example.com/api', mediaBaseUrl: '', session: null }
});

const { navigationLink } = require('../utils/ad');
const { normalizeHttpsUrl } = require('../utils/webUrl');

assert.equal(
  navigationLink('https://media.hothaircc.cn/ad/trends.html?from=banner'),
  '/pages/web/web?url=https%3A%2F%2Fmedia.hothaircc.cn%2Fad%2Ftrends.html%3Ffrom%3Dbanner'
);
assert.equal(navigationLink('/pages/detail/detail?id=1'), '/pages/detail/detail?id=1');
assert.equal(navigationLink('/pages/ad/ad'), '');
assert.equal(normalizeHttpsUrl('http://media.hothaircc.cn/ad.html'), '');
assert.equal(normalizeHttpsUrl('https://user@example.com/ad.html'), '');
