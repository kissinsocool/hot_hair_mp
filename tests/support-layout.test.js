const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const globalStyles = fs.readFileSync(path.join(root, 'app.wxss'), 'utf8');
const supportStyles = fs.readFileSync(path.join(root, 'pages', 'support', 'support.wxss'), 'utf8');

assert.match(supportStyles, /\.problem-input,\s*\.contact-input\s*\{[^}]*width:\s*100%;/s);
assert.match(supportStyles, /\.problem-input\s*\{[^}]*padding:\s*24rpx;/s);
assert.match(globalStyles, /view,\s*text,\s*image,\s*button,\s*input,\s*textarea\s*\{[^}]*box-sizing:\s*border-box;/s);
