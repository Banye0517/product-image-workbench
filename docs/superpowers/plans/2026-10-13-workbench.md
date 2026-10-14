# 商品图工作台实施计划

**目标：** 按已确认草图完成本地批量出图工作台与Mac分发包。

**架构：** server/store.js负责项目和后台导入，server/render.js负责750图与三图裁切，server/index.js提供受限本地API。shared/model.js负责卡片、文案和安全命名。src/App.jsx负责工作台，src/Card.jsx负责预览与编辑，desktop/main.cjs负责原生选择目录和应用窗口。

**技术栈：** React、Vite、Konva、Sharp、Express、Electron；npm锁定依赖。

- [x] 先在tests/core.test.js和tests/workflow.test.js定义尺寸、重复、保存与导出的真实素材测试，运行npm test确认缺失实现导致失败。
- [x] 实现共享规则、图像裁切、后台导入和原子JSON保存；运行npm test通过。
- [x] 实现本地API：读取列表、导入、草稿、保存、重复选择、Logo、导出任务；检查Origin与Host，导出拒绝路径穿越与重名。
- [x] 实现左侧文件夹、顶部文案、单图卡片、三图拖动裁切、预加载和批量导出；构建npm run build通过。
- [x] 使用独立浏览器页面验证真实交互与性能，截图检查完整名称、状态灯、图片切换、排版和裁切。
- [x] 打包Mac应用并启动检查；记录已验证范围和真实摄影素材尚未测试的限制，更新MEMORY.md。
