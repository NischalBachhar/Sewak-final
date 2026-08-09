const fs = require('fs');
const path = require('path');
function walk(dir) {
  return fs.readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    return fs.statSync(p).isDirectory() ? walk(p) : p;
  });
}
const files = walk(path.join(__dirname, 'src')).filter((f) => f.endsWith('.js') || f.endsWith('.jsx'));
const re = /style=\{\{/;
const affected = [];
files.forEach((fn) => {
  const text = fs.readFileSync(fn, 'utf8');
  if (re.test(text)) affected.push(fn.replace(__dirname + path.sep, ''));
});
console.log(affected.join('\n'));
