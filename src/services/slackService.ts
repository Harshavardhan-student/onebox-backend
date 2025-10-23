import axios from 'axios';

export async function sendSlackMessage(text: string) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) {
    console.warn('sendSlackMessage: SLACK_WEBHOOK_URL not set')
    return;
  }
  try {
    const res = await axios.post(url, { text })
    console.info('sendSlackMessage: sent', res.status)
    return res
  } catch (err: any) {
    console.error('sendSlackMessage error:', err.message || err)
    throw err
  }
}
