const app = getApp();

function session() {
  return app.globalData.session || wx.getStorageSync('session') || null;
}

function mediaUrl(value) {
  const text = String(value || '').trim();
  const origin = app.globalData.apiBaseUrl.replace(/\/api\/?$/, '');
  if (!text || text.startsWith('data:')) return text;
  if (/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?\//.test(text)) {
    return encodeURI(text.replace(/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/, origin));
  }
  if (text.startsWith('http')) return encodeURI(text);
  return encodeURI(`${origin}${text.startsWith('/') ? text : `/${text}`}`);
}

function displayImageUrl(value) {
  const url = mediaUrl(value);
  if (!url.startsWith('http://')) return Promise.resolve(url);

  return new Promise((resolve) => {
    wx.downloadFile({
      url,
      success(res) {
        resolve(res.statusCode >= 200 && res.statusCode < 300 && res.tempFilePath ? res.tempFilePath : url);
      },
      fail() {
        resolve(url);
      }
    });
  });
}

function request(path, options = {}) {
  const currentSession = session();
  const token = currentSession && currentSession.token;
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${app.globalData.apiBaseUrl}${path}`,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'content-type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          reject(new Error((res.data && res.data.message) || `请求失败 ${res.statusCode}`));
        }
      },
      fail(err) {
        reject(new Error(err.errMsg || '网络请求失败'));
      }
    });
  });
}

function statusText(status) {
  return {
    pending: '等待商家接单',
    accepted: '商家已接单',
    rejected: '商家已拒单',
    canceled: '已取消',
    completed: '已完成',
    no_show: '未到店'
  }[status] || status || '未知状态';
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function saveSession(data) {
  app.globalData.session = data;
  wx.setStorageSync('session', data);
}

function clearSession() {
  app.globalData.session = null;
  wx.removeStorageSync('session');
}

function requireLogin() {
  const currentSession = session();
  if (currentSession && currentSession.token) return true;
  wx.navigateTo({ url: '/pages/login/login' });
  return false;
}

module.exports = {
  clearSession,
  displayImageUrl,
  formatTime,
  mediaUrl,
  request,
  requireLogin,
  saveSession,
  session,
  statusText
};
