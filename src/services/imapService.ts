
import { ImapFlow } from 'imapflow';
import logger from '../utils/logger';
import { indexEmail } from './elasticsearchService';

type AccountConfig = {
  host: string;
  port?: number;
  secure?: boolean;
  user: string;
  pass: string;
  accountId?: string;
};

function parseAccounts(): AccountConfig[] {
  const raw = process.env.IMAP_ACCOUNTS || '';
  try {
    if (!raw) return [];
    return JSON.parse(raw) as AccountConfig[];
  } catch (e) {
    logger.error('Failed to parse IMAP_ACCOUNTS: ' + e);
    return [];
  }
}

export async function startImapSync() {
  const accounts = parseAccounts();
  for (const acct of accounts) {
    connectAccount(acct).catch((e) => logger.error('IMAP account error: ' + e.message));
  }
}

async function connectAccount(acct: AccountConfig) {
  const client = new ImapFlow({
    host: acct.host,
    port: acct.port || 993,
    secure: acct.secure ?? true,
    auth: { user: acct.user, pass: acct.pass }
  });

  await client.connect();
  logger.info(`Connected to IMAP ${acct.user}`);

  // fetch last 30 days from INBOX
  const since = new Date();
  since.setDate(since.getDate() - 30);

  // select INBOX
  await client.mailboxOpen('INBOX');
  for await (const msg of client.fetch({ since: since.toISOString() }, { envelope: true, source: true, flags: true, internalDate: true })) {
    try {
      const internalDate = typeof msg.internalDate === 'string' ? new Date(msg.internalDate) : msg.internalDate;
      const doc = {
        id: `${acct.accountId || acct.user}-${internalDate?.getTime() || Date.now()}`,
        accountId: acct.accountId || acct.user,
        folder: 'INBOX',
        from: msg.envelope?.from?.map((f: any) => f.address).join(', '),
        to: msg.envelope?.to?.map((t: any) => t.address).join(', '),
        subject: msg.envelope?.subject,
        body: msg.source?.toString('utf-8')?.slice(0, 10000),
        date: internalDate?.toISOString() || new Date().toISOString(),
        aiCategory: null
      };
      await indexEmail(doc);
    } catch (e: any) {
      logger.error('Index email error: ' + e.message);
    }
  }

  // IDLE for new messages
  client.on('exists', async () => {
    try {
      // fetch the most recent message
      const seq = await client.status('INBOX', { uidNext: true });
      const uid = (seq.uidNext || 0) - 1;
      if (uid > 0) {
        for await (const msg of client.fetch({ uid }, { envelope: true, source: true, internalDate: true })) {
          const internalDate = typeof msg.internalDate === 'string' ? new Date(msg.internalDate) : msg.internalDate;
          const doc = {
            id: `${acct.accountId || acct.user}-${internalDate?.getTime() || Date.now()}`,
            accountId: acct.accountId || acct.user,
            folder: 'INBOX',
            from: msg.envelope?.from?.map((f: any) => f.address).join(', '),
            to: msg.envelope?.to?.map((t: any) => t.address).join(', '),
            subject: msg.envelope?.subject,
            body: msg.source?.toString('utf-8')?.slice(0, 10000),
            date: internalDate?.toISOString() || new Date().toISOString(),
            aiCategory: null
          };
          await indexEmail(doc);
        }
      }
    } catch (e: any) {
      logger.error('Error fetching new message: ' + e.message);
    }
  });
}
