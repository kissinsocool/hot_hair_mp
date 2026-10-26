const assert = require('node:assert/strict');

const sockets = [];
const timers = new Map();
let timerId = 0;
global.getApp = () => ({ globalData: { apiBaseUrl: 'https://example.com/api', session: { token: 'current' } } });
global.setTimeout = (callback) => { timers.set(++timerId, callback); return timerId; };
global.clearTimeout = (id) => timers.delete(id);
global.wx = {
  connectSocket({ url }) {
    assert.equal(url, 'wss://example.com/ws');
    const connection = {
      closeCount: 0, sent: [],
      onMessage(fn) { this.message = fn; },
      onClose(fn) { this.closed = fn; },
      onError(fn) { this.error = fn; },
      close(options = {}) {
        this.closeCount += 1;
        if (this.closeFailure) {
          if (options.fail) options.fail(this.closeFailure);
          else throw this.closeFailure;
        }
      },
      send(value) { this.sent.push(value); }
    };
    sockets.push(connection);
    return connection;
  }
};
const { subscribe, reset } = require('../utils/bookingSocket');
const received = [];
const firstOff = subscribe((event) => received.push(event));
firstOff();
const secondOff = subscribe((event) => received.push(event));
const second = sockets[1];
sockets[0].closed();
sockets[0].error();
sockets[0].message({ data: JSON.stringify({ event: 'auth.required' }) });
sockets[0].message({ data: JSON.stringify({ event: 'booking.updated' }) });
assert.equal(timers.size, 0, '旧回调不得重连或丢失新连接');
assert.equal(second.sent.length, 0, '旧鉴权消息不得发送到新连接');
assert.equal(received.length, 0, '旧消息不得通知新监听者');
second.message({ data: JSON.stringify({ event: 'auth.required' }) });
assert.equal(JSON.parse(second.sent[0].data).token, 'current');
second.message({ data: JSON.stringify({ event: 'booking.updated' }) });
assert.equal(received.length, 1);
second.closeFailure = { errMsg: 'closeSocket:fail wcwss taskID not exist' };
assert.doesNotThrow(() => second.error(), '底层任务已释放时关闭失败不得成为未处理错误');
assert.equal(second.closeCount, 1, '错误连接必须关闭');
second.closed();
assert.equal(timers.size, 1, '错误和关闭只能安排一次重连');
secondOff();
assert.equal(timers.size, 0, '无监听者时取消重连');
const thirdOff = subscribe(() => {});
const fourthOff = subscribe(() => {});
assert.equal(sockets.length, 3, '监听者共享连接');
thirdOff();
assert.equal(sockets[2].closeCount, 0);
sockets[2].closed();
const retry = [...timers.values()][0];
timers.clear();
retry();
assert.equal(sockets.length, 4);
sockets[3].closeFailure = { errMsg: 'closeSocket:fail wcwss taskID not exist' };
assert.doesNotThrow(() => fourthOff());
assert.equal(sockets[3].closeCount, 1);
sockets[3].closed();
assert.equal(timers.size, 0);
const resetOff = subscribe(() => {});
const previous = sockets[4];
previous.closeFailure = { errMsg: 'closeSocket:fail wcwss taskID not exist' };
assert.doesNotThrow(() => reset());
assert.equal(previous.closeCount, 1);
assert.equal(sockets.length, 6, '重置后即使旧任务已释放也必须创建新连接');
previous.closed();
previous.error();
assert.equal(timers.size, 0, '重置后的旧回调不得影响新连接');
const warnings = [];
const originalWarn = console.warn;
console.warn = (...args) => warnings.push(args);
try {
  const failure = { errMsg: 'closeSocket:fail unexpected failure' };
  sockets[5].closeFailure = failure;
  resetOff();
  assert.equal(warnings.length, 1, '未知关闭错误必须保留诊断日志');
  assert.equal(warnings[0][1], failure);
} finally {
  console.warn = originalWarn;
}
