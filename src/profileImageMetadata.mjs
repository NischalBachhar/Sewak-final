// Canvas implementations can add ICC metadata. Keep the re-encoded image/frame
// bytes, remove metadata, and update the container length/feature flags.
// Pure binary processing: no data URLs or base64 persistence.
export function stripImageMetadata(bytes, mime) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const invalid = () => { throw new Error('The browser produced an invalid photo. Try another image.'); };
  const concat = (parts) => {
    const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
    let offset = 0;
    for (const part of parts) { out.set(part, offset); offset += part.length; }
    return out;
  };
  if (mime === 'image/webp') {
    const ascii = (at, n) => String.fromCharCode(...bytes.subarray(at, at + n));
    if (bytes.length < 20 || ascii(0, 4) !== 'RIFF' || ascii(8, 4) !== 'WEBP' || view.getUint32(4, true) + 8 !== bytes.length) invalid();
    const parts = [bytes.slice(0, 12)];
    for (let offset = 12; offset < bytes.length;) {
      if (offset + 8 > bytes.length) invalid();
      const kind = ascii(offset, 4), size = view.getUint32(offset + 4, true), end = offset + 8 + size + (size & 1);
      if (end > bytes.length || size < 1) invalid();
      if (!['ICCP', 'EXIF', 'XMP '].includes(kind)) {
        const part = bytes.slice(offset, end);
        if (kind === 'VP8X') { if (size !== 10 || part[8] & 2) invalid(); part[8] &= ~0x2c; }
        parts.push(part);
      }
      offset = end;
    }
    const result = concat(parts);
    new DataView(result.buffer).setUint32(4, result.length - 8, true);
    return result;
  }
  if (mime === 'image/jpeg') {
    if (bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216) invalid();
    const parts = [bytes.slice(0, 2)];
    let offset = 2;
    while (offset < bytes.length - 2) {
      const start = offset;
      if (bytes[offset++] !== 255) invalid();
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (marker === 0xda) { parts.push(bytes.slice(start)); return concat(parts); }
      if (offset + 2 > bytes.length) invalid();
      const size = view.getUint16(offset);
      if (size < 2 || offset + size > bytes.length) invalid();
      if (!(marker >= 0xe1 && marker <= 0xef && marker !== 0xee) && marker !== 0xfe) parts.push(bytes.slice(start, offset + size));
      offset += size;
    }
    invalid();
  }
  invalid();
}
