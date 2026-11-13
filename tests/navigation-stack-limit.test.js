const assert = require('node:assert/strict');
const calls = [];
global.wx = {
  navigateTo({ url, fail }) { calls.push(['navigateTo', url]); fail({ errMsg: 'navigateTo:fail webview count limit exceed' }); },
  redirectTo({ url }) { calls.push(['redirectTo', url]); }
};
const navigation = require('../utils/navigation');
navigation.navigateTo('/pages/detail/detail?id=1');
assert.deepEqual(calls, [['navigateTo', '/pages/detail/detail?id=1'], ['redirectTo', '/pages/detail/detail?id=1']]);
global.wx.navigateTo = ({ url, fail }) => { calls.push(['navigateTo', url]); fail({ errMsg: 'navigateTo:fail page not found' }); };
navigation.navigateTo('/x');
assert.equal(calls.length, 3, 'other failures are not turned into redirects');
