const app = getApp();

// 页面切换时（如 switchTab）旧页面先 onHide 退订、新页面再 onShow 订阅；
// 空闲一段时间后才断开，避免每次切换 tab 都重新建连和鉴权。
const IDLE_CLOSE_MS = 30 * 1000;
const RECONNECT_BASE_MS = 3000;
const RECONNECT_MAX_MS = 60 * 1000;
// 连续失败达到上限后停止自动重连，直到下一次订阅或会话重置。
const MAX_RECONNECT_ATTEMPTS = 8;

let socket = null;
let reconnectTimer = null;
let idleTimer = null;
let reconnectAttempts = 0;
let lastBookingEventAt = 0;
let listeners = [];

function socketUrl() {
  return app.globalData.apiBaseUrl
    .replace(/^http/, 'ws')
    .replace(/\/api\/?$/, '/ws');
}

function connect() {
  if (socket || reconnectTimer || !listeners.length) return;

  const session = app.globalData.session || wx.getStorageSync('session');
  const token = session && session.token;
  if (!token) return;
  const connection = wx.connectSocket({ url: socketUrl() });
  socket = connection;
  connection.onMessage((res) => {
    if (socket !== connection) return;
    try {
      const data = JSON.parse(res.data);
      if (data.event === 'auth.required') {
        connection.send({
          data: JSON.stringify({
            event: 'authenticate',
            role: 'client',
            token
          })
        });
        return;
      }
      // 只有鉴权成功才视为连接恢复；仅建立 TCP 连接后被服务端拒绝不应重置退避。
      if (data.event === 'authenticated') reconnectAttempts = 0;
      if (/^booking\./.test(data.event || '')) lastBookingEventAt = Date.now();
      listeners.forEach((listener) => listener(data));
    } catch (_) {}
  });
  connection.onClose(() => reconnect(connection));
  connection.onError(() => reconnect(connection, true));
}

function closeConnection(connection) {
  connection.close({
    fail(error) {
      // onError 后底层可能已释放任务；此时连接已达到关闭目的。
      if (error.errMsg === 'closeSocket:fail wcwss taskID not exist') return;
      console.warn('预约连接关闭失败', error);
    }
  });
}

function reconnectDelay(attempt) {
  return Math.min(RECONNECT_BASE_MS * (2 ** attempt), RECONNECT_MAX_MS);
}

function reconnect(connection, close = false) {
  if (socket !== connection) return;
  socket = null;
  if (close) closeConnection(connection);
  if (!listeners.length || reconnectTimer) return;
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return;
  const delay = reconnectDelay(reconnectAttempts);
  reconnectAttempts += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

function cancelIdleClose() {
  clearTimeout(idleTimer);
  idleTimer = null;
}

function closeIdleConnection() {
  idleTimer = null;
  if (listeners.length) return;
  const connection = socket;
  socket = null;
  if (connection) closeConnection(connection);
}

function subscribe(listener) {
  listeners.push(listener);
  cancelIdleClose();
  // 已放弃自动重连时，新的订阅代表用户回到实时页面，重新开始一轮退避。
  if (!socket && !reconnectTimer) reconnectAttempts = 0;
  connect();
  let subscribed = true;
  return () => {
    if (!subscribed) return;
    subscribed = false;
    listeners = listeners.filter((item) => item !== listener);
    if (listeners.length) return;
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
    if (!socket) return;
    cancelIdleClose();
    idleTimer = setTimeout(closeIdleConnection, IDLE_CLOSE_MS);
  };
}

function reset() {
  clearTimeout(reconnectTimer);
  reconnectTimer = null;
  cancelIdleClose();
  reconnectAttempts = 0;
  const previous = socket;
  socket = null;
  if (previous) closeConnection(previous);
  connect();
}

// 最近一次收到预约事件的时间，供依赖预约状态的短期缓存判断是否失效。
function lastEventAt() {
  return lastBookingEventAt;
}

module.exports = { subscribe, reset, lastEventAt, IDLE_CLOSE_MS, MAX_RECONNECT_ATTEMPTS };
