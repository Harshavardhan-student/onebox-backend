const fetch = globalThis.fetch || require('node-fetch')
const BACKEND = process.env.BACKEND_URL || 'http://localhost:5000'

async function run(){
  const id = 'slack-test-' + Date.now()
  const payload = {
    subject: 'Test Slack Notification',
    body: 'Hi, this is a test for Slack integration',
    from: 'alice@example.com',
    to: 'you@example.com',
    date: new Date().toISOString(),
    folder: 'INBOX',
    account: 'acme'
  }
  console.log('Posting categorize for', id)
  const r1 = await fetch(`${BACKEND}/emails/${encodeURIComponent(id)}/categorize`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) })
  const j1 = await r1.text().then(t=>{try{return JSON.parse(t)}catch(e){return t}})
  console.log('Categorize response:', r1.status, j1)

  console.log('Requesting suggested reply')
  const r2 = await fetch(`${BACKEND}/emails/${encodeURIComponent(id)}/suggest-reply`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ body: payload.body }) })
  const j2 = await r2.text().then(t=>{try{return JSON.parse(t)}catch(e){return t}})
  console.log('Suggest reply response:', r2.status, j2)
}

run().catch(err=>{ console.error('test_notify error', err); process.exit(1) })
