require('dotenv').config({ path: 'd:/ReachInbox/onebox/backend/.env' })
console.log({ OPENAI: !!process.env.OPENAI_API_KEY, SLACK: !!process.env.SLACK_WEBHOOK_URL, WEBHOOK: !!process.env.WEBHOOK_URL })
