const path = require('path');
const dotenv = require('dotenv');

const envPath = path.resolve(__dirname, '../.env');
const r = dotenv.config({ path: envPath });
if (r.error) {
  console.error('Failed to load .env from', envPath, r.error);
  process.exit(1);
}

console.log('Loaded .env from', envPath);
console.log('OPENAI_API_KEY present:', !!process.env.OPENAI_API_KEY);
console.log('SLACK_WEBHOOK_URL present:', !!process.env.SLACK_WEBHOOK_URL);
console.log('WEBHOOK_URL present:', !!process.env.WEBHOOK_URL);
