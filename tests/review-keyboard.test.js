const assert = require('node:assert/strict');
const { registeredPages } = require('./support/appPages');
const fs = require('node:fs');
const test = require('node:test');
const path = require('node:path');
const root = path.join(__dirname, '..');

test('review editing uses native page scrolling and keyboard positioning without sheet height feedback', () => {
  const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
  assert(registeredPages(app).includes('pages/review-editor/review-editor'));
  const template = fs.readFileSync(path.join(root, 'pages/review-editor/review-editor.wxml'), 'utf8');
  const styles = fs.readFileSync(path.join(root, 'pages/review-editor/review-editor.wxss'), 'utf8');
  const config = JSON.parse(fs.readFileSync(path.join(root, 'pages/review-editor/review-editor.json'), 'utf8'));
  assert.notEqual(config.navigationStyle, 'custom');
  assert.notEqual(config.disableScroll, true);
  assert.match(template, /adjust-position="\{\{true\}\}"/);
  assert.doesNotMatch(template, /<scroll-view|bindfocus|bindblur|bindkeyboardheightchange|\bfixed=/);
  for (const selector of ['editor-card', 'review-textarea']) {
    assert.doesNotMatch(styles.match(new RegExp(`\\.${selector}\\s*\\{[^}]*\\}`))[0], /position:\s*fixed/);
  }
  for (const name of ['orders', 'profile']) {
    const source = fs.readFileSync(path.join(root, `pages/${name}/${name}.js`), 'utf8');
    const template = fs.readFileSync(path.join(root, `pages/${name}/${name}.wxml`), 'utf8');
    assert.doesNotMatch(source + template, /sheetKeyboard|sheetVisible|sheetScrollTarget|<textarea/);
  }
});
