const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pageDir = path.join(__dirname, '..', 'pages', 'orders');
const homeTemplate = fs.readFileSync(path.join(__dirname, '..', 'pages', 'home', 'home.wxml'), 'utf8');
const template = fs.readFileSync(path.join(pageDir, 'orders.wxml'), 'utf8');
const styles = fs.readFileSync(path.join(pageDir, 'orders.wxss'), 'utf8');
const config = JSON.parse(fs.readFileSync(path.join(pageDir, 'orders.json'), 'utf8'));

assert.ok(template.indexOf('class="orders-appbar"') < template.indexOf('<scroll-view'));
assert.match(template, /class="orders-appbar-spacer" style="height: \{\{appBarHeight\}\}px;"/);
assert.match(template, /class="orders-list"/);
assert.match(template, /bindrefresherrefresh="refresh"/);
assert.match(homeTemplate, /class="location" style="max-width: calc\(100% - \{\{menuButtonOffset\}\}px - 62rpx\);"/);
assert.match(homeTemplate, /class="message-btn" style="margin-right: \{\{menuButtonOffset\}\}px;"/);
assert.match(template, /class="orders-bell" style="margin-right: \{\{menuButtonOffset\}\}px;"/);
assert.match(styles, /\.orders-appbar\s*\{[^}]*position:\s*fixed;/s);
assert.equal(config.enablePullDownRefresh, undefined);

global.wx = {
  getWindowInfo: () => ({ windowWidth: 375, statusBarHeight: 20 }),
  getMenuButtonBoundingClientRect: () => ({ left: 278, top: 26, width: 87, height: 32 })
};
const layout = require('../utils/layout');
const menuButtonOffset = layout.appBarSize().menuButtonOffset;
assert.equal(menuButtonOffset, 97);
assert.equal(278 - (375 - 14 - menuButtonOffset), 14);
delete global.wx;
