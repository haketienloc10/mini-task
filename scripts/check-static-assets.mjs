import { access, readFile } from 'node:fs/promises';

const requiredFiles = [
  'public/index.html',
  'public/app.js',
  'public/styles.css',
  'src/server.mjs',
  'src/runner.mjs',
  'src/taskStore.mjs'
];

for (const file of requiredFiles) {
  await access(file);
}

const html = await readFile('public/index.html', 'utf8');
if (!html.includes('/app.js') || !html.includes('/styles.css')) {
  throw new Error('Static asset references are missing');
}

console.log('Static asset check passed');
