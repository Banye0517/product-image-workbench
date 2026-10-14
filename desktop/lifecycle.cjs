function installShutdown(app, getServer) {
  app.on('will-quit', () => { getServer()?.close(); });
}
module.exports = { installShutdown };
