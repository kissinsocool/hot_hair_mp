const api = require('./api');
const bookingSocket = require('./bookingSocket');

// 页面返回时是否需要重新读取：与收藏 ID、未读数的短期缓存保持同样的时长。
const FRESH_MS = 30 * 1000;

function currentToken() {
  const session = api.session();
  return (session && session.token) || '';
}

// 在发起读取前调用，读取成功后由页面保存。
function stamp() {
  return { token: currentToken(), startedAt: Date.now() };
}

// 同一账号在短时间内、且读取开始之后本端没有写操作、也没有收到预约推送时，
// 页面上已有的数据仍然有效，返回页面时不必重新请求。
function isFresh(value) {
  return Boolean(value)
    && value.token === currentToken()
    && Date.now() - value.startedAt < FRESH_MS
    && value.startedAt >= api.lastWriteAt()
    && value.startedAt >= bookingSocket.lastEventAt();
}

module.exports = { stamp, isFresh, FRESH_MS };
