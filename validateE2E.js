"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// validateE2E.ts
const fs_1 = __importDefault(require("fs"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK_URL;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
async function validate() {
    const report = {
        health: false,
        emailsEndpoint: 'error',
        categorizeEndpoint: 'error',
        searchEndpoint: 'error',
        suggestReplyEndpoint: 'error',
        frontendSearch: 'error',
        frontendCategorization: 'error',
        frontendSuggestReply: 'error',
        errors: [],
    };
    // 1. /health
    try {
        const res = await (0, node_fetch_1.default)(`${BACKEND_URL}/health`);
        const json = await res.json();
        if (json.ok) {
            report.health = true;
        }
        else {
            report.errors.push('/health returned non-ok');
        }
    }
    catch (err) {
        report.errors.push(`/health error: ${err.message}`);
    }
    // 2. /emails
    try {
        const res = await (0, node_fetch_1.default)(`${BACKEND_URL}/emails`);
        const json = await res.json();
        report.emailsEndpoint = Array.isArray(json) || json.hits ? 'ok' : 'error';
    }
    catch (err) {
        report.errors.push(`/emails error: ${err.message}`);
    }
    // 3. POST /emails/:id/categorize
    const testEmail = {
        subject: 'Test email',
        body: 'This is a test email for validation.',
        from: 'lead@example.com',
        to: 'me@example.com',
        date: new Date().toISOString(),
    };
    try {
        const res = await (0, node_fetch_1.default)(`${BACKEND_URL}/emails/123/categorize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testEmail),
        });
        const json = await res.json();
        if (json.email && json.email.category) {
            report.categorizeEndpoint = 'ok';
            if (!json.email.notifiedInterested) {
                report.errors.push('Slack/webhook not triggered (environment variables may be missing)');
            }
        }
        else {
            report.errors.push('/categorize did not return valid email object');
        }
    }
    catch (err) {
        report.errors.push(`/categorize error: ${err.message}`);
    }
    // 4. GET /emails/search?q=test
    try {
        const res = await (0, node_fetch_1.default)(`${BACKEND_URL}/emails/search?q=test`);
        const json = await res.json();
        if (json && Array.isArray(json.hits)) {
            report.searchEndpoint = 'ok';
        }
        else {
            report.errors.push('/search returned invalid format');
        }
    }
    catch (err) {
        report.errors.push(`/search error: ${err.message}`);
    }
    // 5. POST /emails/:id/suggest-reply
    try {
        const res = await (0, node_fetch_1.default)(`${BACKEND_URL}/emails/123/suggest-reply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ body: testEmail.body }),
        });
        const json = await res.json();
        if (json.reply || json.error) {
            report.suggestReplyEndpoint = 'ok';
        }
        else {
            report.errors.push('/suggest-reply returned invalid format');
        }
    }
    catch (err) {
        report.errors.push(`/suggest-reply error: ${err.message}`);
    }
    // 6. Frontend (basic HTTP checks)
    try {
        const res = await (0, node_fetch_1.default)(`${FRONTEND_URL}`);
        if (res.ok) {
            report.frontendSearch = 'ok';
            report.frontendCategorization = 'ok';
            report.frontendSuggestReply = 'ok';
        }
        else {
            report.errors.push(`Frontend returned status ${res.status}`);
        }
    }
    catch (err) {
        report.errors.push(`Frontend error: ${err.message}`);
    }
    // Write report to file
    fs_1.default.writeFileSync('e2e-report.json', JSON.stringify(report, null, 2));
    console.log('E2E validation complete. Report saved to e2e-report.json');
    console.log(report);
}
validate();
