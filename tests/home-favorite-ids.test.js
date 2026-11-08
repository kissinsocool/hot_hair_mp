const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const home = fs.readFileSync(path.join(__dirname, '../pages/home/home.js'), 'utf8');

const store = fs.readFileSync(path.join(__dirname, '../utils/favorites.js'), 'utf8');

assert.match(home, /favoriteStore\.loadIds\(\)/);
assert.match(store, /api\.request\('\/favorites\/ids'\)/);
assert.doesNotMatch(home, /favorites\.map\(\(salon\) => salon\.id\)/);
