Backend (Node + TypeScript + Express)

Setup

1. Copy `.env.example` to `.env` and fill values (IMAP_ACCOUNTS JSON, OPENAI_API_KEY, SLACK_WEBHOOK_URL)
2. Install deps:

   npm install

3. Start Elasticsearch (from repo root):

   docker-compose up -d

4. Start dev server:

   npm run dev

Notes
- `IMAP_ACCOUNTS` should be a JSON array of account objects. See `.env.example`.
