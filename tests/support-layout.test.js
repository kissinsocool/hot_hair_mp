const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const globalStyles = fs.readFileSync(path.join(root, 'app.wxss'), 'utf8');
const supportStyles = fs.readFileSync(path.join(root, 'pages', 'support', 'support.wxss'), 'utf8');
const supportTemplate = fs.readFileSync(path.join(root, 'pages', 'support', 'support.wxml'), 'utf8');

assert.match(supportStyles, /\.problem-input,\s*\.contact-input\s*\{[^}]*width:\s*100%;/s);
assert.match(supportStyles, /\.problem-input\s*\{[^}]*padding:\s*24rpx;/s);
assert.match(supportStyles, /\.support-phone\s*\{[^}]*margin-top:\s*auto;/s);
assert.match(supportStyles, /\.support-phone\s*\{[^}]*color:\s*#999;/s);
assert.match(supportTemplate, /class="support-phone"[^>]*bindtap="callSupport"/);
assert.match(supportTemplate, /联系我们：\{\{supportPhone\}\}/);
assert.doesNotMatch(supportTemplate, /support-phone-icon/);
assert.match(globalStyles, /view,\s*text,\s*image,\s*button,\s*input,\s*textarea\s*\{[^}]*box-sizing:\s*border-box;/s);

let pageDefinition;
let dialedNumber = '';
global.getApp = () => ({ globalData: { apiBaseUrl: 'https://example.com/api' } });
global.Page = (options) => { pageDefinition = options; };
global.wx = { makePhoneCall: ({ phoneNumber }) => { dialedNumber = phoneNumber; } };
require('../pages/support/support');
assert.equal(pageDefinition.data.supportPhone, '010-89281898');
pageDefinition.callSupport.call({ data: pageDefinition.data });
assert.equal(dialedNumber, '01089281898');

delete global.Page;
delete global.wx;
delete global.getApp;
