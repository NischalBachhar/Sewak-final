import { apiRequest, notifyDataChanged } from './apiClient';
import { stripImageMetadata } from './profileImageMetadata.mjs';

export async function compressProfileImage(file) {
  if (!['image/jpeg','image/webp','image/png'].includes(file.type)) throw new Error('Choose a JPEG, WebP or PNG profile photo.');
  if (!file.size || file.size > 10 * 1024 * 1024) throw new Error('Choose a photo smaller than 10 MB.');
  let bitmap;
  try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { throw new Error('This image could not be read. Try a different photo.'); }
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 40000000) throw new Error('The source photo dimensions are too large.');
    const scale = Math.min(1, 512 / bitmap.width, 512 / bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Your browser could not process this photo.');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    for (const type of ['image/webp','image/jpeg']) {
      for (const quality of [0.86,0.76,0.66,0.56,0.46]) {
        const blob = await new Promise((resolve) => canvas.toBlob(resolve,type,quality));
        if (!blob || blob.type !== type) break;
        const clean = new Blob([stripImageMetadata(new Uint8Array(await blob.arrayBuffer()),type)],{type});
        if (clean.size <= 150000 || (quality === 0.46 && clean.size <= 200000)) return clean;
      }
    }
    throw new Error('This photo could not be compressed below 200 KB. Choose a simpler photo.');
  } finally { bitmap.close(); }
}
export async function uploadProfileImage(uid, file) {
  const image = await compressProfileImage(file);
  const result = await apiRequest(`/api/profiles/${encodeURIComponent(uid)}/image`, { method: 'PUT', headers: { 'Content-Type': image.type }, body: image });
  notifyDataChanged();
  return result;
}
