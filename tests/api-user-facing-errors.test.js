const assert = require('node:assert/strict');

const requests = [];
const uploads = [];
global.getApp = () => ({
  globalData: { apiBaseUrl: 'https://example.com/api', mediaBaseUrl: '', session: null }
});
global.getCurrentPages = () => [];
global.wx = {
  getStorageSync: () => null,
  request(options) { requests.push(options); },
  uploadFile(options) { uploads.push(options); }
};

const api = require('../utils/api');

async function main() {
  const serverFailure = api.request('/salons');
  requests[0].success({ statusCode: 500, data: {} });
  await assert.rejects(serverFailure, (error) => {
    assert.equal(error.message, '服务暂时不可用，请稍后重试');
    assert.doesNotMatch(error.message, /500|status|request:fail/i);
    return true;
  });

  const businessFailure = api.request('/bookings');
  requests[1].success({
    statusCode: 409,
    data: { message: '该时间段已被预约，请重新选择' }
  });
  await assert.rejects(businessFailure, /该时间段已被预约，请重新选择/);

  const networkFailure = api.request('/staff');
  requests[2].fail({ errMsg: 'request:fail network unavailable' });
  await assert.rejects(networkFailure, (error) => {
    assert.equal(error.message, '网络连接失败，请检查网络后重试');
    assert.doesNotMatch(error.message, /request:fail/i);
    return true;
  });

  const uploadFailure = api.uploadFile('https://upload.example.com', '/tmp/image.jpg', {});
  uploads[0].success({ statusCode: 403 });
  await assert.rejects(uploadFailure, (error) => {
    assert.equal(error.message, '图片上传失败，请稍后重试');
    assert.doesNotMatch(error.message, /403/);
    return true;
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
