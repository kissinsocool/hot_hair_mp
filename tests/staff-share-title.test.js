const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { test } = require('node:test');

const filename = path.join(__dirname, '../pages/staff/staff.js');
const localRequire = createRequire(filename);

test('staff shares get the salon name from one staff request and tolerate old server responses', async () => {
  for (const salonName of ['靓丝造型', undefined]) {
    let definition;
    const requests = [];
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
      Page: page => { definition = page; },
      wx: { showToast() { assert.fail('staff display must support old and new responses'); } },
      require: name => name === '../../utils/api' ? {
        thumbnailUrl: url => url,
        request: async url => {
          requests.push(url);
          assert.equal(url, '/staff/staff-1');
          return { name: 'Tony', salonId: 'salon/1', ...(salonName === undefined ? {} : { salonName }), imageUrl: 'https://example.com/tony.jpg' };
        }
      } : localRequire(name)
    }, { filename });
    const page = {
      ...definition, route: 'pages/staff/staff',
      data: { ...definition.data, id: 'staff-1', salonId: 'salon/1' },
      setData(values) { Object.assign(this.data, values); }
    };
    await page.load();
    assert.deepEqual(requests, ['/staff/staff-1']);
    assert.equal(page.data.loading, false);
    assert.equal(page.data.staff.name, 'Tony');
    const shared = page.onShareAppMessage();
    assert.equal(shared.title, salonName ? '靓丝造型  Tony' : 'Tony');
    assert.equal(shared.imageUrl, 'https://example.com/tony.jpg');
  }
});
