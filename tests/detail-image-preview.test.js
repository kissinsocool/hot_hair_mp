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
assert.equal(pageDefinition.previewHeroImage, undefined, '封面大图已隐藏，不再保留预览入口');

const staffTemplate = fs.readFileSync(path.join(root, 'pages/staff/staff.wxml'), 'utf8');
const detailTemplate = fs.readFileSync(path.join(root, 'pages/detail/detail.wxml'), 'utf8');
assert.match(staffTemplate, /class="avatar"[^>]*bindtap="previewAvatar"/);
assert.doesNotMatch(detailTemplate, /previewHeroImage/);
assert.match(detailTemplate, /wx:for="\{\{salon\.afterSalesPolicies\}\}"/);
assert.match(detailTemplate, /wx:if="\{\{salon\.afterSalesPolicies\.length \|\| salon\.acceptsSameDayBooking === true\}\}" class="after-sales"/);
assert.match(detailTemplate, /class="after-sales-icon"[^>]*src="\/assets\/icons\/right_gray\.svg"/);
assert.match(detailTemplate, /wx:if="\{\{salon\.acceptsSameDayBooking === true\}\}" class="after-sales-row"[^>]*>[^]*<text>当日可约<\/text>/);

delete global.Page;
delete global.wx;
delete global.getApp;
