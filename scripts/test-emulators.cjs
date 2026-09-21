const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const env = { ...process.env, GCLOUD_PROJECT: 'demo-sewak-test', GOOGLE_CLOUD_PROJECT: 'demo-sewak-test', FIREBASE_PROJECT_ID: 'demo-sewak-test' };
delete env.GOOGLE_APPLICATION_CREDENTIALS;
const javaRoot = path.resolve('.local-tools/java');
if (fs.existsSync(javaRoot)) {
  env.JAVA_HOME = path.join(javaRoot, fs.readdirSync(javaRoot)[0]);
  env.PATH = path.join(env.JAVA_HOME, 'bin') + path.delimiter + env.PATH;
}
const command = process.argv[2] || 'node --test --test-concurrency=1 tests/rules.test.cjs functions/test/*.test.cjs';
if (!command.startsWith('node ') && !command.startsWith('npm ')) throw new Error('Only local test commands are supported.');
const result = spawnSync(process.execPath, ['node_modules/firebase-tools/lib/bin/firebase.js', 'emulators:exec', '--project', 'demo-sewak-test', '--config', 'firebase.test.json', '--only', 'auth,firestore', command], { env, stdio: 'inherit' });
process.exit(result.status ?? 1);
