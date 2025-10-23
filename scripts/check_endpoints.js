const http = require('http');

function check(path) {
  return new Promise((resolve) => {
    const opts = { hostname: 'localhost', port: 5000, path, method: 'GET', timeout: 3000 };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', (e) => resolve({ error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ error: 'timeout' }); });
    req.end();
  });
}

(async () => {
  for (const p of ['/health', '/emails', '/emails/search?q=*']) {
    const r = await check(p);
    console.log('PATH:', p);
    console.log(JSON.stringify(r, null, 2));
    console.log('---');
  }
})();
