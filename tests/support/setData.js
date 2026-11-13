// 模拟小程序 setData 对「a.b[0].c」路径的支持，供页面测试的 setData 桩使用。
function applyData(data, values) {
  Object.entries(values).forEach(([path, value]) => {
    const segments = path.match(/[^.[\]]+/g);
    const last = segments.pop();
    const target = segments.reduce((node, segment) => node[segment], data);
    target[last] = value;
  });
}

module.exports = { applyData };
