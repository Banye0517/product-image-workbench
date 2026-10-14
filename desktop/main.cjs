const { app, BrowserWindow, dialog, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { installShutdown } = require('./lifecycle.cjs');
let instance, window;
app.setName('商品图工作台');
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window) { window.show(); window.focus(); } });
  app.whenReady().then(async () => {
    const { startServer } = await import(pathToFileURL(path.join(__dirname, '..', 'server', 'index.js')).href);
    const { createFastCutout } = await import(pathToFileURL(path.join(__dirname, '..', 'server', 'fast-cutout.js')).href);
    const cutoutProcessor = process.platform === 'win32' ? createFastCutout(app.isPackaged ? path.join(process.resourcesPath, 'models', 'silueta.onnx') : path.join(__dirname, 'models', 'silueta.onnx')) : undefined;
    instance = await startServer({ root: process.env.WORKBENCH_DATA_DIR || app.getPath('userData'), port: 0, cutoutProcessor, cutoutBinary: app.isPackaged ? path.join(process.resourcesPath, 'cutout') : path.join(__dirname, 'bin', 'cutout'), openFolder: async source => { const error = await shell.openPath(source); if (error) throw new Error('无法打开原素材目录'); }, choose: async kind => {
      const result = await dialog.showOpenDialog(window, { title: kind === 'logo' ? '选择透明PNG Logo' : kind === 'output' ? '选择成品保存位置' : '选择产品文件夹或总目录', properties: kind === 'logo' ? ['openFile'] : kind === 'output' ? ['openDirectory', 'createDirectory'] : ['openDirectory', 'multiSelections'], filters: kind === 'logo' ? [{ name: 'Transparent PNG', extensions: ['png'] }] : [] });
      return result.canceled ? [] : result.filePaths;
    } });
    window = new BrowserWindow({ width: 1500, height: 980, minWidth: 1100, minHeight: 720, backgroundColor: '#f7f8fa', title: '商品图工作台', autoHideMenuBar: true, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, spellcheck: false } });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', (event, url) => { if (!url.startsWith(instance.url + '/')) event.preventDefault(); });
    window.webContents.on('will-prevent-unload', event => {
      const choice = dialog.showMessageBoxSync(window, { type: 'warning', title: '还有未完成的工作', message: '仍有草稿未写入或后台任务未完成。', detail: '返回可以继续等待或保存。确认退出会中断当前任务，尚未写入的修改可能丢失。', buttons: ['返回继续处理', '确认退出'], defaultId: 0, cancelId: 0 });
      if (choice === 1) event.preventDefault();
    });
    await window.loadURL(instance.url);
  }).catch(error => dialog.showErrorBox('启动失败', error.message));
  app.on('window-all-closed', () => app.quit());
  installShutdown(app, () => instance);
}
