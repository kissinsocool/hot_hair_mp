const assert = require('node:assert/strict');

const entries = [];
global.wx = {
  getRealtimeLogManager: () => ({
    warn: (...args) => entries.push(['warn', ...args]),
    error: (...args) => entries.push(['error', ...args])
  }),
  getStorageSync: () => null,
  request: (options) => requests.push(options)
};
const requests = [];
const consoleWarn = console.warn;
const consoleError = console.error;
console.warn = () => {};
console.error = () => {};

let appDefinition;
global.App = (value) => { appDefinition = value; };
require('../app');
global.getApp = () => appDefinition;
const api = require('../utils/api');

(async () => {
  appDefinition.onError('TypeError: x is undefined');
  appDefinition.onUnhandledRejection({ reason: new Error('boom') });
  assert.equal(entries[0][0], 'error');
  assert.match(entries[0][2], /x is undefined/);
  assert.match(entries[1][2], /boom/);

  const failed = api.request('/salons?latitude=31.2&longitude=121.5&keyword=%E5%BA%97');
  requests.pop().fail({ errMsg: 'request:fail timeout' });
  await assert.rejects(failed);
  const conflict = api.request('/bookings', { method: 'POST', data: { phone: '13800000000' } });
  requests.pop().success({ statusCode: 409, data: {} });
  await assert.rejects(conflict);
  const broken = api.request('/bookings', { method: 'POST', data: { phone: '13800000000' } });
  requests.pop().success({ statusCode: 502, data: {} });
  await assert.rejects(broken);

  const apiEntries = entries.slice(2);
  assert.deepEqual(apiEntries, [
    ['warn', '[api] request failed', 'GET', '/salons', 'request:fail timeout'],
    ['warn', '[api] request failed', 'POST', '/bookings', 'HTTP 502']
  ], 'only server errors and network failures are logged, without query or body');
  assert.ok(!JSON.stringify(entries).includes('13800000000'));
  assert.ok(!JSON.stringify(entries).includes('121.5'));
})().catch((error) => { process.exitCode = 1; consoleError(error); }).finally(() => {
  console.warn = consoleWarn;
  console.error = consoleError;
});
