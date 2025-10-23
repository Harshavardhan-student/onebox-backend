const fs = require('fs');
const p = 'd:/ReachInbox/onebox/backend/.env';
const s = fs.readFileSync(p, 'utf8');
console.log('RAW:');
console.log(s);
console.log('LINES:');
s.split(/\r?\n/).forEach((line, idx)=>{
  const codes = [];
  for (let i=0;i<line.length;i++) codes.push(line.charCodeAt(i));
  console.log(idx, JSON.stringify(line), 'codes', codes.join(','));
});
