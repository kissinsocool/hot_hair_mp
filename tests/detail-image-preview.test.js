const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const previews = [];
let pageDefinition;

global.getApp = () => ({ globalData: { apiBaseUrl: 'https://example.com/api', mediaBaseUrl: '' } });
global.Page = (options) => { pageDefinition = options; };
global.wx = { previewImage: (options) => previews.push(options) };

require('../pages/staff/staff');
pageDefinition.previewAvatar.call({ data: { staff: { imageUrl: 'https://example.com/staff.jpg' } } });
assert.deepEqual(previews.pop(), {
  urls: ['https://example.com/staff.jpg'],
  current: 'https://example.com/staff.jpg'
});

delete require.cache[require.resolve('../pages/detail/detail')];
require('../pages/detail/detail');
pageDefinition.previewHeroImage.call({ data: { salon: { image: 'https://example.com/salon.jpg' } } });
assert.deepEqual(previews.pop(), {
  urls: ['https://example.com/salon.jpg'],
  current: 'https://example.com/salon.jpg'
});

const staffTemplate = fs.readFileSync(path.join(root, 'pages/staff/staff.wxml'), 'utf8');
const detailTemplate = fs.readFileSync(path.join(root, 'pages/detail/detail.wxml'), 'utf8');
assert.match(staffTemplate, /class="avatar"[^>]*bindtap="previewAvatar"/);
assert.match(detailTemplate, /class="hero"[^>]*bindtap="previewHeroImage"/);

delete global.Page;
delete global.wx;
delete global.getApp;
