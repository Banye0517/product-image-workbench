# 商品图工作台 Mac 版与公开仓库实施计划

> 执行方式：在当前会话逐项实施。设计批准后，主图双尺寸单向同步已由作者提交为 `6c5173a`。作者随后将版本改为 1.1.6；本次 Mac 包与公开快照均使用该版本。用户选择排除 12 张额外产品示例图和界面截图；GitHub 将从筛选后的当前源码快照创建无父提交的公开 `main`，本机历史保持不变。

**目标：** 整理工作台说明，构建最低系统版本为 macOS 14 的 Apple Silicon 1.1.6 Mac 包，并把本次批准的源码和文档推送到公开 GitHub 仓库。

**架构：** Windows 与 Mac 继续共享 React/Electron 工作台及本地数据层，Windows 使用 Silueta ONNX，macOS 使用 Swift/Apple Vision。Mac 打包前从 Swift 源码构建 arm64 辅助程序并写入 macOS 14 部署目标。

**技术栈：** Node.js、npm、React、Electron、Swift、Apple Vision、Sharp、GitHub CLI。

---

## 文件结构

- 修改 `package.json`：增加 Mac 抠图辅助程序构建命令，声明最低系统版本，并让 `package:mac` 执行该命令。
- 修改 `desktop/bin/cutout`：生成 macOS 14 部署目标的 arm64 可执行文件。
- 新建 `tests/macos-package.test.js`：检查 Mac 打包命令及最低系统配置。
- 修改 `README.md`、`使用说明.md`、`docs/Windows使用说明.txt`：整理产品介绍和实际操作流程。
- 修改 `.gitignore`：排除 `.DS_Store`、本机记忆与验收记录、未批准的产品样图和界面截图，保留现有构建、模型和本机数据排除规则。
- 新建本计划；设计说明在 `docs/superpowers/specs/2026-10-14-public-github-macos-design.md`。

`6c5173a` 已包含 `server/index.js`、`server/store.js`、`shared/main-model.js`、`src/App.jsx`、`src/MainCard.jsx`、`src/main-overlay.js` 与 `tests/main-sync.test.js`。这些源码属于公开快照；本轮不会推送包含未批准素材的原始历史。

## 任务 1：锁定 Mac 辅助程序构建目标

**文件：** 新建 `tests/macos-package.test.js`；修改 `package.json`；生成 `desktop/bin/cutout`。

- [x] **步骤 1：先写配置回归测试**

将以下内容写入 `tests/macos-package.test.js`：

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const packagePath = fileURLToPath(new URL('../package.json', import.meta.url));
const packageConfig = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

test('macOS package pins the app and Vision helper to macOS 14 on Apple Silicon', () => {
  assert.equal(packageConfig.build.mac.minimumSystemVersion, '14.0.0');
  assert.match(packageConfig.scripts['build:mac-cutout'], /swiftc .*arm64-apple-macosx14\.0/);
  assert.match(packageConfig.scripts['package:mac'], /npm run build:mac-cutout/);
});
```

- [x] **步骤 2：运行测试确认配置缺失**

运行 `node --test tests/macos-package.test.js`。预期 FAIL，因当前缺少 macOS 14 最低版本与固定目标的 Swift 构建命令。

- [x] **步骤 3：实现 Mac 构建配置**

在 `package.json` 的 scripts 中加入并更新为：

```json
"build:mac-cutout": "swiftc -target arm64-apple-macosx14.0 -O -o desktop/bin/cutout desktop/cutout.swift",
"package:mac": "npm run build && npm run build:mac-cutout && electron-builder --mac zip --arm64"
```

在 `build.mac` 中加入：

```json
"minimumSystemVersion": "14.0.0"
```

不增加 npm 依赖，不改 Windows 打包命令。

- [x] **步骤 4：验证配置和二进制目标**

运行 `node --test tests/macos-package.test.js`、`npm run build:mac-cutout`、`vtool -show-build desktop/bin/cutout`、`lipo -archs desktop/bin/cutout`。预期测试通过、`minos 14.0`、架构 `arm64`。

## 任务 2：整理产品与安装文档

**文件：** 修改 `README.md`、`使用说明.md`、`docs/Windows使用说明.txt`、`.gitignore`。

- [x] **步骤 1：整理 README**

按以下顺序写中文内容：用途与适用对象；素材整理、重复候选、详情页、主图、搭配推荐等功能；Windows/Mac 功能矩阵；本机存储与网络边界；平台要求和安装入口；开发命令；已知限制。明确 Mac 为 Apple Silicon、macOS 14+，使用 Vision；Windows 为 x64，使用 Silueta。说明 Mac 包未签名/公证、Windows 尚未真机验收。

- [x] **步骤 2：重排完整使用说明**

章节顺序为“准备素材、导入与重复候选、详情页/主图/搭配推荐编辑、本机抠图、保存与导出、故障处理”。保留支持格式、尺寸、Logo/文字/渐变、目录结构、缓存限制、衣架/夹子局限；删除被新版替代的尺寸和重复版本补丁。单独说明 Windows Silueta 与 macOS Vision 的差异、macOS 14 要求及本机处理边界。

- [x] **步骤 3：更新 Windows 1.1.5 说明并忽略 Finder 元数据**

保留完整解压、运行库从微软获取、不静默安装、未做 Windows 真机验证等边界；更新到 1.1.5，补齐搭配推荐与拖动说明。在 `.gitignore` 末尾加入 `.DS_Store`。

- [x] **步骤 4：检查文档差异**

运行 `git diff --check`，再搜索旧文案：

```bash
rg -n '1\.0\.0-arm64|Windows 1\.1\.[234]|macOS 26|750×1200|旧750缓存' README.md 使用说明.md docs/Windows使用说明.txt
```

逐条确认命中内容确实属于历史记录或需删除的过期说明，不把旧性能数据写成当前保证。

## 任务 3：测试、打包和 Mac 本机验收

**产物：** `release/商品图工作台-1.1.6-arm64-mac.zip`。

- [x] **步骤 1：运行检查**

运行 `npm test`、`npm run check`、`npm run build`。预期全部通过；主图双尺寸单向同步已由作者提交，并包含在当前源码中。

- [x] **步骤 2：生成 Mac zip**

运行 `npm run package:mac`。预期得到版本 1.1.6 的 Apple Silicon 包。

- [x] **步骤 3：核对包内元数据**

将 zip 解压到临时目录。用 `plutil -p` 检查 `.app/Contents/Info.plist` 的 `LSMinimumSystemVersion` 为 `14.0.0`；对 `.app/Contents/Resources/cutout` 执行 `vtool -show-build` 和 `lipo -archs`，预期最低版本 14.0、架构 arm64。

- [x] **步骤 4：检查 Vision 的透明输出**

以只读的 `docs/cutout-test/top.png` 为输入，将输出写入临时目录，运行 `desktop/bin/cutout <input> <output>`。用 Sharp 检查输出是带 alpha 的 PNG。清理本次创建的临时文件。

- [ ] **步骤 5：启动应用验收**（当前已有同一工作台进程，单实例锁阻止独立包启动；未关闭用户进程）

启动打包 `.app`，确认主界面可见且没有启动错误；使用临时工作数据目录，不导入或修改用户真实素材；只关闭本轮启动的实例。

## 任务 4：创建公开 GitHub 仓库并推送指定提交

**远程：** `https://github.com/Banye0517/product-image-workbench`；公开仓库与初始筛选快照已创建，远程分支 `main`。本次只从筛选后的公开工作树推送版本更新，不推送当前开发分支或其历史。

- [x] **步骤 1：核对暂存清单**

公开快照包含源代码、设计/计划文档、Mac 构建配置和二进制、README、使用说明、Windows 说明、`.gitignore`、Mac 配置测试、用户批准的品牌/图标/抠图测试素材。排除 12 张未批准图片、`MEMORY.md`、`docs/验收记录.md`，并脱敏两份抠图测试日志中的本机路径。确认模型权重、VC++ 安装器、`node_modules`、`dist`、`release` ZIP 与本机数据目录不进入公开树或历史。主图双尺寸同步源码包含在快照中。

- [x] **步骤 2：提交本次文件**

将 1.1.6 版本号、设计说明与计划同步到筛选后的公开工作树，运行 `git diff --cached --check` 和 `git status --short` 后创建更新提交 `96213ff`。不得从包含未批准素材历史的开发分支推送。

```bash
git commit -m "chore: publish 1.1.6 macOS package metadata"
```

- [x] **步骤 3：创建公开仓库并配置远程**

已创建并核实为公开仓库；筛选后的快照使用远程 `origin`。

不添加许可证、不上传 ZIP、不创建 GitHub Release。公开 `main` 从筛选后的文件树创建为新的初始提交，不上传本机历史。

- [x] **步骤 4：推送并核验远程**

已将更新提交推送到 `main`，并核实仓库为公开。公开历史从筛选快照的单一根提交开始，不含未批准产品照片与界面截图。

```bash
git push origin main
gh repo view Banye0517/product-image-workbench --json nameWithOwner,visibility,url
git ls-remote origin refs/heads/main
```

预期：远程可访问且为 `PUBLIC`；远程 `main` 的单一根提交包含当前批准的源码、文档和资源，不含原始父提交、未批准素材或私人记录。

## 计划自检

- 覆盖设计说明中的 Mac 部署目标、文档整理、本机验证和公开 GitHub 上传。
- 当前主图双尺寸单向同步已包含于源码快照及 Mac 包。
- macOS 14 实机与 Windows 实机不可用；Mac GUI 包单独启动也受当前同名单实例进程限制，故以 Mach-O/应用元数据检查及 Vision 原生透明输出验证。
- 不新增依赖、许可证、云服务或 GitHub Release。
