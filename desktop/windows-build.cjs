require.resolve('@img/sharp-win32-x64/package');
const fs = require('node:fs');
const path = require('node:path');
fs.accessSync(path.join(__dirname, 'models', 'silueta.onnx'));
const { build } = require('../package.json');
module.exports = {
  ...build,
  directories: { output: 'release/windows' },
  compression: 'maximum',
  electronLanguages: ['zh-CN', 'en-US'],
  files: [
    'dist/**/*', 'server/**/*', 'shared/**/*', 'desktop/main.cjs', 'desktop/lifecycle.cjs', 'package.json',
    '!node_modules/onnxruntime-node/bin/napi-v6/darwin/**',
    '!node_modules/onnxruntime-node/bin/napi-v6/linux/**',
    '!node_modules/onnxruntime-node/bin/napi-v6/win32/arm64/**',
    '!node_modules/onnxruntime-node/bin/napi-v6/win32/x64/DirectML.dll',
    '!node_modules/onnxruntime-node/bin/napi-v6/win32/x64/dxcompiler.dll',
    '!node_modules/onnxruntime-node/bin/napi-v6/win32/x64/dxil.dll',
    '!node_modules/@img/sharp-darwin-*/**', '!node_modules/@img/sharp-libvips-darwin-*/**',
    '!node_modules/@img/sharp-linux*/**', '!node_modules/@img/sharp-libvips-linux*/**',
    '!node_modules/react/**', '!node_modules/react-dom/**', '!node_modules/lucide-react/**', '!node_modules/konva/**',
    '!node_modules/**/*.map'
  ],
  extraResources: [{ from: 'desktop/models', to: 'models', filter: ['silueta.onnx', 'model-manifest.json', 'LICENSE-U2Net.txt', '模型说明.md'] }],
  asarUnpack: [...build.asarUnpack, 'node_modules/onnxruntime-node/bin/napi-v6/win32/x64/**/*'],
  artifactBuildCompleted: async event => {
    if (event.file?.endsWith('.zip') && fs.statSync(event.file).size > 200000000) throw new Error('Windows下载包超过200MB，请继续精简后再交付');
  },
  win: { target: [{ target: 'zip', arch: ['x64'] }], artifactName: 'ProductImageWorkbench-${version}-windows-x64.${ext}' }
};
