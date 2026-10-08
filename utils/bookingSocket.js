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
  if (socket || !listeners.length) return;

  socket = wx.connectSocket({ url: socketUrl() });
  socket.onMessage((res) => {
    try {
      const data = JSON.parse(res.data);
      if (data.event === 'auth.required') {
        const session = app.globalData.session || wx.getStorageSync('session');
        if (session && session.token) {
          socket.send({
            data: JSON.stringify({
              event: 'authenticate',
              role: 'client',
              token: session.token
            })
          });
        }
        return;
      }
      listeners.forEach((listener) => listener(data));
    } catch (_) {}
  });
  socket.onClose(reconnect);
  socket.onError(reconnect);
}

function reconnect() {
  socket = null;
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
    if (listeners.length || !socket) return;
    socket.close();
    socket = null;
  };
}

module.exports = { subscribe };
