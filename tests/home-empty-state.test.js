const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const template = fs.readFileSync(path.join(__dirname, '../pages/home/home.wxml'), 'utf8');

assert.match(template, /wx:elif="{{keyword && !visibleSalons\.length}}"[\s\S]*?没有找到匹配的沙龙/);
assert.match(template, /wx:elif="{{!visibleSalons\.length}}"[\s\S]*?附近暂无沙龙请更换定位重新尝试/);
