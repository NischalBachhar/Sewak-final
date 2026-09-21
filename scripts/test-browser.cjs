const { spawnSync } = require('node:child_process');
const env = { ...process.env, REACT_APP_USE_EMULATORS: 'true', REACT_APP_CANONICAL_ORIGIN: 'http://127.0.0.1:4173' };
for (const args of [['node_modules/react-scripts/scripts/build.js'], ['scripts/public-metadata.cjs'], ['scripts/test-emulators.cjs', 'node scripts/run-browser-tests.cjs']]) {
  const result = spawnSync(process.execPath, args, { env, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
