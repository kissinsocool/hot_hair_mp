const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

for (const name of ['orders', 'messages']) {
  test(`${name} coalesces in-flight invalidations and refreshes on authentication`, async () => {
    let definition;
    let resolveFirst;
    let subscription;
    let calls = 0;
    const api = {
      session: () => ({ token: 'A' }), requireLogin: () => true,
      async request() { return { count: 0 }; },
      requestPage() {
        calls++;
        return calls === 1 ? new Promise(resolve => { resolveFirst = resolve; }) : Promise.resolve({ items: [{ id: 'new' }], hasMore: false });
      },
    };
    const context = {
      Page: value => { definition = value; }, getApp: () => ({ globalData: {} }),
      require: module => module.endsWith('/api') ? api : module.endsWith('/orders') ? { formatOrder: row => row, formatMessage: row => row }
        : module.includes('bookingSocket') ? { subscribe(fn) { subscription = fn; return () => {}; } }
        : module.includes('layout') ? { appBarSize: () => ({}) } : module.includes('reviewTags') ? { buildReviewTags: () => [] } : {},
      wx: { showToast() {} },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, `../pages/${name}/${name}.js`), 'utf8'), context);
    const page = { ...definition, data: { ...definition.data }, setData(value) { Object.assign(this.data, value); } };
    const first = page.load();
    await page.load(); await page.load();
    resolveFirst({ items: [{ id: 'old' }], hasMore: false });
    await first;
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls, 2, 'many events during a query require just one catch-up read');
    assert.equal(page.data[name][0].id, 'new');
    const previous = calls;
    if (name === 'messages') page.onLoad();
    page.onShow();
    await new Promise(resolve => setImmediate(resolve));
    subscription({ event: 'authenticated' });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls, previous + 2, 'initial load and a fresh authentication both synchronize state');
  });
}
