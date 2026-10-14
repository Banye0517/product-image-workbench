# Windows版本打包计划

目标：提供Windows 10/11的x64解压即用程序。
架构：复用现有Electron、本机服务及页面；Windows构建使用独立配置，不包含macOS抠图二进制。保留透明PNG白底流程。

- [x] 添加独立Windows ZIP构建配置，输出到release/windows，避免影响正在使用的Mac程序。
- [x] Windows抠图请求返回明确的不支持提示。
- [x] 构建前端并交叉打包，检查EXE、字体、Logo、图标及Windows Sharp原生依赖。
- [x] 添加中文使用说明，运行现有测试和检查。说明尚未在Windows真机运行。

交叉打包前需安装锁定的Windows图片依赖：`npm install --no-save --package-lock=false --force @img/sharp-win32-x64@0.34.5`。然后运行`npm run build`和`npx electron-builder --win --x64 --config desktop/windows-build.cjs`。配置在缺少该依赖时直接停止，避免交付不可用图片处理包。
