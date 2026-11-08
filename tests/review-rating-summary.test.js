const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
let definition;
global.Component = options => { definition = options; };
require('../components/review-rating-summary/review-rating-summary');
delete global.Component;

function render(rating, ratings) {
  const instance = { data: {}, setData(values) { Object.assign(this.data, values); } };
  definition.observers['rating, ratings'].call(instance, rating, ratings);
  return instance.data;
}

test('Chinese two-column scores retain independent values and fractional stars match the total', () => {
  const data = render(4.25, { environment: 5, technique: 4, service: 3, price: 5 });
  assert.equal(data.ratingText, '4.25');
  assert.deepEqual(data.stars.map(star => star.fill), [100, 100, 100, 100, 25]);
  assert.deepEqual(data.fields.map(({ label, score }) => [label, score]), [['店内环境', 5], ['接待服务', 3], ['技术·完成效果', 4], ['套餐价格', 5]]);
  assert.deepEqual(render(4, undefined).fields, [], 'legacy reviews show only their actual total');
  assert.deepEqual(render(5, { environment: 5 }).fields, []);
  assert.deepEqual(render(0, null).stars, []);
  assert.equal(render(0, null).ratingText, '暂无评分');
});

test('every review-card page uses the shared rating summary', () => {
  for (const name of ['detail', 'salon-reviews', 'staff', 'profile']) {
    const base = path.join(__dirname, '..', 'pages', name, name);
    assert.equal(JSON.parse(fs.readFileSync(`${base}.json`, 'utf8')).usingComponents['review-rating-summary'], '/components/review-rating-summary/review-rating-summary');
    assert.match(fs.readFileSync(`${base}.wxml`, 'utf8'), /<review-rating-summary rating="\{\{item.rating\}\}" ratings="\{\{item.ratings\}\}" \/>/);
  }
});
