// app.json 中注册的全部页面路径（主包 + 分包）。
function registeredPages(app) {
  return [
    ...(app.pages || []),
    ...(app.subPackages || []).flatMap((pkg) => pkg.pages.map((page) => `${pkg.root}/${page}`))
  ];
}

module.exports = { registeredPages };
