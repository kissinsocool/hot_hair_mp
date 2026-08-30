const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildReviewTags, selectedReviewTags, toggleReviewTag } = require('../utils/reviewTags');

for (const file of ['pages/orders/orders.js', 'pages/profile/profile.js']) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  assert.match(source, /require\(['"]\.\.\/\.\.\/utils\/reviewTags\.js['"]\)/);
}

let tags = buildReviewTags(['环境舒适']);
assert.deepEqual(selectedReviewTags(tags), ['环境舒适']);

tags = toggleReviewTag(tags, '技术一流');
assert.deepEqual(selectedReviewTags(tags), ['环境舒适', '技术一流']);

tags = toggleReviewTag(tags, '环境舒适');
assert.deepEqual(selectedReviewTags(tags), ['技术一流']);
