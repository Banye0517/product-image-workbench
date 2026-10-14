import sharp from 'sharp';
import fs from 'node:fs/promises';

export function createFastCutout(modelPath, { loadSession, platform = process.platform } = {}) {
  let sessionPromise;
  const session = async () => {
    if (!sessionPromise) sessionPromise = (async () => {
      if (loadSession) return loadSession();
      await fs.access(modelPath).catch(() => { throw new Error('快速抠图模型缺失，请使用包含抠图模型的完整版'); });
      const ort = await import('onnxruntime-node');
      return ort.InferenceSession.create(modelPath, { executionProviders: ['cpu'], intraOpNumThreads: 2, interOpNumThreads: 1, graphOptimizationLevel: 'all' });
    })().catch(error => {
      sessionPromise = undefined;
      if (platform === 'win32' && (error.code === 'ERR_DLOPEN_FAILED' || /DLL|LoadLibrary|specified module|dynamic link/i.test(error.message))) throw new Error('快速抠图组件无法加载。请完整解压工作台，并从微软官网安装Visual C++ x64运行库后重启工作台：https://aka.ms/vc14/vc_redist.x64.exe');
      throw error;
    });
    return sessionPromise;
  };
  return async (source, output) => {
    const engine = await session();
    const { data: pixels, info } = await sharp(source, { limitInputPixels: 160000000 }).autoOrient().resize({ width: 1200, withoutEnlargement: true }).toColourspace('srgb').removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const input = await sharp(pixels, { raw: { width: info.width, height: info.height, channels: 3 } }).resize(320, 320, { fit: 'fill', kernel: 'lanczos3' }).raw().toBuffer();
    const size = 320 * 320, data = new Float32Array(size * 3), mean = [.485, .456, .406], std = [.229, .224, .225];
    let max = 1;
    for (const value of input) max = Math.max(max, value);
    for (let i = 0; i < size; i++) for (let c = 0; c < 3; c++) data[c * size + i] = (input[i * 3 + c] / max - mean[c]) / std[c];
    const tensor = loadSession ? { data, dims: [1, 3, 320, 320] } : new (await import('onnxruntime-node')).Tensor('float32', data, [1, 3, 320, 320]);
    const predictions = await engine.run({ [engine.inputNames[0]]: tensor });
    const prediction = predictions[engine.outputNames[0]];
    if (!prediction || prediction.data.length < size) throw new Error('快速抠图模型输出不合法');
    const values = prediction.data.subarray(0, size);
    let min = Infinity, peak = -Infinity;
    for (const value of values) { min = Math.min(min, value); peak = Math.max(peak, value); }
    if (!Number.isFinite(min) || !Number.isFinite(peak) || peak - min < 1e-8) throw new Error('无法识别商品轮廓，请换一张照片');
    const mask = Buffer.from(Uint8Array.from(values, value => Math.max(0, Math.min(255, Math.floor((value - min) / (peak - min) * 255)))));
    const alpha = await sharp(mask, { raw: { width: 320, height: 320, channels: 1 } }).resize(info.width, info.height, { fit: 'fill', kernel: 'lanczos3' }).greyscale().raw().toBuffer();
    const rgba = Buffer.alloc(info.width * info.height * 4);
    for (let i = 0; i < alpha.length; i++) { pixels.copy(rgba, i * 4, i * 3, i * 3 + 3); rgba[i * 4 + 3] = alpha[i]; }
    await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } }).png({ compressionLevel: 3 }).toFile(output);
  };
}
