const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

global.getApp = () => ({
  globalData: { apiBaseUrl: 'https://example.com/api', mediaBaseUrl: '', session: null }
});
global.wx = { getStorageSync: () => null };
global.Page = (options) => { global.homePageDefinition = options; };

require('../pages/home/home');

const actions = [];
const dataUpdates = [];
const scrollCalls = [];
const page = {
  ...global.homePageDefinition,
  data: { ...global.homePageDefinition.data },
  tabBarScrollAnchor: 0,
  getTabBar: () => ({
    hide: () => actions.push('hide'),
    show: () => actions.push('show')
  }),
  createSelectorQuery: () => ({
    select(selector) {
      assert.equal(selector, '#home-list');
      return this;
    },
    node() { return this; },
    exec(callback) {
      callback([{ node: { scrollTo: (options) => scrollCalls.push(options) } }]);
    }
  }),
  setData(values, callback) {
    dataUpdates.push(values);
    Object.assign(this.data, values);
    if (callback) callback();
  }
};

page.onListScroll({ detail: { scrollTop: 5 } });
page.onListScroll({ detail: { scrollTop: 9 } });
page.onListScroll({ detail: { scrollTop: 14 } });
page.onListScroll({ detail: { scrollTop: 1 } });
page.onListScroll({ detail: { scrollTop: 0 } });

assert.deepEqual(actions, ['hide', 'show', 'show']);

page.onListScroll({ detail: { scrollTop: 120 } });
dataUpdates.length = 0;
page.scrollToTop();
assert.deepEqual(scrollCalls, [{ top: 0, animated: true, duration: 500 }]);
assert.deepEqual(dataUpdates, []);

const template = fs.readFileSync(path.join(__dirname, '../pages/home/home.wxml'), 'utf8');
assert.match(template, /<scroll-view[^>]*id="home-list"[^>]*enhanced/);
assert.doesNotMatch(template, /scroll-into-view|id="list-top"/);
