import axios from 'axios';

export async function triggerWebhook(payload: any) {
  const url = process.env.WEBHOOK_URL;
  if (!url) {
    console.warn('triggerWebhook: WEBHOOK_URL not set')
    return;
  }
  try {
    const res = await axios.post(url, payload)
    console.info('triggerWebhook: sent', res.status)
    return res
  } catch (err: any) {
    console.error('triggerWebhook error:', err.message || err)
    throw err
  }
}
