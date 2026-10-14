# 商品图工作台

面向电商设计师的本机图片整理与批量出图工具。导入摄影素材后，可挑选照片、排版文案与品牌元素，并批量输出商品详情图和主图。项目基于 Electron，照片、草稿、缓存和抠图结果保存在本机，不需要图片云服务或 AI 账号。

## 功能

- 按产品文件夹导入图片，生成工作缓存并提供重复图片候选；确认排除可恢复，原图不会被删除或覆盖。
- 编辑详情页单图、三图组合和搭配推荐图；支持图片裁切、文字、Logo、图标、背景色与渐变。
- 编辑 800×800 与 750×1000 两种主图；800 方图的修改按字段向竖版单向同步，竖版也可独立微调。
- 批量保存和导出，按产品名称归档；同名输出自动顺延，不覆盖已有文件。
- 在本机抠图并预览结果；可以弃用结果，透明 PNG 可直接使用。

## 平台与抠图引擎

| 平台 | 支持范围 | 本机抠图实现 | 当前限制 |
| --- | --- | --- | --- |
| Windows | x64，Windows 10/11 | Silueta ONNX 快速模型 | 需要完整解压；部分电脑需安装 Microsoft Visual C++ x64 运行库。此构建尚未在 Windows 真机验收。 |
| macOS | Apple Silicon，macOS 14 或更新版本 | Swift 辅助程序调用 Apple Vision | 当前包未签名和公证；Intel Mac 不在支持范围。 |

两种系统共用界面和编辑流程，但抠图程序不同。抠图在本机运行，照片不会为此上传。抠图用于去除背景，不会补画衣物；与商品连在一起的衣架、夹子等可能保留。

## 使用

本仓库提供源码和说明，不托管预编译安装包。Mac 用户可按下方命令自行构建；Windows x64 发布包需从单独分发的 ZIP 获取。详细的导入、编辑、抠图和导出步骤见[使用说明](使用说明.md)。macOS 首次打开可能显示安全提示；只对本应用按 Apple 的说明处理：[在 Mac 上安全地打开应用](https://support.apple.com/en-hk/102445)。

## 本机数据与边界

- 服务仅监听本机回环地址；素材和项目记录保存在当前系统用户的数据目录。
- 原始照片只读；请把成品导出到原素材目录之外。
- 这是单机工具，不包含云同步、团队共享或 PSD 分层编辑。
- 清晰度受原图尺寸和画质影响；HEIC 等格式能否读取取决于内置解码能力。PSD 与相机 RAW 请先转换为 JPG 或 TIFF。
- 默认品牌 Logo 与图标、说明中的测试样图会随公开源码仓库提供。
- 产品示例照片和界面截图不包含在公开仓库中。
- 当前仓库没有附加开源许可证；如需允许他人复用代码，应由作者另行选择许可证。

## 开发

需要 Node.js 22、npm；构建 Mac 版还需要 Apple Silicon Mac 和 Swift 工具链。

```sh
npm ci
npm test
npm run check
npm run build
```

启动桌面应用：

```sh
npm run desktop
```

Mac Apple Silicon 压缩包：

```sh
npm run package:mac
```

该命令会从 `desktop/cutout.swift` 构建目标为 macOS 14 的 Vision 辅助程序，再生成 arm64 应用压缩包。Windows x64 使用独立的 Silueta 模型和 `desktop/windows-build.cjs` 打包配置；构建前需准备未随仓库提供的模型权重。

预览网页可分别运行 `npm run server` 和 `npm run dev`。服务端默认监听 `127.0.0.1`。需要隔离开发数据时，可设置 `WORKBENCH_DATA_DIR` 指向单独目录。

## 主要目录

- `src/`：桌面界面与画布编辑。
- `server/`：本地导入、项目数据、抠图请求和图片导出。
- `shared/`：卡片与主图数据结构。
- `desktop/cutout.swift`：macOS Vision 抠图辅助程序源码。
- `server/fast-cutout.js`、`desktop/windows-build.cjs`、`desktop/models/`：Windows Silueta 推理与打包配置；模型权重文件不随源码仓库分发。
- `tests/`：工作流、导出和平台打包配置检查。

## 依赖

[React](https://github.com/facebook/react)、[Electron](https://github.com/electron/electron)、[Sharp](https://github.com/lovell/sharp)、[Konva](https://github.com/konvajs/konva)。依赖版本以 `package-lock.json` 为准。
