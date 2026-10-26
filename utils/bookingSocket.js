const app = getApp();

let socket = null;
let reconnectTimer = null;
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
        if (token) {
          connection.send({
            data: JSON.stringify({
              event: 'authenticate',
              role: 'client',
              token
            })
          });
        }
        return;
      }
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

function reconnect(connection, close = false) {
  if (socket !== connection) return;
  socket = null;
  if (close) closeConnection(connection);
  if (!listeners.length || reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, 3000);
}

function subscribe(listener) {
  listeners.push(listener);
  connect();
  return () => {
    listeners = listeners.filter((item) => item !== listener);
    if (listeners.length) return;
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
    const connection = socket;
    socket = null;
    if (connection) closeConnection(connection);
  };
}

function reset() {
  clearTimeout(reconnectTimer);
  reconnectTimer = null;
  const previous = socket;
  socket = null;
  if (previous) closeConnection(previous);
  connect();
}

module.exports = { subscribe, reset };
