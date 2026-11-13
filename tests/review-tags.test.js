const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildReviewTags, selectedReviewTags, toggleReviewTag } = require('../pages/review-editor/reviewTags');

for (const file of ['pages/review-editor/review-editor.js']) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  // 只有评价编辑页使用，放在它的分包内，避免主包里出现主包未使用的 JS。
  assert.match(source, /require\(['"]\.\/reviewTags\.js['"]\)/);
}

let tags = buildReviewTags(['环境舒适']);
assert.deepEqual(tags.map((tag) => tag.name), [
  '守时商家',
  '善于沟通',
  '环境舒适',
  '技术一流',
  '服务周到',
  '无推销',
  '效果好评',
  '接待热情',
]);
assert.deepEqual(selectedReviewTags(tags), ['环境舒适']);

tags = toggleReviewTag(tags, '技术一流');
assert.deepEqual(selectedReviewTags(tags), ['环境舒适', '技术一流']);

tags = toggleReviewTag(tags, '环境舒适');
assert.deepEqual(selectedReviewTags(tags), ['技术一流']);

tags = buildReviewTags(['接待热情']);
assert.deepEqual(selectedReviewTags(tags), ['接待热情']);
tags = toggleReviewTag(tags, '接待热情');
assert.deepEqual(selectedReviewTags(tags), []);

tags = toggleReviewTag(tags, '守时商家');
assert.deepEqual(selectedReviewTags(tags), ['守时商家']);
tags = buildReviewTags(selectedReviewTags(tags));
assert.deepEqual(selectedReviewTags(tags), ['守时商家']);
tags = toggleReviewTag(tags, '守时商家');
assert.deepEqual(selectedReviewTags(tags), []);
