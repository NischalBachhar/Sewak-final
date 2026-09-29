import React, { useEffect, useState } from 'react';
import { apiRequest } from '../apiClient';

export default function ProfileImage({ src, alt = '', fallback = null, ...props }) {
  const [resolved, setResolved] = useState('');
  useEffect(() => {
    let live = true, objectUrl = '';
    setResolved('');
    if (typeof src === 'string' && src.startsWith('blob:')) { setResolved(src); return undefined; }
    if (typeof src !== 'string' || !src.startsWith('/api/media/')) return undefined;
    apiRequest(src, { binary: true }).then((blob) => {
      if (!live) return;
      objectUrl = URL.createObjectURL(blob); setResolved(objectUrl);
    }).catch(() => {});
    return () => { live = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [src]);
  if (!resolved) return fallback || <span className={props.className} aria-label={alt || 'Profile photo unavailable'}>{alt.trim().charAt(0) || '◯'}</span>;
  return <img {...props} src={resolved} alt={alt} onError={() => setResolved('')} />;
}
