# 四项评价评分契约

## 字段与兼容

POST /api/bookings/:id/review 与 PATCH /api/bookings/:id/review 新增可选 `ratings`：

```json
{"rating":4.25,"ratings":{"environment":5,"technique":4,"service":3,"price":5},"comment":"服务体验很好","tags":["善于沟通"],"imageObjects":[]}
```

编辑请求另带原有 `retainedImageUrls`。传 `ratings` 时四项均须为 1–5 的整数，服务端计算平均值作为原有 `rating`，不信任客户端总分。未传 `ratings` 的线上旧请求仍按原规则接受 1–5 整数总分。

旧记录不迁移、不从总分虚构分项。新版编辑旧记录需重新选择四项。旧客户端编辑新记录时以其总分为准，待审核版本清除旧分项，避免总分与分项矛盾；审核前公开版本保持原样。

## 已检索的生产者与消费者

| 仓库 | 位置 | 数据流与影响 |
| --- | --- | --- |
| hot_hair_mp | pages/orders/orders、pages/review-editor/review-editor | 订单跳转独立编辑页，新评价提交四项与均分；投诉使用原有独立接口 |
| hot_hair_mp | pages/profile/profile、pages/review-editor/review-editor | 个人页读取 GET /auth/reviews，编辑页回显并提交分项；总分列表按实际分数填充星星 |
| hot_hair_mp | pages/detail、pages/staff、pages/salon-reviews | 公开评价消费者，继续按 rating 展示总分，已有半星支持 |
| hot_hair_mp | pages/home、pages/favorites、utils/rating | 门店聚合总分消费者，继续使用原聚合契约 |
| hot_hair_service | src/routes/client-bookings.js | 校验、计算均分，写入 review 或 review.pendingEdit |
| hot_hair_service | src/models.js | review 与 pendingEdit 均持久化可选分项 |
| hot_hair_service | src/routes/client.js、src/services/booking.js | 用户评价与订单序列化保留分项，隐藏待审核修改 |
| hot_hair_service | src/routes/admin.js | 审核发布整份 pendingEdit；审核列表继续展示总分 |
| hot_hair_service | src/services/salon.js、salon-reviews.js、routes/public.js、routes/review-helpful.js | 公开评价序列化保留分项；聚合、筛选、有用反馈仍使用原 rating 范围 |
| hot_hair_service | src/routes/merchant*.js | 商家订单读取公开评价，总分契约不变 |
| merchant_app | lib/features/merchant/presentation/merchant_orders_screen.dart、merchant_salon_screen.dart | 订单与动态消费 rating，通过 toString 展示，允许小数；无需改动 |
| merchant_app | lib/features/admin/presentation/pages/admin_reviews_page.dart | 审核消费原列表与总分，忽略新增字段；无需改动 |

## 发布与回滚

1. 先发布后端可选字段与兼容校验，再发布小程序。旧后端不能完整保存四项，也会拒绝小数总分。
2. 无数据库回填、删除或必填字段迁移。保留旧请求支持，不在本次收缩兼容。
3. 回滚先退小程序，后端保持兼容版本。若必须回滚后端，需先确保新版小程序请求已停止；数据库新增字段无需删除。

## 验证

- 小程序测试覆盖独立选择、四项必选、提交均分、编辑回显、旧数据不伪造分项、分数显示和投诉请求。
- 后端单元测试使用真实 Mongoose 子文档验证存储及边界校验。
- MongoDB 集成测试使用线上旧请求结构和新增结构，覆盖创建、持久化、审核、用户列表、公开列表、商家订单、待审核编辑、编辑审核及旧版编辑兼容。

本次本地验证结果：小程序 108 项、后端 208 项、MongoDB 集成 31 项、商家订单与后台相关 Flutter 测试 37 项全部通过。微信开发者工具内置 wcc/wcsc 已编译新增组件及两个页面，JS 语法检查通过。IDE 自动化返回“需要重新登录（code 10）”，未完成模拟器或真机目测；尚未部署后端或发布小程序。

评论卡片统一使用 review-rating-summary：综合分、粉色星星及两列中文分项数字；无分项的旧记录只展示总分。卡片综合星星 36rpx、综合数字 38rpx，分项数字 28rpx，评分选择星星 40rpx（保留 64rpx 触控区域）；店铺、理发师、首页与收藏评分星星同步缩小。新增模板与受影响样式已通过 wcc/wcsc 编译。

## 新增组件的运行包验证（2026-11-03）

真机曾报 `Component is not found in path "components/review-booking-info/review-booking-info"`。本地四个组件文件和页面注册均存在，但真机的 `__wxAppCode__` 没有该组件的 JSON/WXML，Sources 也搜索不到组件 JS。仅清编译缓存后重新真机调试仍复现。

清理文件缓存、关闭并重新打开项目以重建文件索引，再完整编译后，模拟器运行包已包含该组件的 JSON/WXML；在店铺详情注入仅存于模拟器内存的测试评价，实际渲染出套餐、理发师和下方分隔线，调试器错误数为 0。验证后返回首页，测试数据随页面销毁，没有写入后端。保持共用组件、按需加载和现有编译配置。

单独的 wcc/wcsc 编译只能检查模板、样式，不能证明 IDE 真机包已包含新组件。需要在新会话中核对运行包条目，并打开包含评价的卡片验证实际显示。

当前套餐信息布局：时间下方以单行“套餐名称 · 理发师”显示，位于综合评分之前；已取消套餐信息专用分隔线，保留四项评分下方的细灰线。


## 独立评价页面（2026-11-03）

评价晒单、编辑评价和投诉统一进入 `pages/review-editor/review-editor`。沿用项目现有 EventChannel 传递当前订单或评价，不在 URL 中传评价正文与图片。提交成功后返回来源页，由订单页和个人页原有 onShow 刷新数据。

删除两个来源页的底部表单、隐藏 tabBar 逻辑和 sheetKeyboard 工具。原逻辑在 focus 与 keyboardheightchange 中重复移动并滚动原生 textarea，且失焦后的迟到高度事件能够再次抬高弹窗；该事件顺序已用 Node 断言复现。独立页使用普通页面滚动、原生导航栏与 textarea 的 adjust-position，不再手动监听或计算键盘高度。

请求方法、字段、四项必选规则、图片压缩大小限制、上传签名流程、保留原图与审核行为保持原样。回归测试覆盖三种请求体、旧评价回填、编辑失败保留输入、重复提交和来源页跳转。110 项小程序测试及 wcc/wcsc 编译通过。

开发者工具实际加载并渲染了独立页面；用模拟器界面输入文字、依次点击四项星星和标签，运行数据为评分 5/4/3/5、标签“环境舒适”，文字与字数同步更新。验证数据仅存于模拟器内存，未向后台提交，随后已恢复原会话并返回首页。iPhone 软件键盘仍需在新真机调试包中复测；模拟器验证不能替代真机键盘验证。
