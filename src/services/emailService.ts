import logger from '../utils/logger';
import { EmailDoc } from '../types/email';

// In-memory store for emails
const emailStore: { [key: string]: EmailDoc } = {};

// Upsert (insert or update) an email
export function upsertEmail(email: Partial<EmailDoc>): EmailDoc {
  if (!email.id) {
    throw new Error('Email must have an id');
  }

  const existing = emailStore[email.id] || {};
  const updated: EmailDoc = {
    id: email.id,
    subject: email.subject || existing.subject || '',
    body: email.body || existing.body || '',
    from: email.from || existing.from || '',
    to: email.to || existing.to || '',
    folder: email.folder || existing.folder || 'INBOX',
    account: email.account || existing.account || '',
    date: email.date || existing.date || new Date().toISOString(),
    aiCategory: email.aiCategory || existing.aiCategory || null,
    read: email.read ?? existing.read ?? false
  };

  emailStore[email.id] = updated;
  logger.info('Email upserted', { id: email.id });
  return updated;
}

// Get a single email by ID
export function getEmail(id: string): EmailDoc | null {
  return emailStore[id] || null;
}

// Get all emails
export function getAllEmails(): EmailDoc[] {
  return Object.values(emailStore);
}

// Get all emails as store object
export function getAll(): { [key: string]: EmailDoc } {
  return emailStore;
}

// Categorize email and send notifications
export async function categorizeAndNotify(
  emailId: string,
  category: string
): Promise<EmailDoc | null> {
  try {
    const email = emailStore[emailId];
    
    if (!email) {
      logger.warn('Email not found for categorization', { emailId });
      return null;
    }

    // Update email with category
    email.aiCategory = category;
    emailStore[emailId] = email;

    logger.info('Email categorized', { emailId, category });

    // Send notifications if "Interested"
    if (category === 'Interested') {
      await sendNotifications(email);
    }

    return email;
  } catch (err: any) {
    logger.error('Error in categorizeAndNotify', { error: err.message });
    throw err;
  }
}

// Send Slack and Webhook notifications
async function sendNotifications(email: EmailDoc): Promise<void> {
  try {
    // Send to Slack
    if (process.env.SLACK_WEBHOOK_URL) {
      await sendSlackNotification(email);
    }

    // Send to Webhook
    if (process.env.WEBHOOK_URL) {
      await sendWebhookNotification(email);
    }
  } catch (err: any) {
    logger.error('Error sending notifications', { error: err.message });
  }
}

// Send Slack notification
async function sendSlackNotification(email: EmailDoc): Promise<void> {
  try {
    const slackUrl = process.env.SLACK_WEBHOOK_URL;
    if (!slackUrl) return;

    const payload = {
      text: `🎯 New Interested Email`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*New Interested Lead*\n*From:* ${email.from}\n*Subject:* ${email.subject}\n*Body:* ${email.body?.substring(0, 200) || 'N/A'}`
          }
        }
      ]
    };

    const response = await fetch(slackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      logger.info('Slack notification sent', { emailId: email.id });
    } else {
      logger.warn('Slack notification failed', { status: response.status });
    }
  } catch (err: any) {
    logger.error('Slack notification error', { error: err.message });
  }
}

// Send Webhook notification
async function sendWebhookNotification(email: EmailDoc): Promise<void> {
  try {
    const webhookUrl = process.env.WEBHOOK_URL;
    if (!webhookUrl) return;

    const payload = {
      event: 'email_interested',
      emailId: email.id,
      from: email.from,
      subject: email.subject,
      body: email.body,
      timestamp: new Date().toISOString()
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      logger.info('Webhook notification sent', { emailId: email.id });
    } else {
      logger.warn('Webhook notification failed', { status: response.status });
    }
  } catch (err: any) {
    logger.error('Webhook notification error', { error: err.message });
  }
}

// Clear all emails (for testing)
export function clearEmails(): void {
  Object.keys(emailStore).forEach(key => delete emailStore[key]);
  logger.info('All emails cleared');
}