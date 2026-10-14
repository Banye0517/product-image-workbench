# Windows快速抠图接入计划

采用Silueta ONNX与官方onnxruntime-node Windows x64 CPU支持，复用Sharp处理1200px工作缓存。不让同事安装Python，不上传照片，不做商品补画。

- 实现server/fast-cutout.js：单进程复用一次模型会话，2个CPU线程，320×320推理，输出原工作缓存尺寸的透明PNG。
- 用假推理验证归一化、透明蒙版和RGB像素保留；用真实商品照片验证真实Node推理耗时与效果。
- 后端注入抠图处理器，Windows桌面入口启用Silueta，Mac保留既有Vision。
- Windows构建配置加入模型资源及原生库解包，不生成安装包；补缺模型构建检查及中文说明。
- 回归API job缓存复用及透明导出，运行全部测试和构建。Windows真机验收仍为明确限制。
