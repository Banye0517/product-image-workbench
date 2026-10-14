# 直接拖动与中心吸附实施计划
目标：免模式切换编辑，临时辅助线吸附，不影响导出。
架构：共享纯几何snapRect/snapCrop，DOM捕获阶段识别Konva元素，否则事件落到照片。拖动过程中更新现有节点，松手才写元素模型。辅助线独立编辑层，不保存。
技术：现有React、Konva和Node测试；不添加依赖。
- [x] 新建tests/alignment.test.js：验证screen阈值、中心与Alt、照片独立框；先运行失败。
- [x] 新建shared/alignment.js、src/editor-drag.js与AlignmentGuides.jsx，供所有照片/文字/Logo复用。
- [x] 修改Card/PhotoSlot与MainCard/overlay：移除模式按钮，指针捕获分流、双击改字；标题位置保存导出。
- [x] 修改样式，悬停/聚焦显示选图与缩放，触屏保留；不遮挡固定CTA。
- [x] Node测试、ESLint、构建与独立浏览器拖动/吸附/编辑/导出验收；审查修复后保存用户编辑重启。
- [x] 检查Windows包内容并调整精简配置；本轮不打包，不宣称最终体积通过。
