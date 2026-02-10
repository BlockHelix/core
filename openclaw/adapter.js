const http = require('http');
const crypto = require('crypto');

const PORT = process.env.PORT || 3001;
const AGENT_ID = process.env.AGENT_ID || 'unknown';
const GATEWAY_PORT = 18789;
const GATEWAY_AUTH = process.env.GATEWAY_AUTH_TOKEN || 'default-local-token';
const GATEWAY_URL = `ws://127.0.0.1:${GATEWAY_PORT}`;

let ws = null;
let connected = false;
let reqCounter = 0;
const pending = new Map();

function connectGateway() {
  return new Promise((resolve, reject) => {
    const WebSocket = require('ws');
    ws = new WebSocket(GATEWAY_URL);
    let handshakeDone = false;

    ws.on('open', () => {
      console.log('[adapter] WS connected to gateway');
    });

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }

      if (msg.type === 'event' && msg.event === 'connect.challenge') {
        ws.send(JSON.stringify({
          type: 'req',
          id: '_connect',
          method: 'connect',
          params: {
            minProtocol: 3,
            maxProtocol: 3,
            client: { id: 'cli', version: '1.0.0', platform: 'linux', mode: 'cli' },
            scopes: ['operator.read', 'operator.write'],
            auth: { token: GATEWAY_AUTH },
          },
        }));
        return;
      }

      if (msg.type === 'res' && msg.id === '_connect') {
        if (msg.ok) {
          connected = true;
          handshakeDone = true;
          console.log('[adapter] Gateway handshake complete');
          resolve();
        } else {
          reject(new Error(`Gateway connect failed: ${JSON.stringify(msg.error)}`));
        }
        return;
      }

      if (msg.type === 'event' && msg.event === 'agent') {
        const runId = msg.payload?.runId;
        if (!runId) return;
        for (const [id, p] of pending) {
          if (p.runId === runId && msg.payload?.data?.text) {
            p.chunks.push(msg.payload.data.text);
          }
        }
        return;
      }

      if (msg.type === 'res' && pending.has(msg.id)) {
        const p = pending.get(msg.id);
        if (msg.ok && msg.payload?.status === 'accepted') {
          p.runId = msg.payload.runId;
          return;
        }
        if (msg.ok) {
          const summary = msg.payload?.summary || p.chunks.join('') || msg.payload?.text || '';
          p.resolve(summary);
          pending.delete(msg.id);
        } else {
          p.reject(new Error(msg.error?.message || JSON.stringify(msg.error) || 'Agent error'));
          pending.delete(msg.id);
        }
        return;
      }
    });

    ws.on('close', () => {
      console.log('[adapter] WS closed, reconnecting in 2s...');
      connected = false;
      setTimeout(() => connectGateway().catch(console.error), 2000);
    });

    ws.on('error', (err) => {
      console.error('[adapter] WS error:', err.message);
      if (!handshakeDone) reject(err);
    });

    setTimeout(() => {
      if (!handshakeDone) reject(new Error('Gateway handshake timeout'));
    }, 15000);
  });
}

function sendAgentMessage(message, sessionId, systemPrompt) {
  if (!connected || !ws) return Promise.reject(new Error('Gateway not connected'));

  const id = String(++reqCounter);
  const idempotencyKey = crypto.randomUUID();
  const sessionKey = `agent:public:webchat:dm:${sessionId || 'default'}`;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('Agent response timeout (120s)'));
    }, 120_000);

    pending.set(id, {
      resolve: (val) => { clearTimeout(timer); resolve(val); },
      reject: (err) => { clearTimeout(timer); reject(err); },
      runId: null,
      chunks: [],
    });

    const params = {
      message,
      agentId: 'public',
      sessionKey,
      idempotencyKey,
      deliver: false,
    };
    if (systemPrompt) params.extraSystemPrompt = systemPrompt;

    ws.send(JSON.stringify({ type: 'req', id, method: 'agent', params }));
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'GET' && req.url === '/health') {
    try {
      const gwResp = await fetch(`http://localhost:${GATEWAY_PORT}/health`);
      if (gwResp.ok) {
        const gwData = await gwResp.json().catch(() => ({}));
        res.end(JSON.stringify({
          status: 'ok', agentId: AGENT_ID, type: 'openclaw', gateway: true, ws: connected,
          heartbeat: process.env.HEARTBEAT_ENABLED === 'true',
          heartbeatInterval: process.env.HEARTBEAT_INTERVAL || '30m',
          ...gwData,
        }));
      } else {
        res.writeHead(503);
        res.end(JSON.stringify({ status: 'gateway_unhealthy', agentId: AGENT_ID }));
      }
    } catch {
      res.writeHead(503);
      res.end(JSON.stringify({ status: 'gateway_unreachable', agentId: AGENT_ID }));
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/v1/run') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      try {
        const { input, context, systemPrompt, sessionId } = JSON.parse(body);
        if (!input) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'input is required' }));
          return;
        }

        let message = input;
        if (context && Object.keys(context).length > 0) {
          message = `Context:\n${JSON.stringify(context, null, 2)}\n\n${input}`;
        }

        const output = await sendAgentMessage(message, sessionId, systemPrompt);
        res.end(JSON.stringify({ output }));
      } catch (err) {
        console.error('[adapter] Error:', err.message);
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

async function start() {
  try {
    await connectGateway();
  } catch (err) {
    console.error('[adapter] Initial gateway connection failed:', err.message);
    console.log('[adapter] Will retry on first request');
  }

  server.listen(PORT, () => {
    console.log(`[adapter] OpenClaw WS adapter listening on :${PORT}`);
  });
}

start();
