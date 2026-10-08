const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const pageConfig = JSON.parse(fs.readFileSync(path.join(root, 'pages/home/home.json'), 'utf8'));
const template = fs.readFileSync(path.join(root, 'pages/home/home.wxml'), 'utf8');
const source = fs.readFileSync(path.join(root, 'pages/home/home.js'), 'utf8');

assert.notEqual(pageConfig.enablePullDownRefresh, true, '首页只能由列表 scroll-view 处理下拉刷新');
assert.match(template, /<scroll-view[^>]*refresher-enabled[^>]*bindrefresherrefresh="refresh"/);
assert.doesNotMatch(source, /onPullDownRefresh\s*\(/);
