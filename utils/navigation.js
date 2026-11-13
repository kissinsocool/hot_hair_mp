// 小程序页面栈最多 10 层。店铺详情、理发师、店铺动态之间可以互相跳转、层层叠加，
// 栈满时 navigateTo 会失败且没有任何反馈；此时改为替换当前页，保证点击始终能打开目标页。
function navigateTo(url) {
  wx.navigateTo({
    url,
    fail(err) {
      if (/limit exceed/i.test((err && err.errMsg) || '')) wx.redirectTo({ url });
    }
  });
}

module.exports = { navigateTo };
