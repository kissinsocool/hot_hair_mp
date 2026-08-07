const assert = require('node:assert/strict');

global.getApp = () => ({
  globalData: { apiBaseUrl: 'https://example.com/api', mediaBaseUrl: '', session: null }
});
global.wx = { getStorageSync: () => null };
global.Page = (options) => { global.homePageDefinition = options; };

require('../pages/home/home');

const actions = [];
const page = {
  ...global.homePageDefinition,
  data: { ...global.homePageDefinition.data },
  tabBarScrollAnchor: 0,
  getTabBar: () => ({
    hide: () => actions.push('hide'),
    show: () => actions.push('show')
  }),
  setData(values) { Object.assign(this.data, values); }
};

page.onListScroll({ detail: { scrollTop: 5 } });
page.onListScroll({ detail: { scrollTop: 9 } });
page.onListScroll({ detail: { scrollTop: 14 } });
page.onListScroll({ detail: { scrollTop: 1 } });
page.onListScroll({ detail: { scrollTop: 0 } });

assert.deepEqual(actions, ['hide', 'show', 'show']);
