const app = getApp();
const TEST_TOKEN = '__test_login_bypass__';
const TEST_SESSION = {
  token: TEST_TOKEN,
  user: {
    account: 'test',
    displayName: '测试用户',
    phone: '13800000000',
    gender: '保密'
  }
};

function session() {
  // ponytail: frontend-only login bypass for testing; remove before release.
  return app.globalData.session || wx.getStorageSync('session') || TEST_SESSION;
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
  if (!/^https?:\/\//.test(url)) return Promise.resolve(url);

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

function salonImage(salon = {}) {
  const firstPromo = salon.promoImages && salon.promoImages[0];
  const firstImage = salon.images && salon.images[0];
  return salon.coverImage || salon.coverImageUrl || salon.coverUrl || salon.bannerUrl || salon.image || salon.imageUrl || firstPromo || firstImage || '';
}

function request(path, options = {}) {
  const currentSession = session();
  const token = currentSession && currentSession.token !== TEST_TOKEN && currentSession.token;
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
          resolve(options.withResponse ? { data: res.data, headers: res.header || {} } : res.data);
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

function uploadFile(url, filePath, formData) {
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url,
      filePath,
      name: 'file',
      formData,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) return resolve(res);
        reject(new Error(`图片上传失败 ${res.statusCode}`));
      },
      fail(err) {
        reject(new Error(err.errMsg || '图片上传失败'));
      }
    });
  });
}

async function requestAllPages(path, options = {}) {
  const limit = Math.min(Number(options.limit) || 100, 100);
  const items = [];
  // ponytail: preserves the current full-list UI; switch to load-more before lists exceed 10,000 rows.
  for (let page = 1; page <= 100; page += 1) {
    const separator = path.includes('?') ? '&' : '?';
    const response = await request(`${path}${separator}page=${page}&limit=${limit}`, {
      ...options,
      withResponse: true
    });
    const pageItems = Array.isArray(response.data) ? response.data : [];
    items.push(...pageItems);
    const totalHeader = Object.entries(response.headers)
      .find(([key]) => key.toLowerCase() === 'x-total-count');
    const total = Number(totalHeader && totalHeader[1]);
    if (!hasMorePages(items.length, pageItems.length, limit, Number.isFinite(total) ? total : null)) break;
  }
  return items;
}

function hasMorePages(loaded, pageLength, pageSize, total) {
  return pageLength > 0 && (total == null ? pageLength >= pageSize : loaded < total);
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
  hasMorePages,
  mediaUrl,
  request,
  requestAllPages,
  requireLogin,
  saveSession,
  salonImage,
  session,
  statusText,
  uploadFile
};
