// 线上问题记录：写入微信「实时日志」，在小程序管理后台「开发 → 开发管理 → 运维中心 → 实时日志」
// 可按用户微信号、时间和页面查询；开发者工具中同时输出到控制台。
// 只记录错误信息、接口路径和状态码，不记录请求参数、token、手机号等用户数据。
// 本模块只依赖 wx，可在 App() 注册前由 app.js 引入。
let manager;

function realtimeLog() {
  if (manager === undefined) {
    manager = (typeof wx !== 'undefined' && wx.getRealtimeLogManager && wx.getRealtimeLogManager()) || null;
  }
  return manager;
}

function write(level, args) {
  const log = realtimeLog();
  try {
    if (log && typeof log[level] === 'function') log[level](...args);
  } catch (_) {}
  const output = console[level] || console.log;
  output.apply(console, args);
}

// 错误对象在实时日志里只保留可读的消息和调用栈。
function describe(error) {
  if (!error) return String(error);
  if (typeof error === 'string') return error;
  return [error.message || error.errMsg || String(error), error.stack].filter(Boolean).join('\n');
}

module.exports = {
  info: (...args) => write('info', args),
  warn: (...args) => write('warn', args),
  error: (...args) => write('error', args),
  describe
};
