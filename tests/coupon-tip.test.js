const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const storage = {};
let session = { token: 'token', user: { id: 'user-1' } };
global.getApp = () => ({ globalData: { apiBaseUrl: 'https://example.com/api', mediaBaseUrl: '', get session() { return session; } } });
global.wx = {
  getStorageSync: (key) => (key === 'session' ? session : storage[key]),
  setStorageSync: (key, value) => { storage[key] = value; }
};
let definition;
global.Component = (value) => { definition = value; };
require('../components/coupon-tip/coupon-tip');
delete global.Component;
const api = require('../utils/api');
const couponStore = require('../utils/couponStore');

const coupons = [
  { id: 'small', status: 'available', discountFen: 1000, minimumSpendFen: 0 },
  { id: 'big', status: 'available', discountFen: 3000, minimumSpendFen: 20000 },
  { id: 'used', status: 'used', discountFen: 5000, minimumSpendFen: 0 },
  { id: 'expired', status: 'expired', discountFen: 8000, minimumSpendFen: 0 }
];

// 每个页面（店铺详情、预约）各自挂载一个组件实例。
async function mount() {
  const tip = {
    ...definition.methods,
    data: { ...definition.data },
    setData(values) { Object.assign(this.data, values); }
  };
  await definition.lifetimes.attached.call(tip);
  return tip;
}

async function run() {
  const original = api.request;
  try {
    let response = coupons;
    let requests = 0;
    api.request = async () => { requests += 1; return response; };

    // 展示全部可用券的张数与最高抵扣，不看套餐门槛。
    const detail = await mount();
    assert.deepEqual(
      { visible: detail.data.visible, count: detail.data.count, savingText: detail.data.savingText },
      { visible: true, count: 2, savingText: '¥30' }
    );

    // 短时间内其他页面再次挂载提醒时复用已读取的券，不重复请求。
    const before = requests;
    await mount();
    assert.equal(requests, before);

    // 在一个页面关闭后，其他页面和再次进入都不再显示。
    detail.dismiss();
    assert.equal(detail.data.visible, false);
    assert.equal((await mount()).data.visible, false);
    await definition.pageLifetimes.show.call(detail);
    assert.equal(detail.data.visible, false);

    // 用掉一张券不会重新弹出；收到新券后重新提醒。
    response = coupons.filter((coupon) => coupon.id !== 'small');
    couponStore.invalidate(); // 券变化总伴随写操作或预约推送，这里直接模拟缓存失效
    assert.equal((await mount()).data.visible, false);
    response = [...coupons, { id: 'new', status: 'available', discountFen: 500 }];
    couponStore.invalidate(); // 券变化总伴随写操作或预约推送，这里直接模拟缓存失效
    const withNewCoupon = await mount();
    assert.equal(withNewCoupon.data.visible, true);
    assert.equal(withNewCoupon.data.count, 3);

    // 点击卡片切到「我」页的优惠券列表。
    let switchedTo = '';
    const profile = { route: 'pages/profile/profile', data: {}, setData(values) { Object.assign(this.data, values); } };
    global.getCurrentPages = () => [profile];
    global.wx.switchTab = ({ url, success }) => { switchedTo = url; success(); };
    withNewCoupon.openCoupons();
    assert.equal(switchedTo, '/pages/profile/profile');
    assert.equal(profile.data.activeTab, 'coupons');
    // 查看后与关闭一样，不再提醒。
    assert.equal(withNewCoupon.data.visible, false);
    assert.equal((await mount()).data.visible, false);

    // 关闭记录按账号区分。
    withNewCoupon.dismiss();
    session = { token: 'token-2', user: { id: 'user-2' } };
    assert.equal((await mount()).data.visible, true);

    // 未登录时不请求接口、不显示（店铺详情页可未登录浏览）。
    session = null;
    requests = 0;
    assert.equal((await mount()).data.visible, false);
    assert.equal(requests, 0);
    session = { token: 'token', user: { id: 'user-3' } };

    // 没有可用券或接口失败时不显示。
    response = coupons.filter((coupon) => coupon.status !== 'available');
    couponStore.invalidate(); // 券变化总伴随写操作或预约推送，这里直接模拟缓存失效
    assert.equal((await mount()).data.visible, false);
    api.request = async () => { throw new Error('network'); };
    couponStore.invalidate();
    assert.equal((await mount()).data.visible, false);
  } finally {
    api.request = original;
  }

  const template = fs.readFileSync(path.join(__dirname, '../components/coupon-tip/coupon-tip.wxml'), 'utf8');
  assert.match(template, /您有<text class="coupon-tip-count">\{\{count\}\} 张<\/text>优惠券未使用<\/view>/);
  assert.match(template, /预约时在「确认订单」页选择即可抵扣，最高可省 \{\{savingText\}\}！/);
  // 点卡片进入优惠券列表；点关闭不触发跳转。
  assert.match(template, /class="coupon-tip tip-class"[^>]*bindtap="openCoupons"/);
  assert.match(template, /catchtap="dismiss"/);
  // 首页公告下方、「按分类查找」上方展示。
  const wxml = fs.readFileSync(path.join(__dirname, '../pages/home/home.wxml'), 'utf8');
  assert.match(wxml, /<view class="notice">[\s\S]*<coupon-tip tip-class="home-coupon-tip" \/>\s*<view class="category-finder-title">按分类查找<\/view>/);
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../pages/home/home.json'), 'utf8'));
  assert.equal(config.usingComponents['coupon-tip'], '/components/coupon-tip/coupon-tip');
  for (const page of ['booking', 'detail']) {
    const pageWxml = fs.readFileSync(path.join(__dirname, `../pages/${page}/${page}.wxml`), 'utf8');
    assert.doesNotMatch(pageWxml, /coupon-tip/, page);
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
