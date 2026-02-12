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
const sessionGen = new Map();
const BOOT_ID = crypto.randomUUID().slice(0, 8);

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
            const newText = msg.payload.data.text;
            if (p.streamRes && !p.streamRes.writableEnded) {
              const prev = p.lastText || '';
              const delta = newText.slice(prev.length);
              if (delta) {
                p.streamRes.write(JSON.stringify({ type: 'delta', text: delta }) + '\n');
              }
            }
            p.lastText = newText;
            if (p.noDataTimer) { clearTimeout(p.noDataTimer); p.noDataTimer = null; }
          }
        }
        return;
      }

      if (msg.type === 'res' && pending.has(msg.id)) {
        const p = pending.get(msg.id);
        if (msg.ok && msg.payload?.status === 'accepted') {
          p.runId = msg.payload.runId;
          p.noDataTimer = setTimeout(() => {
            if (p.lastText || !pending.has(msg.id)) return;
            console.log(`[adapter] No data 15s after accept, assuming context overflow`);
            pending.delete(msg.id);
            if (p.retryCtx) {
              const ctx = p.retryCtx;
              rotateSession(ctx.agentId, ctx.sessionId);
              sendAgentMessage(ctx.message, ctx.sessionId, {
                agentId: ctx.agentId, systemPrompt: ctx.systemPrompt,
                streamRes: ctx.streamRes, _retried: true,
              }).then(p.resolve).catch(p.reject);
            } else {
              p.reject(new Error('Context overflow'));
            }
          }, 15_000);
          return;
        }
        if (p.noDataTimer) { clearTimeout(p.noDataTimer); p.noDataTimer = null; }
        if (msg.ok) {
          const result = msg.payload?.result;
          const resultText = typeof result === 'string' ? result : result?.text || result?.output || '';
          const output = resultText || p.lastText || msg.payload?.text || '';
          if (p.streamRes && !p.streamRes.writableEnded) {
            p.streamRes.write(JSON.stringify({ type: 'done', text: output }) + '\n');
            p.streamRes.end();
          }
          p.resolve(output);
          pending.delete(msg.id);
        } else {
          const errMsg = msg.error?.message || JSON.stringify(msg.error) || 'Agent error';
          if (isContextOverflow(errMsg) && p.retryCtx) {
            console.log(`[adapter] Context overflow detected, rotating session and retrying`);
            const ctx = p.retryCtx;
            pending.delete(msg.id);
            rotateSession(ctx.agentId, ctx.sessionId);
            sendAgentMessage(ctx.message, ctx.sessionId, {
              agentId: ctx.agentId,
              systemPrompt: ctx.systemPrompt,
              streamRes: ctx.streamRes,
              _retried: true,
            }).then(p.resolve).catch(p.reject);
            return;
          }
          if (p.streamRes && !p.streamRes.writableEnded) {
            p.streamRes.write(JSON.stringify({ type: 'error', error: errMsg }) + '\n');
            p.streamRes.end();
          }
          p.reject(new Error(errMsg));
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

function getSessionKey(agentId, sessionId) {
  const base = `agent:${agentId}:webchat:dm:${BOOT_ID}:${sessionId || 'default'}`;
  const gen = sessionGen.get(base) || 0;
  return gen > 0 ? `${base}:g${gen}` : base;
}

function rotateSession(agentId, sessionId) {
  const base = `agent:${agentId}:webchat:dm:${BOOT_ID}:${sessionId || 'default'}`;
  const gen = (sessionGen.get(base) || 0) + 1;
  sessionGen.set(base, gen);
  console.log(`[adapter] Rotated session ${base} to generation ${gen}`);
  return `${base}:g${gen}`;
}

function isContextOverflow(errMsg) {
  return errMsg && (
    errMsg.includes('exceed context limit') ||
    errMsg.includes('context_length_exceeded') ||
    errMsg.includes('max_tokens')
  );
}

function sendAgentMessage(message, sessionId, { agentId = 'public', systemPrompt, streamRes, _retried = false, timeout = 300_000 } = {}) {
  if (!connected || !ws) return Promise.reject(new Error('Gateway not connected'));

  const id = String(++reqCounter);
  const idempotencyKey = crypto.randomUUID();
  const sessionKey = getSessionKey(agentId, sessionId);

  return new Promise((resolve, reject) => {
    const staleTimer = setTimeout(() => {
      const p = pending.get(id);
      if (!p) return;
      console.log(`[adapter] No response after ${timeout/1000}s for req ${id}, clearing`);
      pending.delete(id);
      if (p.streamRes && !p.streamRes.writableEnded) {
        p.streamRes.write(JSON.stringify({ type: 'error', error: 'Agent did not respond' }) + '\n');
        p.streamRes.end();
      }
      reject(new Error('Agent did not respond'));
    }, timeout);

    pending.set(id, {
      resolve: (v) => { clearTimeout(staleTimer); resolve(v); },
      reject: (e) => { clearTimeout(staleTimer); reject(e); },
      runId: null,
      lastText: null,
      lastEvent: Date.now(),
      streamRes: streamRes || null,
      retryCtx: _retried ? null : { message, sessionId, agentId, systemPrompt, streamRes },
    });

    const params = {
      message,
      agentId,
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
        const { input, context, systemPrompt, sessionId, stream } = JSON.parse(body);
        if (!input) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'input is required' }));
          return;
        }

        let message = input;
        if (context && Object.keys(context).length > 0) {
          message = `Context:\n${JSON.stringify(context, null, 2)}\n\n${input}`;
        }

        if (stream) {
          res.writeHead(200, {
            'Content-Type': 'application/x-ndjson',
            'Transfer-Encoding': 'chunked',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          });
          await sendAgentMessage(message, sessionId, { agentId: 'public', systemPrompt, streamRes: res });
        } else {
          const output = await sendAgentMessage(message, sessionId, { agentId: 'public', systemPrompt });
          res.end(JSON.stringify({ output }));
        }
      } catch (err) {
        console.error('[adapter] Error:', err.message);
        if (!res.headersSent) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: err.message }));
        }
      }
    });
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

// Telegram long-polling bot (bypasses OpenClaw's Telegram plugin)
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OPERATOR_TG = (process.env.OPERATOR_TELEGRAM || '').toLowerCase();
let tgOffset = 0;

async function tgApi(method, body) {
  const opts = { method: 'POST', headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/${method}`, opts);
  return r.json();
}

async function tgSend(chatId, text) {
  const MAX = 4096;
  for (let i = 0; i < text.length; i += MAX) {
    await tgApi('sendMessage', { chat_id: chatId, text: text.slice(i, i + MAX) });
  }
}

async function handleTgMessage(chatId, text, sessionId, agentId) {
  let acked = false;
  const ackTimer = setTimeout(async () => {
    acked = true;
    await tgSend(chatId, 'Working on it...').catch(() => {});
  }, 30_000);

  try {
    const output = await sendAgentMessage(text, sessionId, { agentId, timeout: 30 * 60_000 });
    clearTimeout(ackTimer);
    if (output) {
      await tgSend(chatId, output);
    } else if (!acked) {
      await tgSend(chatId, '(no response)');
    }
  } catch (err) {
    clearTimeout(ackTimer);
    if (isContextOverflow(err.message)) {
      console.log(`[telegram] Context overflow for ${sessionId}, starting fresh session`);
      rotateSession(agentId, sessionId);
      try {
        const output = await sendAgentMessage(text, sessionId, { agentId, _retried: true, timeout: 30 * 60_000 });
        if (output) await tgSend(chatId, output);
      } catch (retryErr) {
        console.error('[telegram] Retry failed:', retryErr.message);
        await tgSend(chatId, `Task failed: ${retryErr.message}`).catch(() => {});
      }
    } else {
      console.error('[telegram] Agent error:', err.message);
      await tgSend(chatId, `Error: ${err.message}`).catch(() => {});
    }
  }
}

async function tgPoll() {
  if (!TG_TOKEN || !connected) return;
  try {
    const data = await tgApi('getUpdates', { offset: tgOffset, timeout: 30, allowed_updates: ['message'] });
    if (!data.ok || !data.result?.length) return;
    for (const update of data.result) {
      tgOffset = update.update_id + 1;
      const msg = update.message;
      if (!msg?.text) continue;
      const chatId = msg.chat.id;
      const username = (msg.from?.username || '').toLowerCase();
      const isOperator = OPERATOR_TG && (username === OPERATOR_TG || String(chatId) === OPERATOR_TG);
      const role = isOperator ? 'operator' : 'public';
      const sessionId = `tg-${chatId}`;
      console.log(`[telegram] ${role} message from @${username || chatId}: ${msg.text.slice(0, 80)}`);
      // Fire async — don't block the poll loop
      handleTgMessage(chatId, msg.text, sessionId, role).catch(err => {
        console.error('[telegram] Unhandled:', err.message);
      });
    }
  } catch (err) {
    if (!err.message?.includes('ETIMEDOUT')) console.error('[telegram] Poll error:', err.message);
  }
}

async function tgLoop() {
  if (!TG_TOKEN) return;
  // Delete any existing webhook so long-polling works
  await tgApi('deleteWebhook').catch(() => {});
  const me = await tgApi('getMe').catch(() => null);
  console.log(`[telegram] Bot started: @${me?.result?.username || 'unknown'}`);
  while (true) {
    await tgPoll();
    await new Promise(r => setTimeout(r, 500));
  }
}

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

  tgLoop().catch(err => console.error('[telegram] Fatal:', err.message));
}

start();
