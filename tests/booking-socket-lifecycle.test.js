const assert = require('node:assert/strict');

const sockets = [];
const timers = new Map();
let timerId = 0;
global.getApp = () => ({ globalData: { apiBaseUrl: 'https://example.com/api', session: { token: 'current' } } });
global.setTimeout = (callback, ms) => { timers.set(++timerId, { callback, ms }); return timerId; };
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
const socketModule = require('../utils/bookingSocket');
const { subscribe, reset, lastEventAt, IDLE_CLOSE_MS, MAX_RECONNECT_ATTEMPTS } = socketModule;
const pendingDelays = () => [...timers.values()].map((timer) => timer.ms);
function runOnlyTimer() {
  assert.equal(timers.size, 1);
  const [[id, timer]] = [...timers.entries()];
  timers.delete(id);
  timer.callback();
}
const send = (connection, event) => connection.message({ data: JSON.stringify({ event }) });

// 切换 tab：旧页面退订后新页面马上订阅，应复用同一连接。
const received = [];
const firstOff = subscribe((event) => received.push(event));
assert.equal(sockets.length, 1);
firstOff();
assert.deepEqual(pendingDelays(), [IDLE_CLOSE_MS], '最后一个监听者退订后延迟断开');
assert.equal(sockets[0].closeCount, 0);
const secondOff = subscribe((event) => received.push(event));
assert.equal(sockets.length, 1, '空闲期内重新订阅复用连接');
assert.equal(timers.size, 0, '重新订阅取消空闲断开');
firstOff();
assert.equal(timers.size, 0, '重复退订不影响其他监听者');

// 重置后旧连接的回调不得影响新连接。
reset();
assert.equal(sockets[0].closeCount, 1);
const second = sockets[1];
sockets[0].closed();
sockets[0].error();
send(sockets[0], 'auth.required');
send(sockets[0], 'booking.updated');
assert.equal(timers.size, 0, '旧回调不得重连或丢失新连接');
assert.equal(second.sent.length, 0, '旧鉴权消息不得发送到新连接');
assert.equal(received.length, 0, '旧消息不得通知新监听者');
send(second, 'auth.required');
assert.equal(JSON.parse(second.sent[0].data).token, 'current');
assert.equal(lastEventAt(), 0);
send(second, 'booking.updated');
assert.equal(received.length, 1);
assert.ok(lastEventAt() > 0, '记录最近一次预约事件时间');

// 错误和关闭只安排一次重连，且底层任务已释放时关闭不报错。
second.closeFailure = { errMsg: 'closeSocket:fail wcwss taskID not exist' };
assert.doesNotThrow(() => second.error(), '底层任务已释放时关闭失败不得成为未处理错误');
assert.equal(second.closeCount, 1, '错误连接必须关闭');
second.closed();
assert.deepEqual(pendingDelays(), [3000], '错误和关闭只能安排一次重连');

// 指数退避：未鉴权成功的连接失败会拉长间隔，鉴权成功后重置。
runOnlyTimer();
sockets[2].closed();
assert.deepEqual(pendingDelays(), [6000]);
runOnlyTimer();
send(sockets[3], 'authenticated');
sockets[3].closed();
assert.deepEqual(pendingDelays(), [3000], '鉴权成功后退避重新开始');

// 连续失败达到上限后停止自动重连。
for (let attempt = 1; attempt < MAX_RECONNECT_ATTEMPTS; attempt += 1) {
  runOnlyTimer();
  sockets[sockets.length - 1].closed();
}
assert.ok(Math.max(...pendingDelays()) <= 60000, '重连间隔有上限');
runOnlyTimer();
sockets[sockets.length - 1].closed();
assert.equal(timers.size, 0, '连续失败达到上限后停止重连');
const socketCountAfterGiveUp = sockets.length;

// 新的订阅重新开始连接。
const thirdOff = subscribe(() => {});
assert.equal(sockets.length, socketCountAfterGiveUp + 1, '放弃重连后新订阅重新建立连接');
const shared = sockets[sockets.length - 1];
const fourthOff = subscribe(() => {});
assert.equal(sockets.length, socketCountAfterGiveUp + 1, '监听者共享连接');
secondOff();
thirdOff();
assert.equal(shared.closeCount, 0);
shared.closed();
assert.deepEqual(pendingDelays(), [3000]);
runOnlyTimer();
const retried = sockets[sockets.length - 1];
retried.closeFailure = { errMsg: 'closeSocket:fail wcwss taskID not exist' };
fourthOff();
assert.equal(retried.closeCount, 0, '空闲期内不立即断开');
assert.doesNotThrow(() => runOnlyTimer());
assert.equal(retried.closeCount, 1, '空闲超时后断开');
retried.closed();
assert.equal(timers.size, 0, '无监听者时不重连');

// 有待执行重连时最后一个监听者退订，应取消重连。
const pendingOff = subscribe(() => {});
sockets[sockets.length - 1].closed();
assert.equal(timers.size, 1);
pendingOff();
assert.equal(timers.size, 0, '无监听者时取消重连');

// reset 在旧任务已释放时也必须建立新连接。
const resetOff = subscribe(() => {});
const previous = sockets[sockets.length - 1];
previous.closeFailure = { errMsg: 'closeSocket:fail wcwss taskID not exist' };
const countBeforeReset = sockets.length;
assert.doesNotThrow(() => reset());
assert.equal(previous.closeCount, 1);
assert.equal(sockets.length, countBeforeReset + 1, '重置后即使旧任务已释放也必须创建新连接');
previous.closed();
previous.error();
assert.equal(timers.size, 0, '重置后的旧回调不得影响新连接');

const warnings = [];
const originalWarn = console.warn;
console.warn = (...args) => warnings.push(args);
try {
  const failure = { errMsg: 'closeSocket:fail unexpected failure' };
  sockets[sockets.length - 1].closeFailure = failure;
  resetOff();
  runOnlyTimer();
  assert.equal(warnings.length, 1, '未知关闭错误必须保留诊断日志');
  assert.equal(warnings[0][1], failure);
} finally {
  console.warn = originalWarn;
}
