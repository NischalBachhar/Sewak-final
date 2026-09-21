const fs = require('node:fs');
require('dotenv').config();
const raw = process.env.REACT_APP_CANONICAL_ORIGIN;
const htmlPath = 'build/index.html';
let html = fs.readFileSync(htmlPath, 'utf8');
html = html.replace('</head>', '<meta property="og:title" content="Sewak — Care, close to home"><meta property="og:description" content="Browse caregivers and household support in Nepal."><meta property="og:type" content="website"><meta name="twitter:card" content="summary"></head>');
let robots = 'User-agent: *\nAllow: /\n';
if (raw) {
  const origin = new URL(raw);
  if (!['http:', 'https:'].includes(origin.protocol) || origin.origin !== raw.replace(/\/$/, '') || origin.username || origin.password) throw new Error('REACT_APP_CANONICAL_ORIGIN must be a valid origin without a path.');
  const canonical = `${origin.origin}/browse`;
  html = html.replace('</head>', `<link rel="canonical" href="${canonical}"><meta property="og:url" content="${canonical}"></head>`);
  fs.writeFileSync('build/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${canonical}</loc></url></urlset>`);
  robots += `Sitemap: ${origin.origin}/sitemap.xml\n`;
} else {
  console.warn('Canonical origin is not configured; sitemap/canonical URLs are omitted. Set REACT_APP_CANONICAL_ORIGIN for release builds.');
}
fs.writeFileSync(htmlPath, html);
fs.writeFileSync('build/robots.txt', robots);
// Public HTML metadata is generic. Private routes get served HTTP noindex headers
// in Firebase Hosting and Cloudflare Pages; JS metadata also follows navigation.
fs.writeFileSync('build/_headers', ['/auth', '/user', '/user/*', '/caregiver', '/caregiver/*', '/organization', '/organization/*', '/superadmin', '/superadmin/*', '/payment-callback'].map(route => `${route}\n  X-Robots-Tag: noindex, nofollow\n`).join('\n'));
fs.writeFileSync('build/_redirects', '/* /index.html 200\n');
