import { Router } from 'express';
import { auditService } from '../services/audit.service.js';

const router = Router();

/** GET /api/traces/:sessionId — returns ordered AgentAction rows for the trace viewer. */
router.get('/:sessionId', async (req, res) => {
  const actions = await auditService.getBySessionId(req.params.sessionId);
  res.json(actions);
});

export default router;
