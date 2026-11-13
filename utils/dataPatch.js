// 生成只包含变化字段的 setData 参数。
// 列表长度不变时按「列表[下标].字段」路径更新，切换一个选中态不必重传整张列表。
function dataPatch(current, next) {
  const patch = {};
  Object.keys(next).forEach((key) => {
    const before = current[key];
    const after = next[key];
    if (isEqual(before, after)) return;
    if (!isSameLengthObjectList(before, after)) {
      patch[key] = after;
      return;
    }
    after.forEach((item, index) => {
      const previous = before[index];
      if (isEqual(previous, item)) return;
      const fields = Object.keys(item);
      const changed = fields.filter((field) => !isEqual(previous[field], item[field]));
      // setData 不接受 undefined；字段被删除或清空时整项替换。
      if (fields.length !== Object.keys(previous).length || changed.some((field) => item[field] === undefined)) {
        patch[`${key}[${index}]`] = item;
        return;
      }
      changed.forEach((field) => { patch[`${key}[${index}].${field}`] = item[field]; });
    });
  });
  return patch;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isSameLengthObjectList(before, after) {
  return Array.isArray(before) && Array.isArray(after)
    && before.length === after.length
    && before.every(isPlainObject) && after.every(isPlainObject);
}

function isEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => isEqual(item, b[index]));
  }
  if (!isPlainObject(a) || !isPlainObject(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length
    && keys.every((key) => Object.prototype.hasOwnProperty.call(b, key) && isEqual(a[key], b[key]));
}

// 加载更多时向列表末尾追加：只按「列表[下标]」传新增项，已有项不再重传到视图层。
function appendPatch(key, current, items) {
  const offset = Array.isArray(current) ? current.length : 0;
  const patch = {};
  items.forEach((item, index) => { patch[`${key}[${offset + index}]`] = item; });
  return patch;
}

module.exports = { dataPatch, appendPatch };
