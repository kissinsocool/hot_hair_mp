const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pageDir = path.join(__dirname, '..', 'pages', 'orders');
const template = fs.readFileSync(path.join(pageDir, 'orders.wxml'), 'utf8');
const styles = fs.readFileSync(path.join(pageDir, 'orders.wxss'), 'utf8');

const actionsRule = styles.match(/\.actions\s*\{([^}]*)\}/s)?.[1] || '';
const buttonRule = styles.match(/\.cancel\s*\{([^}]*)\}/s)?.[1] || '';

assert.match(template, /wx:if="\{\{item\.canRebook\}\}"[^>]*>再次预约<\/button>[\s\S]*wx:if="\{\{item\.canReview\}\}"[\s\S]*wx:if="\{\{item\.canComplain\}\}"/);
assert.match(actionsRule, /flex-wrap:\s*nowrap;/, 'order actions must stay on one row');
assert.match(buttonRule, /flex:\s*1\s+1\s+0;/, 'order buttons must share the available width');
assert.match(buttonRule, /min-width:\s*0;/, 'order buttons must be allowed to shrink for three-button orders');
