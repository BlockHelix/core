import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './server';
import { loadAgentsFromStorage } from './services/storage';

const PORT = process.env.PORT || 3002;

// Load agents from persistent storage (operator-created via dashboard)
loadAgentsFromStorage();

const app = createApp();

app.listen(PORT, () => {
  console.log(`BlockHelix Agent Runtime running on port ${PORT}`);
  console.log(`Network: ${NETWORK}`);
  console.log(`Endpoints:`);
  console.log(`  GET  /health               - Service health`);
  console.log(`  GET  /v1/agents            - List hosted agents`);
  console.log(`  GET  /v1/agent/:id         - Agent details`);
  console.log(`  POST /v1/agent/:id/run     - Run agent (x402 payment required)`);
});
