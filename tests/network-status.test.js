const assert = require('node:assert/strict');

let listener;
const toasts = [];
const restored = [];
let resumes = 0;
global.wx = {
  getNetworkType({ success }) { success({ networkType: 'wifi' }); },
  onNetworkStatusChange(fn) { listener = fn; },
  showToast(options) { toasts.push(options.title); }
};
global.getCurrentPages = () => [{ onNetworkRestored() { restored.push('page'); } }];
const Module = require('node:module');
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === './bookingSocket') return { resume() { resumes += 1; } };
  return originalLoad.call(this, request, parent, isMain);
};
const networkStatus = require('../utils/networkStatus');
networkStatus.watch();
networkStatus.watch();

listener({ isConnected: true });
assert.deepEqual(toasts, [], 'no change, no prompt');
listener({ isConnected: false });
listener({ isConnected: false });
assert.deepEqual(toasts, ['网络已断开，请检查网络设置'], 'prompted once per disconnection');
assert.equal(networkStatus.isOnline(), false);
listener({ isConnected: true });
assert.equal(resumes, 1);
assert.deepEqual(restored, ['page']);
global.getCurrentPages = () => [{}];
listener({ isConnected: false });
listener({ isConnected: true });
assert.equal(resumes, 2, 'pages without the hook are fine');
Module._load = originalLoad;
