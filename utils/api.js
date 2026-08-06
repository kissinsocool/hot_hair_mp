const app = getApp();
const LOGIN_PAGE = '/pages/login/login';
const PENDING_AVATAR_PREVIEW_KEY = 'pendingAvatarPreview';
let navigatingToLogin = false;

function session() {
  return app.globalData.session || wx.getStorageSync('session') || null;
}

function mediaUrl(value) {
  const text = String(value || '').trim();
  const origin = app.globalData.apiBaseUrl.replace(/\/api\/?$/, '');
  const mediaOrigin = app.globalData.mediaBaseUrl;
  if (!text || text.startsWith('data:')) return text;
  if (mediaOrigin) {
    const publicOssUrl = text.replace(
      /^https?:\/\/hothairapp\.oss-cn-beijing\.aliyuncs\.com(?=\/)/,
      mediaOrigin
    );
    if (publicOssUrl !== text) return encodeURI(publicOssUrl);
  }
  if (/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?\//.test(text)) {
    return encodeURI(text.replace(/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/, origin));
  }
  if (text.startsWith('http')) return encodeURI(text);
  return encodeURI(`${origin}${text.startsWith('/') ? text : `/${text}`}`);
}

function displayImageUrl(value) {
  return Promise.resolve(mediaUrl(value));
}

function userAvatarUrl(user = {}) {
  return pendingAvatarPreview(user) || mediaUrl(user.avatarUrl || '');
}

function userKey(user = {}) {
  return String(user.id || user._id || user.userId || user.account || '');
}

function pendingAvatarPreview(user = {}) {
  const preview = wx.getStorageSync(PENDING_AVATAR_PREVIEW_KEY);
  if (!preview) return '';
  if (user.avatarReviewStatus !== 'pending' || !preview.userKey || preview.userKey !== userKey(user)) {
    clearPendingAvatarPreview();
    return '';
  }
  try {
    wx.getFileSystemManager().accessSync(preview.filePath);
    return preview.filePath;
  } catch (_) {
    clearPendingAvatarPreview();
    return '';
  }
}

function savePendingAvatarPreview(tempFilePath, user = {}) {
  const owner = userKey(user);
  if (!tempFilePath || !owner) return Promise.reject(new Error('无法保存待审核头像'));
  return new Promise((resolve, reject) => {
    wx.saveFile({
      tempFilePath,
      success(res) {
        const previous = wx.getStorageSync(PENDING_AVATAR_PREVIEW_KEY);
        wx.setStorageSync(PENDING_AVATAR_PREVIEW_KEY, { userKey: owner, filePath: res.savedFilePath });
        if (previous && previous.filePath !== res.savedFilePath) removeSavedFile(previous.filePath);
        resolve(res.savedFilePath);
      },
      fail(err) {
        reject(new Error((err && err.errMsg) || '待审核头像保存失败'));
      }
    });
  });
}

function removeSavedFile(filePath) {
  if (!filePath || !wx.removeSavedFile) return;
  wx.removeSavedFile({ filePath });
}

function clearPendingAvatarPreview() {
  const preview = wx.getStorageSync(PENDING_AVATAR_PREVIEW_KEY);
  wx.removeStorageSync(PENDING_AVATAR_PREVIEW_KEY);
  if (preview) removeSavedFile(preview.filePath);
}

function salonImage(salon = {}) {
  const firstPromo = salon.promoImages && salon.promoImages[0];
  const firstImage = salon.images && salon.images[0];
  return salon.coverImage || salon.coverImageUrl || salon.coverUrl || salon.bannerUrl || salon.image || salon.imageUrl || firstPromo || firstImage || '';
}

function request(path, options = {}) {
  const method = options.method || 'GET';
  const currentSession = session();
  const token = currentSession && currentSession.token;
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${app.globalData.apiBaseUrl}${path}`,
      method,
      data: options.data || {},
      header: {
        'content-type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(options.withResponse ? { data: res.data, headers: res.header || {} } : res.data);
        } else {
          if (res.statusCode === 401) handleUnauthorized(token);
          reject(new Error(res.statusCode === 401
            ? '登录状态已失效，请重新登录'
            : res.statusCode === 429
              ? '操作频繁，请稍后再试'
              : (res.data && res.data.message) || `请求失败 ${res.statusCode}`));
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
  clearPendingAvatarPreview();
}

function handleUnauthorized(requestToken) {
  const currentSession = session();
  if (currentSession && currentSession.token && currentSession.token !== requestToken) return;
  clearSession();

  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  if (navigatingToLogin || (currentPage && `/${currentPage.route}` === LOGIN_PAGE)) return;

  navigatingToLogin = true;
  wx.navigateTo({
    url: LOGIN_PAGE,
    success() { navigatingToLogin = false; },
    fail() {
      wx.reLaunch({
        url: LOGIN_PAGE,
        complete() { navigatingToLogin = false; }
      });
    }
  });
}

function requireLogin() {
  const currentSession = session();
  if (currentSession && currentSession.token) return true;
  wx.navigateTo({ url: LOGIN_PAGE });
  return false;
}

module.exports = {
  clearPendingAvatarPreview,
  clearSession,
  displayImageUrl,
  formatTime,
  hasMorePages,
  mediaUrl,
  request,
  requestAllPages,
  requireLogin,
  savePendingAvatarPreview,
  saveSession,
  salonImage,
  session,
  statusText,
  uploadFile,
  userAvatarUrl
};
