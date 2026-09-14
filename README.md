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
- uploadFile 合法域名：`https://hothairmedia.oss-cn-beijing.aliyuncs.com`、`https://hothairapp.oss-cn-beijing.aliyuncs.com`（迁移兼容）、`https://hothairprivate.oss-cn-beijing.aliyuncs.com`
- downloadFile 合法域名：`https://media.hothaircc.cn`、`https://oss.hothaircc.cn`（迁移兼容）、`https://oss.hothair.top`、`https://hothairprivate.oss-cn-beijing.aliyuncs.com`

开发者工具中的 `urlCheck: false` 只对本地调试生效，真机预览和正式版本仍需配置上述域名。

## 已做

- 登录 / 注册
- 附近沙龙列表
- 沙龙详情
- 提交预约
- 我的预约 / 取消预约

## 未做

- 微信支付
- 复杂地图选点

## 预约订阅消息

在微信公众平台选择模板编号 375“预约提醒”一次性订阅模板，字段需与以下配置一致：

- `thing1`：服务项目
- `thing8`：预约门店
- `phrase11`：预约状态
- `time10`：到店时间

然后在服务端环境变量中配置：

```bash
WECHAT_BOOKING_STATUS_TEMPLATE_ID=微信订阅模板ID
# 可选：developer、trial 或 formal，默认 formal
WECHAT_MINIPROGRAM_STATE=formal
```

配置后，用户提交预约时会申请授权，商家接单成功后发送一次微信订阅消息。拒单、取消和改期仍通过小程序站内消息展示。
