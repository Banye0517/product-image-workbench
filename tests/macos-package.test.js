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
  assert.match(packageConfig.scripts['package:mac'], /electron-builder --mac zip --arm64/);
  assert.ok(packageConfig.build.extraResources.some(resource => resource.from === 'desktop/bin/cutout' && resource.to === 'cutout'));
});
