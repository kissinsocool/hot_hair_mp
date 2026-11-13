const assert = require('node:assert/strict');

let ready;
let failed;
let modal;
let applied = 0;
global.wx = {
  getUpdateManager: () => ({
    onUpdateReady: (fn) => { ready = fn; },
    onUpdateFailed: (fn) => { failed = fn; },
    applyUpdate: () => { applied += 1; }
  }),
  showModal: (options) => { modal = options; },
  getStorageSync: () => null
};
let appDefinition;
global.App = (value) => { appDefinition = value; };
require('../app');
appDefinition.onLaunch();

ready();
assert.equal(modal.title, '发现新版本');
modal.success({ confirm: false });
assert.equal(applied, 0, 'choosing later never forces a restart');
modal.success({ confirm: true });
assert.equal(applied, 1);
const warn = console.warn;
console.warn = () => {};
failed();
console.warn = warn;

// 基础库不支持时不报错。
delete global.wx.getUpdateManager;
require('../utils/appUpdate').watchForUpdate();
