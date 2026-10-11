const assert = require('node:assert/strict');

global.getApp = () => ({
  globalData: {
    apiBaseUrl: 'https://api.hothaircc.cn/api',
    mediaBaseUrl: 'https://media.hothaircc.cn'
  }
});
let storedPreview = null;
const removedFiles = [];
global.wx = {
  getStorageSync(key) { return key === 'pendingAvatarPreview' ? storedPreview : null; },
  setStorageSync(key, value) { if (key === 'pendingAvatarPreview') storedPreview = value; },
  removeStorageSync(key) { if (key === 'pendingAvatarPreview') storedPreview = null; },
  getFileSystemManager() { return { accessSync() {} }; },
  removeSavedFile({ filePath }) { removedFiles.push(filePath); },
  saveFile({ success }) { success({ savedFilePath: 'wxfile://saved/pending.jpg' }); }
};

const api = require('../utils/api');

assert.equal(
  api.mediaUrl('https://hothairmedia.oss-cn-beijing.aliyuncs.com/uploads/new.jpg'),
  'https://media.hothaircc.cn/uploads/new.jpg'
);
assert.equal(
  api.mediaUrl('https://hothairapp.oss-cn-beijing.aliyuncs.com/uploads/legacy.jpg'),
  'https://media.hothaircc.cn/uploads/legacy.jpg'
);

assert.equal(api.userAvatarUrl({
  id: 'user-1',
  avatarUrl: 'https://oss.hothaircc.cn/uploads/approved.jpg',
  pendingAvatarUrl: 'https://hothairprivate.example/pending.jpg',
  avatarReviewStatus: 'pending'
}), 'https://oss.hothaircc.cn/uploads/approved.jpg');

api.savePendingAvatarPreview('/tmp/avatar.jpg', { id: 'user-1' });
assert.deepEqual(storedPreview, { userKey: 'user-1', filePath: 'wxfile://saved/pending.jpg' });
assert.equal(api.userAvatarUrl({
  id: 'user-1',
  avatarUrl: 'https://oss.hothaircc.cn/uploads/approved.jpg',
  pendingAvatarUrl: 'https://hothairprivate.example/pending.jpg',
  avatarReviewStatus: 'pending'
}), 'wxfile://saved/pending.jpg');

assert.equal(api.userAvatarUrl({
  id: 'user-1',
  avatarUrl: 'https://oss.hothaircc.cn/uploads/approved.jpg',
  pendingAvatarUrl: 'https://hothairprivate.example/rejected.jpg',
  avatarReviewStatus: 'rejected'
}), 'https://oss.hothaircc.cn/uploads/approved.jpg');
assert.equal(storedPreview, null);
assert.deepEqual(removedFiles, ['wxfile://saved/pending.jpg']);
