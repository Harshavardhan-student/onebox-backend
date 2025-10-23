import express from 'express';
import { searchEmails } from '../services/elasticsearchService';
import { suggestReply, categorizeEmail } from '../services/aiService';
import { categorizeAndNotify, upsertEmail, getEmail } from '../services/emailService';
import { initializeRAG, retrieveContext, addTrainingDoc, getAllTrainingDocs } from '../services/ragService';

import { EmailDoc } from '../types/email'

// local in-memory store fallback
import * as emailService from '../services/emailService'
import logger from '../utils/logger';

const router = express.Router();

// Initialize RAG on first use
let ragInitialized = false;

async function ensureRAGInitialized() {
  if (!ragInitialized) {
    await initializeRAG();
    ragInitialized = true;
  }
}

// GET /emails/health - check services
router.get('/health', async (req, res) => {
  try {
    await ensureRAGInitialized();
    res.json({ status: 'ok', message: 'Backend is running' });
  } catch (err: any) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// GET /emails - list (basic search / scan)
router.get('/', async (req, res) => {
  try {
    const q = (req.query.q as string) || '';
    const folder = req.query.folder as string | undefined
    const account = req.query.account as string | undefined
    // try ES first
    try {
      const resp = await searchEmails(q || '*', { folder, account })
      res.json(resp)
      return
    } catch (err) {
      // fallback to in-memory
    }

    const all = Object.values((emailService as any).getAll ? (emailService as any).getAll() : {}) as EmailDoc[]
    const filtered = all.filter((e) => {
      if (folder && e.folder !== folder) return false
      if (account && e.account !== account) return false
      if (!q) return true
      const text = `${e.subject || ''} ${e.body || ''}`.toLowerCase()
      return text.includes(q.toLowerCase())
    })
    res.json({ total: filtered.length, hits: filtered })
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /emails/search?q=
router.get('/search', async (req, res) => {
  try {
    const q = (req.query.q as string) || '';
    const folder = req.query.folder as string | undefined
    const account = req.query.account as string | undefined
    try {
      const resp = await searchEmails(q || '*', { folder, account })
      res.json(resp)
      return
    } catch (err) {
      // fallback to in-memory
    }

    const all = Object.values((emailService as any).getAll ? (emailService as any).getAll() : {}) as EmailDoc[]
    const filtered = all.filter((e) => {
      if (folder && e.folder !== folder) return false
      if (account && e.account !== account) return false
      if (!q) return true
      const text = `${e.subject || ''} ${e.body || ''}`.toLowerCase()
      return text.includes(q.toLowerCase())
    })
    res.json({ total: filtered.length, hits: filtered })
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /emails/:id/categorize
// POST /emails/:id/categorize
router.post('/:id/categorize', async (req, res) => {
  try {
    const id = req.params.id;
    const { subject, body, from, to, date } = req.body || {};
    
    if (!body) {
      return res.status(400).json({ error: 'body is required' });
    }

    // SAVE the email first
    const email = upsertEmail({ id, subject, body, from, to, date, folder: 'INBOX', account: 'alice@example.com' });

    // Categorize with Gemini
    const categorization = await categorizeEmail(`${subject || ''}\n\n${body}`);
    
    // Update with category
    const updated = upsertEmail({ ...email, aiCategory: categorization.category });
    
    logger.info('Email categorized', { id, category: categorization.category });
    res.json({ id, email: updated, categorization });
  } catch (err: any) {
    logger.error('Categorization error', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /emails/:id/suggest-reply - with RAG
router.post('/:id/suggest-reply', async (req, res) => {
  try {
    const id = req.params.id;
    const { body } = req.body;
    
    if (!body) {
      return res.status(400).json({ error: 'body is required' });
    }

    // Get RAG context
    const { context: ragContext, matchedDocs } = await retrieveContext(body, 2);
    
    // Generate reply with RAG context
    const reply = await suggestReply(body);
    
    logger.info('Reply suggested', { id, ragContext: !!ragContext });
    res.json({ id, reply: reply.reply, ragContext, matchedDocs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /emails/rag/docs - list all training docs
router.get('/rag/docs', (req, res) => {
  try {
    const docs = getAllTrainingDocs();
    res.json({ total: docs.length, docs });
  } catch (err: any) {
    logger.error('Get training docs error', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /emails/rag/docs - add training doc
router.post('/rag/docs', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    await addTrainingDoc(text);
    logger.info('Training doc added');
    res.json({ success: true });
  } catch (err: any) {
    logger.error('Add training doc error', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /emails/rag/retrieve - test RAG context retrieval
router.post('/rag/retrieve', async (req, res) => {
  try {
    const { emailBody } = req.body;
    if (!emailBody) {
      return res.status(400).json({ error: 'emailBody is required' });
    }

    await ensureRAGInitialized();
    const result = await retrieveContext(emailBody, 2);
    res.json(result);
  } catch (err: any) {
    logger.error('RAG retrieve error', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// Add this route to your src/routes/emails.ts

// POST /emails/seed - populate with demo data
router.post('/seed', async (req, res) => {
  try {
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
      // Categorize each email
     const categorization = await categorizeEmail(`${email.subject}\n\n${email.body}`);
     upsertEmail({ ...email, aiCategory: categorization.category });
    }

    logger.info('Demo data seeded', { count: sampleEmails.length });
    res.json({ 
      success: true, 
      message: `Seeded ${sampleEmails.length} demo emails`,
      count: sampleEmails.length,
      emails: sampleEmails.map(e => ({ id: e.id, subject: e.subject, from: e.from }))
    });
  } catch (err: any) {
    logger.error('Seed data error', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

export default router;