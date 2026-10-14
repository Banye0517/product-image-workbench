# 商品图工作台公开仓库与 Mac 版设计说明

## 目标

整理商品图工作台的用途、功能和操作说明；修正并生成当前版本可用的 Apple Silicon Mac 包；将源码与文档上传到用户的公开 GitHub 仓库。

## 当前项目事实

- 工作台使用 React、Electron、Express 与 Sharp，在本机运行，服务只监听 `127.0.0.1`，项目记录和缓存保存在用户目录，不要求账号，也不上传摄影原图。
- 主要用途是整理电商摄影素材，处理重复候选、排选图片、编辑详情页和主图、制作搭配推荐图，并按产品批量导出。
- Windows x64 通过 Silueta ONNX 模型和 ONNX Runtime CPU 本机抠图；macOS 通过 Swift 命令行程序调用 Apple Vision。两端共享编辑与导出流程，但不共享抠图引擎。
- Windows 1.1.5 包已存在；Mac 压缩包仍为 1.1.2。`package.json` 已有 Apple Silicon 打包命令。
- `desktop/bin/cutout` 当前是 arm64 Mach-O，但 `LC_BUILD_VERSION` 的最低系统版本为 macOS 26.0；Swift 源码调用的 Vision 前景分割接口从 macOS 14 起可用，项目说明也标注 macOS 14 起可用。现有编译产物与宣称的系统要求不一致。
- 当前仓库没有 Git 远程，也没有同名 GitHub 项目。用户选择公开仓库；目标名称为 `Banye0517/product-image-workbench`。

## 推荐方案

保持现有共享应用和平台专用抠图实现。仅修复 Mac 原生辅助程序的构建目标、应用最低系统版本声明和打包流程；不引入新的抠图模型，不改动 Windows 引擎，不拆分为两套应用。

新增可重复运行的 Mac 辅助程序编译步骤，明确以 `arm64-apple-macosx14.0` 为目标，并让 `package:mac` 在产出 zip 前执行该步骤。Electron macOS 构建元数据同步声明 macOS 14.0 最低版本。版本维持 1.1.5，产物命名继续表达版本、Apple Silicon 和 Mac 平台。

## 文档结构

- `README.md`：面向首次访问仓库的人，说明用途、适用场景、核心功能、Windows/Mac 功能矩阵、本机隐私边界、下载与开发入口、明确的已知限制。
- `使用说明.md`：按设计师实际工作流程组织，覆盖准备素材、导入与筛选、详情页与主图编辑、搭配推荐、平台抠图、保存和导出，以及常见失败处理；移除重复的版本更新叙述，保留仍然影响实际使用的尺寸、限制与注意事项。
- `docs/Windows使用说明.txt`：保留 Windows 包的解压、启动、运行库和故障处理说明，并与 1.1.5 功能一致。

不改应用 UI，不新增云同步、远程处理或产品功能。README 与使用说明均使用中文，代码、脚本、变量和文件名使用英文。

## GitHub 发布范围

创建公开的 `Banye0517/product-image-workbench` 仓库，推送源码、必要的项目资源和整理后的文档。忽略本地构建产物、模型权重、Windows 运行库安装器、缓存和 `.DS_Store`；不把 ZIP 安装包作为 Git 普通文件提交，也不创建 GitHub Release。

用户批准公开品牌 Logo、主图标、桌面应用图标和 `docs/cutout-test/` 测试样图。公开快照需排除 `docs/frame-01-sample.jpg`、`docs/frame-02-sample.jpg`、`docs/outfit-example.jpg`、`docs/workbench-*.png`、根目录 `MEMORY.md` 与 `docs/验收记录.md`；其中含可识别儿童模特、品牌服饰或个人本机路径。`docs/cutout-test/` 两份计时日志中的本机路径须替换为通用占位文字。由于这些文件存在于本机历史，公开仓库从当前经筛选的源码快照创建无父提交的初始提交，避免旧版本经历史再次公开；本机原 Git 历史保持不变。项目没有根目录许可证；不擅自添加开源许可证。

## 验收标准

1. `npm run package:mac` 会从已跟踪的 Swift 源码重新构建抠图程序，再生成版本 1.1.5 的 Apple Silicon Mac zip。
2. Mac 应用包的原生辅助程序最低系统版本为 macOS 14.0，应用元数据与使用说明相符；Vision 抠图结果为带 alpha 的 PNG。当前同名应用已在本机运行，单实例锁阻止独立包启动，GUI 包启动验收未完成。
3. README 和使用说明准确区分 Windows Silueta 与 macOS Vision，并从项目现有实现提炼用途、功能、流程和限制。
4. 运行 `npm test`、`npm run check`、`npm run build` 通过。Mac 包结构及二进制架构、最低系统版本和透明输出经过本机核对。
5. 公开 GitHub 仓库已建立，源代码和文档推送成功；确认模型权重、安装包、运行库安装器、本机数据和缓存没有进入 Git 历史。

## 未涵盖事项与限制

- Mac 包仅面向 Apple Silicon；Intel Mac 和 Windows 真机兼容性不在本轮验收范围内。
- 当前没有 Apple Developer ID 签名或公证凭据。本轮不签名或公证下载包，文档需准确说明首次启动时由用户通过 Finder 单独确认打开，不要求关闭全局安全功能。
- macOS 14 的实体设备不在当前环境中；最低系统版本通过 Mach-O 与应用元数据检查，本机运行验收使用 macOS 26.6.2。
- 两张抠图样张不能证明所有衣物边缘效果；衣架、夹子等与商品接触的背景仍可能保留。
- 公开快照不会包含未经批准的产品示例照片、界面截图、内存记录或验收记录。
