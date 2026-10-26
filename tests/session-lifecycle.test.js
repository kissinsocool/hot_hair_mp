const assert = require('node:assert/strict');
const sockets = [];
const requests = [];
const stored = { session: { token: 'A' } };
const app = { globalData: { apiBaseUrl: 'https://example.com/api', session: stored.session } };
global.getApp = () => app;
global.wx = {
  getStorageSync: key => stored[key],
  setStorageSync: (key, value) => { stored[key] = value; },
  removeStorageSync: key => { delete stored[key]; },
  request: options => requests.push(options),
  connectSocket() {
    const socket = { sent: [], closedCount: 0,
      onMessage(fn) { this.message = fn; }, onClose(fn) { this.closed = fn; }, onError(fn) { this.error = fn; },
      send(value) { this.sent.push(JSON.parse(value.data)); }, close() { this.closedCount++; },
    };
    sockets.push(socket); return socket;
  },
};
const api = require('../utils/api');
const socket = require('../utils/bookingSocket');
async function main() {
  const events = [];
  const off = socket.subscribe(event => events.push(event));
  sockets[0].message({ data: JSON.stringify({ event: 'auth.required' }) });
  assert.equal(sockets[0].sent[0].token, 'A');
  const logout = api.logout();
  assert.equal(requests[0].url, 'https://example.com/api/auth/logout');
  assert.equal(requests[0].header.Authorization, 'Bearer A');
  assert.equal(sockets[0].closedCount, 1);
  assert.equal(api.session(), null);
  api.saveSession({ token: 'B' });
  assert.equal(sockets.length, 2);
  api.saveSession({ token: 'B', user: { displayName: 'updated' } });
  assert.equal(sockets.length, 2, 'same-token profile saves preserve the connection');
  sockets[0].message({ data: JSON.stringify({ event: 'booking.updated' }) });
  sockets[0].closed();
  assert.equal(events.length, 0);
  sockets[1].message({ data: JSON.stringify({ event: 'auth.required' }) });
  assert.equal(sockets[1].sent[0].token, 'B');
  requests[0].success({ statusCode: 401, data: {} });
  await logout;
  assert.equal(api.session().token, 'B');
  off();
}
main().catch(error => { console.error(error); process.exitCode = 1; });
