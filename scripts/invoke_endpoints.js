const axios = require('axios');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const BASE = process.env.BACKEND_URL || 'http://localhost:5000';
const id = '123';
const categorizePayload = {
  subject: 'Test Slack + AI Integration',
  body: 'This is a test email for Slack/webhook and AI suggested reply.',
  from: 'alice@example.com',
  to: 'you@example.com',
  date: '2025-10-18T12:00:00Z'
};

async function run() {
  try {
    console.log('Calling categorize...');
    const c = await axios.post(`${BASE}/emails/${id}/categorize`, categorizePayload, { timeout: 20000 });
    console.log('categorize status', c.status);
    console.log('categorize data:', JSON.stringify(c.data, null, 2));
  } catch (err) {
    console.error('categorize error:', err.message || err);
    if (err.response) console.error('response:', err.response.status, err.response.data);
  }

  try {
    console.log('Calling suggest-reply...');
    const s = await axios.post(`${BASE}/emails/${id}/suggest-reply`, { id }, { timeout: 60000 });
    console.log('suggest-reply status', s.status);
    console.log('suggest-reply data:', JSON.stringify(s.data, null, 2));
  } catch (err) {
    console.error('suggest-reply error:', err.message || err);
    if (err.response) console.error('response:', err.response.status, err.response.data);
  }

  // If WEBHOOK_URL provided, attempt to GET it (webhook.site provides GET view)
  if (process.env.WEBHOOK_URL) {
    try {
      console.log('Checking webhook.site URL (GET):', process.env.WEBHOOK_URL);
      const w = await axios.get(process.env.WEBHOOK_URL, { timeout: 10000 });
      console.log('webhook GET status', w.status);
      // webhook.site responds with HTML; don't dump it all
      console.log('webhook GET headers:', w.headers['content-type']);
    } catch (err) {
      console.error('webhook GET error:', err.message || err);
    }
  } else {
    console.log('No WEBHOOK_URL in env; skipping webhook check.');
  }
}

run();
