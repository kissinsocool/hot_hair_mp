const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

let definition;
let mediaPickerOpened = false;
global.getApp = () => ({ globalData: { apiBaseUrl: 'https://example.com/api' } });
global.Page = (options) => { definition = options; };
global.wx = {
  getStorageSync: (key) => key === 'session' ? { token: 'token', user: {} } : null,
  removeStorageSync() {},
  chooseMedia() { mediaPickerOpened = true; }
};

require('../pages/profile/profile');

let tabBarAction = '';
let tabBarHidden = false;
const page = {
  ...definition,
  data: { ...definition.data },
  setData(values) { Object.assign(this.data, values); },
  sync() {},
  getTabBar() {
    return {
      hide: () => { tabBarAction = 'hide'; tabBarHidden = true; },
      show: () => { tabBarAction = 'show'; tabBarHidden = false; }
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

page.data.reviews = [{
  bookingId: 'booking-1',
  rating: 5,
  comment: '很好',
  tags: ['善于沟通'],
  imageUrls: [],
  imageKeys: [],
  isAwaitingReview: false
}];
page.editReview({ currentTarget: { dataset: { index: 0 } } });
assert.equal(tabBarHidden, true);
assert.deepEqual(page.data.sheetTags.filter((tag) => tag.selected).map((tag) => tag.name), ['善于沟通']);
page.pickImages();
assert.equal(mediaPickerOpened, true);
page.onHide();
page.onShow();
assert.equal(tabBarHidden, true, 'returning from the media picker must keep the edit-review tab bar hidden');
page.closeSheet();
assert.equal(tabBarHidden, false, 'closing the edit-review sheet must reveal the tab bar');

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
