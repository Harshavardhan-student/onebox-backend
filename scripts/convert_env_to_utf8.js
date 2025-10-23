const fs = require('fs');
const path = require('path');

const p = path.resolve('d:/ReachInbox/onebox/backend/.env');
if (!fs.existsSync(p)) {
  console.error('.env not found at', p);
  process.exit(2);
}

const buf = fs.readFileSync(p);
// detect BOM
if (buf.length >= 2 && buf[0] === 0xFF && buf[1] === 0xFE) {
  console.log('Detected UTF-16LE BOM, converting to UTF-8');
  const s = buf.toString('utf16le');
  fs.writeFileSync(p, s, 'utf8');
  console.log('Wrote UTF-8 .env');
} else if (buf.length >= 2 && buf[0] === 0xFE && buf[1] === 0xFF) {
  console.log('Detected UTF-16BE BOM, converting to UTF-8');
  // Node doesn't decode utf16be directly; swap bytes then decode utf16le
  const swapped = Buffer.allocUnsafe(buf.length - 2);
  for (let i = 2; i + 1 < buf.length; i += 2) {
    swapped[i - 2] = buf[i + 1];
    swapped[i - 1] = buf[i];
  }
  const s = swapped.toString('utf16le');
  fs.writeFileSync(p, s, 'utf8');
  console.log('Wrote UTF-8 .env');
} else if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
  console.log('Detected UTF-8 BOM, stripping BOM');
  const s = buf.slice(3).toString('utf8');
  fs.writeFileSync(p, s, 'utf8');
  console.log('Wrote UTF-8 without BOM .env');
} else {
  // assume already UTF-8
  console.log('No BOM detected; assuming UTF-8. No changes made.');
}
