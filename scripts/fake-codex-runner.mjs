const input = process.argv.slice(2).join(' ');

if (input.includes('fail')) {
  console.error('fake codex failure');
  process.exit(7);
}

console.log(`fake codex output ${process.pid}`);
