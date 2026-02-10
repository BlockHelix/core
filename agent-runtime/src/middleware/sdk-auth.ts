import { Request, Response, NextFunction } from 'express';
import { agentStorage, StoredAgent } from '../services/storage';

declare global {
  namespace Express {
    interface Request {
      agent?: StoredAgent;
    }
  }
}

const RATE_LIMIT = 60;
const RATE_WINDOW = 60_000;
const hits = new Map<string, number[]>();

setInterval(() => {
  const cutoff = Date.now() - RATE_WINDOW;
  for (const [key, timestamps] of hits) {
    const filtered = timestamps.filter(t => t > cutoff);
    if (filtered.length === 0) hits.delete(key);
    else hits.set(key, filtered);
  }
}, RATE_WINDOW);

export function sdkAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer bh_agent_')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = header.slice(7);
  const agent = agentStorage.getBySdkKey(token);
  if (!agent) {
    res.status(401).json({ error: 'Invalid SDK key' });
    return;
  }

  const now = Date.now();
  const cutoff = now - RATE_WINDOW;
  const key = agent.vault;
  const timestamps = (hits.get(key) || []).filter(t => t > cutoff);
  if (timestamps.length >= RATE_LIMIT) {
    res.status(429).json({ error: 'Rate limit exceeded (60/min)' });
    return;
  }
  timestamps.push(now);
  hits.set(key, timestamps);

  req.agent = agent;
  next();
}
