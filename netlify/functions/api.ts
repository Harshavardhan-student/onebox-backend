import { Handler } from '@netlify/functions';
import express from 'express';
import serverless from 'serverless-http';
import cors from 'cors';
import emailsRouter from '../../src/routes/emails';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/emails', emailsRouter);

const handler = serverless(app);
export { handler };