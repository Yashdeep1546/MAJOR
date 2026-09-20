import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { errorHandler } from './middleware/error.js';
import { registerTaskTools } from './orchestrator/tools/task-tools.js';
import taskRoutes from './routes/tasks.js';
import chatRoutes from './routes/chat.js';
import auditRoutes from './routes/audit.js';

// Register tool handlers before the server starts
registerTaskTools();

const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/tasks', taskRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/traces', auditRoutes);

// Error handler (must be last)
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  app.listen(config.port, () => {
    console.log(`🌀 AETHER server running on http://localhost:${config.port}`);
  });
}

export default app;
