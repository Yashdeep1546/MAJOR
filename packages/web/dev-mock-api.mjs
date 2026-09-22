/**
 * Dev-only mock API for @aether/web.
 *
 * Serves realistic sample data on port 3001 so the Phase 1 interface
 * can be reviewed without Postgres, Redis, or a Gemini key.
 * The Vite dev server proxies /api here (see vite.config.ts).
 *
 *   node dev-mock-api.mjs
 */
import http from 'node:http';

const PORT = Number(process.env.MOCK_PORT || 3001);

const now = Date.now();
const days = (n) => new Date(now + n * 86400000).toISOString();

const tasks = [
  { id: 'a1f3c9e2', title: 'Review Q3 budget spreadsheet', description: 'Cross-check the marketing line items against the ledger before Friday finance.', status: 'TODO', priority: 'HIGH', dueDate: days(2) },
  { id: 'b2e7d4a1', title: 'Submit vendor invoices', description: 'Batch the outstanding supplier invoices and send them to accounts payable.', status: 'IN_PROGRESS', priority: 'URGENT', dueDate: days(1) },
  { id: 'c3d8f5b0', title: 'Draft onboarding checklist', description: 'Standardise the two-week ramp-up plan for new engineering hires.', status: 'TODO', priority: 'MEDIUM', dueDate: days(6) },
  { id: 'd4c9a6f2', title: 'Renew SSL certificates', description: null, status: 'DONE', priority: 'HIGH', dueDate: days(-3) },
  { id: 'e5b0c7d3', title: 'Book venue for team offsite', description: 'Shortlist three options near the office and get quotes.', status: 'TODO', priority: 'LOW', dueDate: days(12) },
  { id: 'f6a1b8e4', title: 'Archive legacy project files', description: 'Move the 2023 client work into cold storage and update the index.', status: 'DONE', priority: 'LOW', dueDate: days(-10) },
  { id: 'g7f2a9d5', title: 'Prepare board summary deck', description: 'One-page progress summary plus risks. Needs numbers from analytics.', status: 'TODO', priority: 'HIGH', dueDate: days(4) },
];

const conversationId = 'conv-4f21ab77';
const sessionId = 'sess-9d3e1c84';

const history = [
  { id: 'm1', role: 'user', content: 'Add a high-priority task to review the Q3 budget, due Friday.', timestamp: '09:41' },
  { id: 'm2', role: 'assistant', content: "Done. I've added \"Review Q3 budget spreadsheet\" with HIGH priority, due Friday. It's at the top of your ledger on the Tasks page.", timestamp: '09:41', sessionId },
  { id: 'm3', role: 'user', content: "What's left on my plate?", timestamp: '09:43' },
  { id: 'm4', role: 'assistant', content: "You have 5 open tasks. The most pressing: \"Submit vendor invoices\" (URGENT, due tomorrow) and \"Review Q3 budget spreadsheet\" (HIGH, due Friday). Would you like me to start either?", timestamp: '09:43', sessionId },
];

const traces = {
  [sessionId]: [
    { id: 't1', state: 'UNDERSTAND', toolName: null, toolInput: null, toolOutput: null, modelUsed: 'gemini-flash-lite', latencyMs: 412, tokenCount: 96, createdAt: days(0) },
    { id: 't2', state: 'PLAN', toolName: 'create_task', toolInput: { title: 'Review Q3 budget spreadsheet', priority: 'HIGH', dueDate: 'friday' }, toolOutput: null, modelUsed: 'gemini-flash', latencyMs: 1104, tokenCount: 218, createdAt: days(0) },
    { id: 't3', state: 'EXECUTE', toolName: 'create_task', toolInput: null, toolOutput: { id: 'a1f3c9e2', status: 'created' }, modelUsed: null, latencyMs: 38, tokenCount: null, createdAt: days(0) },
    { id: 't4', state: 'CRITIQUE', toolName: null, toolInput: null, toolOutput: null, modelUsed: 'gemini-flash-lite', latencyMs: 503, tokenCount: 74, createdAt: days(0) },
  ],
};

function json(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function replyFor(message) {
  const m = message.toLowerCase();
  if (m.includes('create') || m.includes('add')) {
    return "Understood — task created and filed to your ledger. I've set a sensible default priority; tell me if you'd like it changed.";
  }
  if (m.includes('done') || m.includes('complete')) {
    return "Marked complete. The ledger has been updated and the entry is now struck through on the Tasks page.";
  }
  if (m.includes('today') || m.includes('list') || m.includes('what')) {
    return "You have 5 open items. Most urgent: \"Submit vendor invoices\" (due tomorrow), then \"Review Q3 budget spreadsheet\" (due Friday).";
  }
  return "Noted. I've planned the work, executed it against your task list, and recorded every step — open the execution trace to review what I did.";
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === 'GET' && url.pathname === '/api/tasks') {
    const status = url.searchParams.get('status');
    return json(res, 200, status ? tasks.filter((t) => t.status === status) : tasks);
  }

  if (req.method === 'GET' && url.pathname === '/api/chat/recent') {
    return json(res, 200, { conversationId, messages: history });
  }

  if (req.method === 'POST' && url.pathname === '/api/chat') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      let message = '';
      try { message = JSON.parse(body).message || ''; } catch { /* ignore */ }
      setTimeout(() => {
        json(res, 200, {
          conversationId,
          sessionId,
          response: replyFor(message),
        });
      }, 1400);
    });
    return;
  }

  const traceMatch = url.pathname.match(/^\/api\/traces\/(.+)$/);
  if (req.method === 'GET' && traceMatch) {
    return json(res, 200, traces[traceMatch[1]] ?? []);
  }

  json(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`[mock-api] listening on http://localhost:${PORT}`);
});
