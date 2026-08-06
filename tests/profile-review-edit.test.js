const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

let definition;
global.getApp = () => ({ globalData: { apiBaseUrl: 'https://example.com/api' } });
global.Page = (options) => { definition = options; };
global.wx = {
  getStorageSync: (key) => key === 'session' ? { token: 'token', user: {} } : null,
  removeStorageSync() {}
};

require('../pages/profile/profile');

let tabBarAction = '';
const page = {
  ...definition,
  data: { ...definition.data },
  setData(values) { Object.assign(this.data, values); },
  getTabBar() {
    return {
      hide: () => { tabBarAction = 'hide'; },
      show: () => { tabBarAction = 'show'; }
    };
  }
};

page.data.sheetImages = [
  { tempPath: 'https://example.com/existing.jpg', retainedUrl: 'reviews/existing.jpg', existing: true },
  { tempPath: 'wxfile://new.jpg', existing: false }
];
page.removeImage({ currentTarget: { dataset: { index: 0 } } });
assert.deepEqual(page.data.sheetImages, [{ tempPath: 'wxfile://new.jpg', existing: false }]);

page.data.sheetVisible = true;
page.onHide();
assert.equal(tabBarAction, '');
page.data.sheetVisible = false;
page.onHide();
assert.equal(tabBarAction, 'show');

const pageDir = path.join(__dirname, '..', 'pages', 'profile');
const template = fs.readFileSync(path.join(pageDir, 'profile.wxml'), 'utf8');
const styles = fs.readFileSync(path.join(pageDir, 'profile.wxss'), 'utf8');
assert.match(template, /<page-meta page-style="\{\{sheetVisible \? 'overflow: hidden;' : ''\}\}"/);
assert.match(styles, /\.sheet\s*\{[^}]*max-height:\s*88vh;[^}]*box-sizing:\s*border-box;/s);
assert.match(styles, /\.sheet-body\s*\{[^}]*flex:\s*0 1 auto;[^}]*max-height:\s*calc\(88vh - 132rpx - env\(safe-area-inset-bottom\)\);/s);
assert.match(styles, /\.remove\s*\{[^}]*z-index:\s*2;/s);

delete global.Page;
delete global.wx;
delete global.getApp;
