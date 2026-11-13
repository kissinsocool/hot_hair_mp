const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// 对应开发者工具代码质量检查「主包内不应存在主包未使用的 JS 文件」：
// 从 app.js、主包页面、自定义 tabBar 出发沿 require 和 usingComponents 收集主包用到的 JS，
// 主包目录下的其他 JS（只被分包使用或完全没用到）应放进使用它的分包或删除。
const root = path.join(__dirname, '..');
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
const subRoots = (app.subPackages || []).map((pkg) => pkg.root);
const IGNORED = ['tests/', 'docs/', 'node_modules/', '.git/'];
const used = new Set();
const visited = new Set();

const rel = (file) => path.relative(root, file).split(path.sep).join('/');

function visitJs(file) {
  if (used.has(file) || !fs.existsSync(path.join(root, file))) return;
  used.add(file);
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  for (const [, target] of source.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    if (!target.startsWith('.')) continue;
    let resolved = rel(path.resolve(root, path.dirname(file), target));
    if (!resolved.endsWith('.js')) resolved += '.js';
    visitJs(resolved);
  }
}

function visitComponent(base) {
  if (visited.has(base)) return;
  visited.add(base);
  visitJs(`${base}.js`);
  const config = path.join(root, `${base}.json`);
  if (!fs.existsSync(config)) return;
  for (const target of Object.values(JSON.parse(fs.readFileSync(config, 'utf8')).usingComponents || {})) {
    if (target.startsWith('plugin://')) continue;
    visitComponent(target.startsWith('/') ? target.slice(1) : rel(path.resolve(root, path.dirname(base), target)));
  }
}

visitJs('app.js');
app.pages.forEach(visitComponent);
if (app.tabBar && app.tabBar.custom) visitComponent('custom-tab-bar/index');

function mainPackageJs(dir = root) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    const file = rel(full);
    if (IGNORED.some((prefix) => `${file}/`.startsWith(prefix) || file.startsWith(prefix))) return [];
    if (subRoots.some((subRoot) => file === subRoot || file.startsWith(`${subRoot}/`))) return [];
    if (entry.isDirectory()) return mainPackageJs(full);
    return file.endsWith('.js') ? [file] : [];
  });
}

const unused = mainPackageJs().filter((file) => !used.has(file));
assert.deepEqual(unused, [], `主包未使用的 JS：\n${unused.join('\n')}`);
