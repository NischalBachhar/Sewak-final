import { stripImageMetadata } from './profileImageMetadata.mjs';
export const VERIFICATION_IMAGE_LIMIT = 500000;
export async function compressVerificationImage(file) {
  if (!['image/jpeg','image/webp','image/png'].includes(file.type)) throw new Error('Choose a JPEG, WebP or PNG photo. PDFs are not supported.');
  if (!file.size || file.size > 10000000) throw new Error('The original photo must be at most 10 MB (10,000,000 bytes).');
  let bitmap;
  try { bitmap = await createImageBitmap(file, {imageOrientation:'from-image'}); }
  catch { throw new Error('This image could not be read. Choose another photo.'); }
  try {
    if (Math.min(bitmap.width,bitmap.height)<600 || bitmap.width*bitmap.height>40000000) throw new Error('Use a clear document photo, at least 600 pixels on each side and at most 40 megapixels.');
    // Prefer readable text over squeezing a poor source into the byte limit.
    // No OCR claims: the owner must inspect the final preview before uploading.
    for (const edge of [2800,2400,2000,1600]) {
      const scale=Math.min(1,edge/Math.max(bitmap.width,bitmap.height));
      const canvas=document.createElement('canvas');
      canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
      if(Math.min(canvas.width,canvas.height)<600)continue;
      const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Your browser could not process the image.');
      ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
      for(const type of ['image/webp','image/jpeg']) for(const quality of [0.92,0.86,0.80,0.74]) {
        const blob=await new Promise(resolve=>canvas.toBlob(resolve,type,quality));
        if(!blob||blob.type!==type)continue;
        const clean=new Blob([stripImageMetadata(new Uint8Array(await blob.arrayBuffer()),type)],{type});
        if(clean.size<=VERIFICATION_IMAGE_LIMIT)return clean;
      }
    }
    throw new Error('This document cannot fit within 500 KB while keeping sufficient detail. Retake it with even lighting, cropped to the document.');
  } finally {bitmap.close();}
}
