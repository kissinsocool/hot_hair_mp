const assert = require('node:assert/strict');
const sockets = [];
global.getApp = () => ({ globalData: { apiBaseUrl: 'https://example.com/api', session: { token: 'A' } } });
global.wx = {
  getStorageSync: () => null,
  connectSocket() {
    const socket = { onMessage() {}, onClose(fn) { this.closed = fn; }, onError() {}, close() {}, send() {} };
    sockets.push(socket);
    return socket;
  }
};
const bookingSocket = require('../utils/bookingSocket');

bookingSocket.resume();
assert.equal(sockets.length, 0, 'nothing to resume without subscribers');
const off = bookingSocket.subscribe(() => {});
assert.equal(sockets.length, 1);
bookingSocket.resume();
assert.equal(sockets.length, 1, 'an open connection is kept');
sockets[0].closed();
// 断线后处于退避等待中：网络恢复时不等计时器，立即重连。
bookingSocket.resume();
assert.equal(sockets.length, 2);
off();
bookingSocket.reset();
