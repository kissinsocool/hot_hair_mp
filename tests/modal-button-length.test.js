const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// 微信 wx.showModal 的 confirmText / cancelText 最多 4 个汉字，超出时调用失败、回调不执行。
// 单元测试里的弹窗是模拟的，不会报这个错，所以在这里统一检查源码。
const root = path.join(__dirname, '..');
function sources(dir) {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return sources(file);
    return file.endsWith('.js') ? [file] : [];
  });
}
let checked = 0;
for (const file of ['app.js', ...sources('pages'), ...sources('utils'), ...sources('components'), ...sources('custom-tab-bar')]) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  for (const [, key, text] of source.matchAll(/\b(confirmText|cancelText):\s*'([^']*)'/g)) {
    checked += 1;
    assert.ok([...text].length <= 4, `${file}: ${key} 「${text}」超过 4 个字`);
  }
  // 按钮文字必须是字面量，才能在这里检查长度。
  assert.doesNotMatch(source, /\b(confirmText|cancelText):\s*[^'\s]/, `${file}: 弹窗按钮文字请直接写字符串`);
}
assert.ok(checked >= 8);
