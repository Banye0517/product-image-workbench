export async function api(route, body) {
  const response = await fetch('/api' + route, body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '操作失败');
  return result;
}
const cache = new Map();
export function loadImage(url) {
  if (!url.includes('?')) url += '?v=2';
  if (!cache.has(url)) {
    const promise = new Promise((resolve, reject) => { const img = new Image(); img.onload = async () => { await img.decode().catch(() => {}); resolve(img); }; img.onerror = () => { cache.delete(url); reject(new Error('图片加载失败')); }; img.src = url; });
    cache.set(url, promise);
    if (cache.size > 80) cache.delete(cache.keys().next().value);
  }
  return cache.get(url);
}
export const imageUrl = (id, thumb = false) => `/media/${id}${thumb ? '-thumb' : ''}.jpg?v=2`;
