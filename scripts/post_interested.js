const axios = require('axios');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const BASE = process.env.BACKEND_URL || 'http://localhost:5000';
const id = '123';
const payload = {
  subject: 'Purchase inquiry',
  body: 'Interested in your product. Please send pricing and next steps.',
  from: 'bob@example.com',
  to: 'sales@example.com',
  date: new Date().toISOString()
};

async function run() {
  try {
    const res = await axios.post(`${BASE}/emails/${id}/categorize`, payload, { timeout: 20000 });
    console.log('categorize POST status', res.status);
    console.log('categorize POST data', JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error('categorize POST error:', err.message || err);
    if (err.response) console.error('response:', err.response.status, err.response.data);
  }
}

run();
