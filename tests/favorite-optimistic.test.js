const assert = require('node:assert/strict');
const test = require('node:test');

global.getApp = () => ({ globalData: { apiBaseUrl: 'https://example.com/api', mediaBaseUrl: '', session: { token: 't' }, sessionLoaded: true } });
const pending = [];
global.wx = {
  getStorageSync: () => null,
  request(options) { pending.push(options); }
};
const favorites = require('../utils/favorites');

test('toggle applies immediately, ignores repeat taps and rolls back on failure', async () => {
  const states = [];
  const first = favorites.toggle('a', true, (value) => states.push(value));
  assert.deepEqual(states, [true], 'UI updates before the request returns');
  assert.equal(await favorites.toggle('a', false, (value) => states.push(value)), null);
  assert.equal(pending.length, 1);
  pending.shift().success({ statusCode: 200, data: { ok: true } });
  assert.deepEqual(await first, { result: { ok: true } });

  const second = favorites.toggle('a', false, (value) => states.push(value));
  pending.shift().fail({ errMsg: 'request:fail' });
  await assert.rejects(second);
  assert.deepEqual(states, [true, false, true], 'failure restores the previous state');

  const third = favorites.toggle('a', false, () => {});
  assert.equal(pending.length, 1, 'a finished request no longer blocks the item');
  pending.shift().success({ statusCode: 200, data: {} });
  await third;
});
