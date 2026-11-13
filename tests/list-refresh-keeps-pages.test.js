const assert = require('node:assert/strict');
const { applyData } = require('./support/setData');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

for (const [name, listKey, pageKey] of [['orders', 'orders', 'orderPage'], ['messages', 'messages', 'messagePage']]) {
  test(`${name} refresh after a push reloads every loaded page in one request`, async () => {
    let definition;
    const calls = [];
    const api = {
      session: () => ({ token: 'A' }), requireLogin: () => true,
      async request() { return {}; },
      async requestPage(_path, options) {
        calls.push(options);
        const items = Array.from({ length: options.limit }, (_, i) => ({ id: `${options.page}-${i}`, createdAt: 't' }));
        return { items, hasMore: true };
      }
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, `../pages/${name}/${name}.js`), 'utf8'), {
      Page: value => { definition = value; }, getApp: () => ({ globalData: {} }),
      require: m => m.endsWith('/api') ? api : m.endsWith('/orders') ? { formatOrder: r => r, formatMessage: r => r, orderCardView: r => r, messageView: r => r }
        : m.endsWith('/dataPatch') ? require('../utils/dataPatch')
        : m.includes('unreadMessages') ? { count: async () => 3, invalidate() {} }
        : m.includes('freshness') ? { stamp: () => ({}), isFresh: () => false }
        : m.includes('layout') ? { appBarSize: () => ({}) } : {},
      wx: { showToast() {} }
    });
    const page = { ...definition, data: { ...definition.data }, setData(v) { applyData(this.data, v); } };
    await page.load();
    await page.loadMore();
    await page.loadMore();
    assert.equal(page.data[listKey].length, 60);
    await page.load({ keepLoaded: true });
    assert.deepEqual({ ...calls[calls.length - 1] }, { page: 1, limit: 60 });
    assert.equal(page.data[listKey].length, 60);
    assert.equal(page.data[pageKey], 3);
    await page.loadMore();
    assert.deepEqual({ ...calls[calls.length - 1] }, { page: 4, limit: 20 }, 'paging continues after the reloaded range');
    await page.load();
    assert.deepEqual({ ...calls[calls.length - 1] }, { page: 1, limit: 20 }, 'pull-to-refresh starts over');
    if (name === 'orders') assert.equal(page.data.unreadMessageCount, 3);
  });
}
