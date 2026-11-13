const app = getApp();
const logger = require('./logger');
const LOGIN_PAGE = '/pages/login/login';
const PENDING_AVATAR_PREVIEW_KEY = 'pendingAvatarPreview';
const WEBP_FORMAT_SUFFIX = '/format,webp';
const THUMBNAIL_URL = /^([^?#]+)\?x-oss-process=image\/resize,w_\d+\/quality,q_75(?:\/format,webp)?$/;
let navigatingToLogin = false;
const inflightGetRequests = new Map();
let lastWriteCompletedAt = 0;

function session() {
  // 启动时已把本地会话读入内存，未登录时不必每次请求都同步读取 storage。
  if (app.globalData.session || app.globalData.sessionLoaded) return app.globalData.session || null;
  return wx.getStorageSync('session') || null;
}

function mediaUrl(value) {
  const text = String(value || '').trim();
  const origin = app.globalData.apiBaseUrl.replace(/\/api\/?$/, '');
  const mediaOrigin = app.globalData.mediaBaseUrl;
  if (!text || text.startsWith('data:') || text.startsWith('wxfile://')) return text;
  // Signed URLs are already encoded; changing their query invalidates the signature.
  if (/^https?:\/\//i.test(text) && /[?&](?:Signature|X-Amz-Signature|x-oss-signature)=/i.test(text)) return text;
  if (mediaOrigin) {
    const publicOssUrl = text.replace(
      /^https?:\/\/hothair(?:app|media)\.oss-cn-beijing\.aliyuncs\.com(?=\/)/,
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

function thumbnailUrl(value, width = 720, { webp = false } = {}) {
  const url = mediaUrl(value);
  const mediaOrigin = app.globalData.mediaBaseUrl;
  if (!mediaOrigin || !url.startsWith(`${mediaOrigin}/`) || /[?#]/.test(url) || !/\.(jpe?g|png|webp)$/i.test(url)) return url;
  const format = webp && /\.jpe?g$/i.test(url) ? WEBP_FORMAT_SUFFIX : '';
  return `${url}?x-oss-process=image/resize,w_${width}/quality,q_75${format}`;
}

function displayImageUrl(value, width, options) {
  return Promise.resolve(thumbnailUrl(value, width, options));
}

function jpegThumbnailFallback(url) {
  const origin = app.globalData.mediaBaseUrl;
  if (origin && url.startsWith(`${origin}/`) && url.endsWith(WEBP_FORMAT_SUFFIX) && THUMBNAIL_URL.test(url)) {
    return url.slice(0, -WEBP_FORMAT_SUFFIX.length);
  }
  return url;
}

function previewImage({ urls, current }) {
  const origin = app.globalData.mediaBaseUrl;
  const original = (url) => origin && url.startsWith(`${origin}/`) ? url.replace(THUMBNAIL_URL, '$1') : url;
  wx.previewImage({ urls: urls.map(original), current: original(current) });
}

function userAvatarUrl(user = {}) {
  return pendingAvatarPreview(user) || thumbnailUrl(user.avatarUrl || '', 240);
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

// 列表卡片的图片组：封面在前，其后是轮播图和店铺图片，去重后最多取 limit 张。
function salonImages(salon = {}, limit) {
  const list = (value) => Array.isArray(value) ? value : [];
  const urls = [salonImage(salon), ...list(salon.promoImages), ...list(salon.images)]
    .filter((url) => typeof url === 'string' && url);
  return [...new Set(urls)].slice(0, limit);
}

function responseErrorMessage(statusCode, data) {
  const message = data && data.message && String(data.message).trim();
  if (isReadableChineseMessage(message)) return message;
  if (statusCode === 401) return '登录状态已失效，请重新登录';
  if (statusCode === 403) return '当前账号没有权限执行此操作';
  if (statusCode === 404) return '请求的内容不存在或已被删除';
  if (statusCode === 409) return '当前状态已发生变化，请刷新后重试';
  if (statusCode === 429) return '操作频繁，请稍后再试';
  if (statusCode >= 500) return '服务暂时不可用，请稍后重试';
  return '请求失败，请稍后重试';
}

function isReadableChineseMessage(message) {
  return Boolean(
    message
    && /[\u4e00-\u9fff]/.test(message)
    && !/\b(?:HTTP|status(?:Code)?)\s*:?\s*\d{3}\b/i.test(message)
  );
}

function networkErrorMessage(error) {
  return /timeout/i.test((error && error.errMsg) || '')
    ? '请求超时，请稍后重试'
    : '网络连接失败，请检查网络后重试';
}

function request(path, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const currentSession = session();
  const token = currentSession && currentSession.token;
  const requestKey = method === 'GET'
    ? `${token || 'anonymous'}:${options.withResponse ? 'response' : 'data'}:${path}:${JSON.stringify(options.data || {})}`
    : '';
  if (requestKey && inflightGetRequests.has(requestKey)) return inflightGetRequests.get(requestKey);
  // 写请求结束后（无论成败，服务端状态都可能已变化），之前读取的页面数据不再视为最新。
  const markWrite = method !== 'GET' && options.affectsUserData !== false
    ? () => { lastWriteCompletedAt = Date.now(); }
    : () => {};

  const promise = new Promise((resolve, reject) => {
    wx.request({
      url: `${app.globalData.apiBaseUrl}${path}`,
      method,
      data: options.data || {},
      header: {
        'content-type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      success(res) {
        markWrite();
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(options.withResponse ? { data: res.data, headers: res.header || {} } : res.data);
        } else {
          // 只记录服务端异常；4xx 是业务上的正常拒绝（未登录、冲突、校验失败等）。
          if (res.statusCode >= 500) logRequestFailure(method, path, `HTTP ${res.statusCode}`);
          if (res.statusCode === 401 && !options.skipUnauthorized) handleUnauthorized(token);
          const error = new Error(responseErrorMessage(res.statusCode, res.data));
          error.statusCode = res.statusCode;
          error.code = res.data && res.data.code;
          error.data = res.data;
          reject(error);
        }
      },
      fail(err) {
        markWrite();
        logRequestFailure(method, path, (err && err.errMsg) || 'request:fail');
        const error = new Error(networkErrorMessage(err));
        // 超时不代表服务端没有处理：写请求可能已经生效，调用方据此决定是否提示用户先核对结果。
        error.timeout = /timeout/i.test((err && err.errMsg) || '');
        reject(error);
      }
    });
  });
  if (requestKey) {
    inflightGetRequests.set(requestKey, promise);
    promise.then(
      () => inflightGetRequests.delete(requestKey),
      () => inflightGetRequests.delete(requestKey)
    );
  }
  return promise;
}

// 路径去掉查询参数（其中可能有位置、搜索词），只保留接口位置。
function logRequestFailure(method, path, reason) {
  logger.warn('[api] request failed', method, String(path).split('?')[0], reason);
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
        reject(new Error('图片上传失败，请稍后重试'));
      },
      fail() {
        reject(new Error('图片上传失败，请检查网络后重试'));
      }
    });
  });
}

// 最近一次写请求结束的时间，供页面判断已加载的数据是否仍然有效。
function lastWriteAt() {
  return lastWriteCompletedAt;
}

async function requestAllPages(path, options = {}) {
  const limit = Math.min(Number(options.limit) || 100, 100);
  const items = [];
  for (let page = 1; page <= 100; page += 1) {
    const result = await requestPage(path, { ...options, page, limit });
    items.push(...result.items);
    if (!result.hasMore) break;
  }
  return items;
}

async function requestPage(path, options = {}) {
  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.min(Math.max(1, Number(options.limit) || 20), 100);
  const separator = path.includes('?') ? '&' : '?';
  const response = await request(`${path}${separator}page=${page}&limit=${limit}`, {
    ...options,
    withResponse: true
  });
  const items = Array.isArray(response.data) ? response.data : [];
  const totalHeader = Object.entries(response.headers)
    .find(([key]) => key.toLowerCase() === 'x-total-count');
  const hasMoreHeader = Object.entries(response.headers)
    .find(([key]) => key.toLowerCase() === 'x-has-more');
  const totalValue = Number(totalHeader && totalHeader[1]);
  const total = Number.isFinite(totalValue) ? totalValue : null;
  const hasMoreValue = hasMoreHeader && String(hasMoreHeader[1]).toLowerCase();
  return {
    items,
    page,
    total,
    hasMore: hasMoreValue === 'true' || (hasMoreValue !== 'false'
      && hasMorePages((page - 1) * limit + items.length, items.length, limit, total))
  };
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
  const previousToken = (session() || {}).token;
  app.globalData.session = data;
  wx.setStorageSync('session', data);
  if (previousToken !== (data && data.token)) require('./bookingSocket').reset();
}

function clearSession() {
  app.globalData.session = null;
  wx.removeStorageSync('session');
  clearPendingAvatarPreview();
  require('./bookingSocket').reset();
}

async function logout() {
  const pending = request('/auth/logout', { method: 'POST', skipUnauthorized: true });
  clearSession();
  try { await pending; } catch (_) {
    // Local logout remains available offline; server sessions still have an expiry.
  }
}

// 在发起跳转的页面上记下「已为它打开过登录页」。页面再次显示时如果仍未登录，说明用户放弃了登录，
// 页面据此离开而不是再次打开登录页（见 utils/loginGate.js）。
function markLoginRequested(page) {
  if (page && `/${page.route}` !== LOGIN_PAGE) page.loginRequested = true;
}

function currentPage() {
  const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
  return pages[pages.length - 1] || null;
}

function handleUnauthorized(requestToken) {
  const currentSession = session();
  if (currentSession && currentSession.token && currentSession.token !== requestToken) return;
  clearSession();

  const page = currentPage();
  if (navigatingToLogin || (page && `/${page.route}` === LOGIN_PAGE)) return;

  markLoginRequested(page);
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
  markLoginRequested(currentPage());
  wx.navigateTo({ url: LOGIN_PAGE });
  return false;
}

module.exports = {
  userKey,
  clearPendingAvatarPreview,
  clearSession,
  displayImageUrl,
  formatTime,
  hasMorePages,
  jpegThumbnailFallback,
  lastWriteAt,
  mediaUrl,
  logout,
  previewImage,
  request,
  requestAllPages,
  requestPage,
  requireLogin,
  savePendingAvatarPreview,
  saveSession,
  salonImage,
  salonImages,
  session,
  statusText,
  thumbnailUrl,
  uploadFile,
  userAvatarUrl
};
