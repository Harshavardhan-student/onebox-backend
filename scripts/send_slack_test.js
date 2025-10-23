const axios = require('axios');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const url = process.env.SLACK_WEBHOOK_URL;
if (!url) {
  console.error('SLACK_WEBHOOK_URL not set in env');
  process.exit(1);
}

async function run() {
  try {
    const payload = { text: 'Onebox integration test: Slack webhook reachable ✅' };
    const res = await axios.post(url, payload, { timeout: 10000 });
    console.log('Slack POST status', res.status);
    console.log('Slack POST data', res.data);
  } catch (err) {
    console.error('Slack POST error:', err.message || err);
    if (err.response) console.error('response:', err.response.status, err.response.data);
  }
}

run();
