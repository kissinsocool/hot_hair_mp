# hot_hair_mp

微信小程序用户端前端。用微信开发者工具打开本目录即可。

## 开发配置

接口地址在 `app.js`：

```js
apiBaseUrl: 'https://api.hothaircc.cn/api'
```

当前接口和公共图片均使用已备案域名的 HTTPS 地址。

在微信公众平台的「开发管理 → 开发设置 → 服务器域名」中配置：

- request 合法域名：`https://api.hothaircc.cn`
- socket 合法域名：`wss://api.hothaircc.cn`
- uploadFile 合法域名：`https://hothairapp.oss-cn-beijing.aliyuncs.com`、`https://hothairprivate.oss-cn-beijing.aliyuncs.com`
- downloadFile 合法域名：`https://oss.hothaircc.cn`、`https://oss.hothair.top`、`https://hothairprivate.oss-cn-beijing.aliyuncs.com`

开发者工具中的 `urlCheck: false` 只对本地调试生效，真机预览和正式版本仍需配置上述域名。

## 已做

- 登录 / 注册
- 附近沙龙列表
- 沙龙详情
- 提交预约
- 我的预约 / 取消预约

## 未做

- 微信支付
- 微信一键登录
- 复杂地图选点
