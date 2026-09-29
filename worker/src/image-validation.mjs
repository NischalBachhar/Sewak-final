export const MAX_IMAGE_BYTES = 200000;
export const MAX_IMAGE_DIMENSION = 512;
const fail = () => { throw new Error('Malformed or unsupported profile image. Use a still WebP or JPEG.'); };
// Strict container/frame inspection without paid image transformations or a
// CPU-heavy decoder. Never trusts request MIME, filename or client dimensions.
export function inspectImage(bytes, claimedType) {
  if (!(bytes instanceof Uint8Array) || !bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new Error('Profile images must be at most 200 KB.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (at, n) => String.fromCharCode(...bytes.subarray(at, at + n));
  let width = 0, height = 0, mime = '';
  if (bytes.length >= 20 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') {
    mime = 'image/webp';
    if (view.getUint32(4, true) + 8 !== bytes.length) fail();
    let offset = 12, frames = 0, canvasWidth = 0, canvasHeight = 0;
    while (offset < bytes.length) {
      if (offset + 8 > bytes.length) fail();
      const chunk = ascii(offset, 4), size = view.getUint32(offset + 4, true), start = offset + 8;
      if (size < 1 || start + size > bytes.length) fail();
      if (chunk === 'VP8X') {
        if (offset !== 12 || size !== 10 || (bytes[start] & 0xc3) || bytes[start + 1] || bytes[start + 2] || bytes[start + 3]) fail(); // no animation/reserved bits
        canvasWidth = 1 + bytes[start + 4] + (bytes[start + 5] << 8) + (bytes[start + 6] << 16);
        canvasHeight = 1 + bytes[start + 7] + (bytes[start + 8] << 8) + (bytes[start + 9] << 16);
      } else if (chunk === 'VP8 ') {
        if (size < 12 || bytes[start] & 1 || (bytes[start] >> 1 & 7) > 3 || !(bytes[start] & 16) || ascii(start + 3, 3) !== '\x9d\x01\x2a') fail();
        const partitionSize = (bytes[start] | bytes[start + 1] << 8 | bytes[start + 2] << 16) >>> 5;
        if (partitionSize < 1 || partitionSize + 10 > size) fail();
        width = view.getUint16(start + 6, true) & 0x3fff; height = view.getUint16(start + 8, true) & 0x3fff; frames++;
      } else if (chunk === 'VP8L') {
        if (size < 7 || bytes[start] !== 0x2f || bytes[start + 4] >> 5) fail();
        const bits = view.getUint32(start + 1, true); width = (bits & 0x3fff) + 1; height = (bits >>> 14 & 0x3fff) + 1; frames++;
      } else if (chunk === 'ALPH') {
        if (!canvasWidth || frames || (bytes[start] & 0xc0)) fail();
      } else fail(); // reject EXIF/XMP/ICC, animation and arbitrary attachment chunks
      offset = start + size + (size & 1);
      if (offset > bytes.length || (size & 1 && bytes[offset - 1] !== 0)) fail();
    }
    if (frames !== 1 || (canvasWidth && (canvasWidth !== width || canvasHeight !== height))) fail();
  } else if (bytes.length > 20 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    mime = 'image/jpeg';
    if (bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) fail();
    let offset = 2, scan = false, frame = false, quantization = false, huffman = false;
    while (offset < bytes.length - 2) {
      if (bytes[offset++] !== 0xff) fail();
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xd9) fail();
      if (offset + 2 > bytes.length) fail();
      const size = view.getUint16(offset);
      if (size < 2 || offset + size > bytes.length - 2) fail();
      if ([0xc0,0xc2].includes(marker)) {
        if (frame || size < 11 || bytes[offset + 2] !== 8) fail();
        height = view.getUint16(offset + 3); width = view.getUint16(offset + 5);
        const components = bytes[offset + 7]; if (![1,3].includes(components) || size !== 8 + 3 * components) fail(); frame = true;
      } else if (marker === 0xdb) quantization = true;
      else if (marker === 0xc4) huffman = true;
      else if (marker === 0xda) {
        if (!frame || !quantization || !huffman || size < 6) fail();
        scan = true; offset += size;
        const start = offset;
        while (offset < bytes.length - 2) {
          if (bytes[offset] !== 0xff) { offset++; continue; }
          const next = bytes[offset + 1];
          if (next === 0 || next >= 0xd0 && next <= 0xd7) { offset += 2; continue; }
          break;
        }
        if (offset === start) fail();
        continue;
      } else if (![0xe0,0xee,0xdd].includes(marker)) fail(); // no EXIF, comments or embedded arbitrary files
      offset += size;
    }
    if (!scan || !frame || offset !== bytes.length - 2) fail();
  } else fail();
  if (claimedType !== mime || width < 1 || height < 1 || width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) fail();
  return { mime, width, height, size: bytes.length };
}
