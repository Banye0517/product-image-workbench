import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { installShutdown } = require('../desktop/lifecycle.cjs');

test('canceled desktop quit keeps the server alive until will-quit', () => {
  const app = new EventEmitter(); let closed = false;
  installShutdown(app, () => ({ close() { closed = true; } }));
  app.emit('before-quit');
  assert.equal(closed, false);
  app.emit('will-quit');
  assert.equal(closed, true);
});
