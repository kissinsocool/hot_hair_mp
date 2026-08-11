const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { SERVICE_TABS, serviceCategory, serviceMatchesCategory } = require('../utils/serviceCategories');

assert.deepEqual(SERVICE_TABS.map((tab) => tab.label), ['剪发', '染烫', '头皮护理']);
assert.equal(serviceCategory({ tags: ['男士剪发'] }), 'cut');
assert.equal(serviceCategory({ tags: ['植物染发'] }), 'colorPerm');
assert.equal(serviceCategory({ tags: ['冷烫发型'] }), 'colorPerm');
assert.equal(serviceCategory({ tags: ['染发', '头皮护理'] }), 'colorPerm');
assert.equal(serviceCategory({ tags: ['头皮养护'] }), 'scalpCare');
assert.equal(serviceCategory({ categories: ['护理'] }), 'scalpCare');
assert.equal(serviceCategory({ tags: [] }), 'cut');
assert.equal(serviceMatchesCategory({ tags: ['染发', '头皮护理'] }, 'colorPerm'), true);
assert.equal(serviceMatchesCategory({ tags: ['染发', '头皮护理'] }, 'scalpCare'), true);
assert.equal(serviceMatchesCategory({ tags: ['植物染发'] }, 'scalpCare'), false);

const pageDir = path.join(__dirname, '..', 'pages', 'booking');
const script = fs.readFileSync(path.join(pageDir, 'booking.js'), 'utf8');
const template = fs.readFileSync(path.join(pageDir, 'booking.wxml'), 'utf8');
const styles = fs.readFileSync(path.join(pageDir, 'booking.wxss'), 'utf8');

assert.match(script, /serviceCategory\(selectedService\)/);
assert.match(script, /filter\(\(service\) => serviceMatchesCategory\(service, this\.data\.activeServiceCategory\)\)/);
assert.match(template, /role="tablist"/);
assert.match(template, /bindtap="selectServiceCategory"/);
assert.match(template, /service-tab-slider \{\{activeServiceCategory\}\}/);
assert.match(template, /service-count-number">\{\{serviceOptions\.length\}\}/);
assert.match(styles, /\.service-tab-slider\s*\{[^}]*transition: transform 220ms ease/s);
assert.match(styles, /padding: 14rpx 54rpx 14rpx 14rpx/);
