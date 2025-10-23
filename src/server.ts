import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Try multiple paths for .env (ts-node-dev may change cwd)
const candidates = [
  path.resolve(__dirname, '..', '.env'), // backend/.env
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '..', '..', '.env')
]
let loaded = false
for (const p of candidates) {
  try {
    if (fs.existsSync(p)) {
      dotenv.config({ path: p })
      console.info('Loaded .env from', p)
      loaded = true
      break
    }
  } catch (e) {
    // ignore
  }
}
if (!loaded) {
  console.warn('No .env loaded from candidates:', candidates)
}
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import emailsRouter from './routes/emails';
import logger from './utils/logger';
import { startImapSync } from './services/imapService';
import { upsertEmail, getAllEmails } from './services/emailService';
import { categorizeEmail } from './services/aiService';

export const app = express();

// Enable CORS for all origins in development, specific origin in production
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://onebox-assessment2.netlify.app', 'https://main--onebox-assessment2.netlify.app']
    : '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parse JSON bodies
app.use(bodyParser.json());

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/emails', emailsRouter);

const port = process.env.PORT || 5000;

// Auto-seed demo data on startup if database is empty
async function seedDemoDataIfEmpty() {
  try {
    const existingEmails = getAllEmails();
    if (existingEmails.length === 0) {
      logger.info('No emails found. Seeding demo data...');

      const sampleEmails = [
        {
          id: 'demo_interested_1',
          subject: 'Partnership opportunity - AI platform',
          body: 'Hi! I came across your AI email platform and I\'m really impressed. We\'re looking to integrate similar technology. Would love to discuss partnership options.',
          from: 'john@techstartup.com',
          to: 'you@reachinbox.com',
          folder: 'INBOX',
          account: 'alice@example.com'
        },
        {
          id: 'demo_interested_2',
          subject: 'Interested in your services',
          body: 'Your platform looks amazing! The RAG integration is exactly what we need. Can we schedule a call this week to discuss implementation?',
          from: 'sarah@enterprise.com',
          to: 'you@reachinbox.com',
          folder: 'INBOX',
          account: 'alice@example.com'
        },
        {
          id: 'demo_not_interested_1',
          subject: 'Re: Partnership proposal',
          body: 'Thanks for reaching out, but we\'re not interested in new vendors at the moment. We have other priorities this quarter.',
          from: 'mike@competitor.com',
          to: 'you@reachinbox.com',
          folder: 'INBOX',
          account: 'alice@example.com'
        },
        {
          id: 'demo_not_interested_2',
          subject: 'Not a good fit for us',
          body: 'We appreciate the offer but this doesn\'t align with our current strategy. Best of luck with your product.',
          from: 'lisa@different_industry.com',
          to: 'you@reachinbox.com',
          folder: 'INBOX',
          account: 'other@example.com'
        },
        {
          id: 'demo_meeting_booked',
          subject: 'Meeting confirmed - Tuesday 2 PM',
          body: 'Perfect! I\'ve confirmed our meeting for Tuesday, October 22 at 2 PM EST. Looking forward to discussing the project details.',
          from: 'david@client.com',
          to: 'you@reachinbox.com',
          folder: 'INBOX',
          account: 'alice@example.com'
        },
        {
          id: 'demo_spam_1',
          subject: 'YOU\'VE WON A FREE PRIZE!!!',
          body: 'CLICK HERE NOW to claim your free money! Limited time offer - winners announced TODAY! Don\'t miss out!',
          from: 'noreply@fakespam.com',
          to: 'you@reachinbox.com',
          folder: 'INBOX',
          account: 'other@example.com'
        },
        {
          id: 'demo_spam_2',
          subject: 'Unsubscribe from our mailing list',
          body: 'CLICK HERE to unsubscribe. This is an automated message. Do not reply.',
          from: 'marketing@unknown.com',
          to: 'you@reachinbox.com',
          folder: 'INBOX',
          account: 'alice@example.com'
        },
        {
          id: 'demo_out_of_office',
          subject: 'Auto-reply: Out of office',
          body: 'Thank you for your email. I am currently out of the office and will return on October 25. For urgent matters, please contact my team.',
          from: 'colleague@company.com',
          to: 'you@reachinbox.com',
          folder: 'INBOX',
          account: 'other@example.com'
        }
      ];

      // Upsert all emails and categorize them
      for (const email of sampleEmails) {
        upsertEmail(email);
        try {
          const categorization = await categorizeEmail(`${email.subject}\n\n${email.body}`);
          upsertEmail({ ...email, aiCategory: categorization.category });
          logger.info(`Seeded email: ${email.id} -> ${categorization.category}`);
        } catch (err: any) {
          logger.warn(`Failed to categorize ${email.id}`, { error: err.message });
          // Still keep the email even if categorization fails
        }
      }

      logger.info('Demo data seeding complete', { count: sampleEmails.length });
    }
  } catch (err: any) {
    logger.error('Error seeding demo data', { error: err.message });
  }
}

app.listen(port, async () => {
  logger.info(`Server listening on ${port}`);
  // log presence of key env vars (do not print secrets)
  logger.info(`ENV OPENAI=${!!process.env.OPENAI_API_KEY} SLACK=${!!process.env.SLACK_WEBHOOK_URL} WEBHOOK=${!!process.env.WEBHOOK_URL}`)
  
  // Seed demo data if empty
  await seedDemoDataIfEmpty();
  
  // start background IMAP sync (non-blocking)
  startImapSync().catch((e) => logger.error('IMAP sync failed: ' + e.message));
});