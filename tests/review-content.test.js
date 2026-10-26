const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
let definition;
global.Component = value => { definition = value; };
require('../components/review-content/review-content');
delete global.Component;

function create(content = '评价正文') {
  const queries = [];
  const instance = {
    ...definition.methods,
    data: { ...definition.data, content },
    setData(values, callback) { Object.assign(this.data, values); if (callback) callback(); },
    createSelectorQuery() {
      const selectors = [];
      return {
        select(value) { selectors.push(value); return this; },
        boundingClientRect() { return this; },
        exec(callback) {
          assert.deepEqual(selectors, ['.review-content-measure', '.review-content-line']);
          queries.push(callback);
        }
      };
    }
  };
  definition.lifetimes.ready.call(instance);
  return { instance, queries, measure(height, lineHeight = 22) { queries.shift()([{ height }, { height: lineHeight }]); } };
}

test('only comments taller than four rendered lines can expand, including pixel rounding', () => {
  for (const [height, expected] of [[0, false], [22, false], [88, false], [88.5, false], [110, true]]) {
    const page = create('完整的评价正文\n包含换行');
    page.measure(height);
    assert.equal(page.instance.data.canExpand, expected);
    assert.equal(page.instance.data.expanded, false);
    assert.equal(page.instance.data.content, '完整的评价正文\n包含换行');
  }
  const page = create();
  page.measure(110);
  page.instance.toggleExpanded();
  assert.equal(page.instance.data.expanded, true);
  page.instance.toggleExpanded();
  assert.equal(page.instance.data.expanded, false);
  page.instance.toggleExpanded();
  assert.equal(page.instance.data.expanded, true);
  definition.pageLifetimes.resize.call(page.instance);
  page.measure(132);
  assert.equal(page.instance.data.expanded, true);
});

test('new content resets expansion, same content preserves it, and old layout results are ignored', () => {
  const page = create('长评价');
  page.measure(110);
  page.instance.toggleExpanded();
  definition.observers.content.call(page.instance, '长评价');
  assert.equal(page.instance.data.expanded, true);
  page.instance.data.content = '短评价';
  definition.observers.content.call(page.instance, '短评价');
  assert.equal(page.instance.data.expanded, false);
  assert.equal(page.instance.data.canExpand, false);
  const previous = page.queries.shift();
  definition.pageLifetimes.resize.call(page.instance);
  previous([{ height: 110 }, { height: 22 }]);
  assert.equal(page.instance.data.canExpand, false);
  page.measure(22);
  assert.equal(page.instance.data.canExpand, false);
  definition.pageLifetimes.resize.call(page.instance);
  definition.lifetimes.detached.call(page.instance);
  page.instance.setData = () => { throw new Error('must not update a detached component'); };
  page.measure(132);
});

test('both review pages use the shared four-line component with a fade and expand action', () => {
  const root = path.join(__dirname, '..');
  for (const name of ['detail', 'salon-reviews']) {
    const config = JSON.parse(fs.readFileSync(path.join(root, `pages/${name}/${name}.json`), 'utf8'));
    assert.equal(config.usingComponents['review-content'], '/components/review-content/review-content');
    const template = fs.readFileSync(path.join(root, `pages/${name}/${name}.wxml`), 'utf8');
    assert.match(template, /<review-content class="review-comment-content" content="\{\{item\.comment\}\}" \/>/);
  }
  const template = fs.readFileSync(path.join(root, 'components/review-content/review-content.wxml'), 'utf8');
  assert.match(template, /wx:if="\{\{canExpand && !expanded\}\}" class="review-content-fade"/);
  assert.match(template, /wx:if="\{\{canExpand\}\}" class="review-content-expand" bindtap="toggleExpanded"/);
  assert.match(template, /aria-expanded="\{\{expanded\}\}"/);
  assert.match(template, /expanded \? '显示更少' : '显示更多'/);
  assert.match(template, /class="review-content-arrow \{\{expanded \? 'up' : ''\}\}"/);
  const styles = fs.readFileSync(path.join(root, 'components/review-content/review-content.wxss'), 'utf8');
  assert.match(styles, /max-height:\s*176rpx;/);
  assert.doesNotMatch(styles, /line-clamp|text-overflow/);
  assert.match(styles, /background:\s*linear-gradient/);
});
