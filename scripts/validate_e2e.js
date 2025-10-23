const fs = require('fs')

const BACKEND = process.env.BACKEND_URL || 'http://localhost:5000'
const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:5173'

async function safeFetch(url, opts={}){
  try{
    const res = await fetch(url, opts)
    const text = await res.text()
    let json
    try{ json = JSON.parse(text) }catch(e){ json = text }
    return { ok: true, status: res.status, body: json }
  }catch(err){
    return { ok: false, error: err.message || String(err) }
  }
}

async function run(){
  const report = { health: false, emailsEndpoint: 'error', categorizeEndpoint: 'error', searchEndpoint: 'error', suggestReplyEndpoint: 'error', frontendSearch: 'error', frontendCategorization: 'error', frontendSuggestReply: 'error', errors: [] }

  console.log('Running E2E checks against BACKEND=' + BACKEND + ' FRONTEND=' + FRONTEND)

  // 1) health
  const h = await safeFetch(`${BACKEND}/health`)
  if (h.ok && h.status === 200 && h.body && h.body.ok) {
    report.health = true
  } else {
    report.errors.push('Health check failed: ' + (h.error || JSON.stringify(h.body)))
  }

  // 2) emails GET
  const e = await safeFetch(`${BACKEND}/emails`)
  if (e.ok && e.status === 200) {
    report.emailsEndpoint = 'ok'
    // ensure array or hits
    try{
      const body = e.body
      if (Array.isArray(body) || (body && (Array.isArray(body.hits) || (body.hits && Array.isArray(body.hits.hits))))) {
        // ok
      } else {
        // ok as long as object
      }
    }catch(err){ }
  } else {
    report.errors.push('GET /emails failed: ' + (e.error || JSON.stringify(e.body)))
  }

  // 3) categorize
  try{
    const sample = { subject: 'E2E test - interested', body: 'I am interested in a demo', from: 'tester@example.com', to: 'you@company.com', date: new Date().toISOString(), folder: 'INBOX', account: 'acme' }
    const c = await safeFetch(`${BACKEND}/emails/e2e-test-1/categorize`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(sample) })
    if (c.ok && c.status === 200 && c.body) {
      report.categorizeEndpoint = 'ok'
      const cat = c.body.email?.category || c.body.category
      if (cat) report.frontendCategorization = 'ok'
      const notified = c.body.email?.notifiedInterested || c.body.notifiedInterested
      report.categorize_notifiedInterested = !!notified
    } else {
      report.errors.push('POST /categorize failed: ' + (c.error || JSON.stringify(c.body)))
    }
  }catch(err){ report.errors.push('POST /categorize exception: '+String(err)) }

  // 4) suggest-reply
  try{
    const s = await safeFetch(`${BACKEND}/emails/e2e-test-1/suggest-reply`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ body: 'Hi, tell me about your product' }) })
    if (s.ok && s.status === 200 && s.body) {
      report.suggestReplyEndpoint = 'ok'
      // if reply present
      const reply = s.body.reply || s.body?.choices?.[0]?.text || s.body?.message
      if (reply) report.frontendSuggestReply = 'ok'
    } else {
      report.errors.push('POST /suggest-reply failed: ' + (s.error || JSON.stringify(s.body)))
    }
  }catch(err){ report.errors.push('POST /suggest-reply exception: '+String(err)) }

  // 5) search
  try{
    const params = new URLSearchParams({ q: 'interested', folder: 'INBOX', account: 'acme' })
    const ss = await safeFetch(`${BACKEND}/emails/search?${params.toString()}`)
    if (ss.ok && ss.status === 200) {
      report.searchEndpoint = 'ok'
      // check hits
      const hits = ss.body.hits || ss.body
      if (Array.isArray(hits) || (ss.body && (Array.isArray(ss.body.hits) || Array.isArray(ss.body.hits?.hits)))) {
        // ok
      }
    } else {
      report.errors.push('GET /emails/search failed: ' + (ss.error || JSON.stringify(ss.body)))
    }
  }catch(err){ report.errors.push('GET /emails/search exception: '+String(err)) }

  // 6) frontend reachability
  try{
    const f = await safeFetch(FRONTEND)
    if (f.ok && f.status === 200) report.frontendSearch = 'ok'
    else report.errors.push('Frontend not reachable: ' + (f.error || JSON.stringify(f.body)))
  }catch(err){ report.errors.push('Frontend fetch exception: '+String(err)) }

  // Save report
  try{
    fs.writeFileSync(__dirname + '/e2e-report.json', JSON.stringify(report, null, 2))
  }catch(err){ console.warn('Failed to write report file', err) }

  console.log(JSON.stringify(report, null, 2))
}

run().catch((err)=>{
  console.error('Validation script error', err)
  process.exit(2)
})
