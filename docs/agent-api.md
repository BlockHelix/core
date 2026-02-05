# BlockHelix Agent API

API documentation for BlockHelix agents. All paid endpoints use the [x402 protocol](https://x402.org/) for HTTP-native payments.

## Quick Start

```bash
# 1. Try without payment (get 402 response with payment details)
curl -X POST https://agent.blockhelix.io/v1/agent/defi-assistant/run \
  -H "Content-Type: application/json" \
  -d '{"input": "Explain reentrancy attacks"}'

# 2. Server returns 402 with payment requirements
# 3. Pay via x402 facilitator (see Payment Flow below)
# 4. Retry with payment proof
curl -X POST https://agent.blockhelix.io/v1/agent/defi-assistant/run \
  -H "Content-Type: application/json" \
  -H "X-Payment-Response: <payment-proof>" \
  -d '{"input": "Explain reentrancy attacks"}'
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `ANTHROPIC_API_KEY` | Claude API key | Yes |
| `AGENT_WALLET_ADDRESS` | Solana wallet for receiving payments | Yes |
| `GITHUB_TOKEN` | GitHub PAT for PR creation (Patch Agent) | No |
| `SOLANA_NETWORK` | `devnet` or `mainnet` (default: devnet) | No |
| `X402_FACILITATOR_URL` | x402 facilitator (default: https://x402.org/facilitator) | No |
| `ADMIN_SECRET` | Bearer token for admin endpoints | No |

---

## Hosted Runtime API (Tier 1)

The hosted runtime executes inference agents with configurable system prompts. Agents are registered with specific pricing and routed through x402 payment gates.

**Base URL:** `https://agent.blockhelix.io` (or your deployment)

### GET /health

Service status and list of hosted agents.

**Price:** Free

**Response:**
```json
{
  "status": "ok",
  "service": "BlockHelix Agent Runtime",
  "version": "0.1.0",
  "network": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
  "hostedAgents": [
    {
      "agentId": "defi-assistant",
      "name": "DeFi Assistant",
      "price": "$0.10 USDC",
      "active": true
    }
  ]
}
```

---

### GET /v1/agents

List all hosted agents (public info only).

**Price:** Free

**Response:**
```json
{
  "agents": [
    {
      "agentId": "defi-assistant",
      "name": "DeFi Assistant",
      "priceUsdcMicro": 100000,
      "model": "claude-sonnet-4-20250514",
      "isActive": true
    }
  ]
}
```

---

### GET /v1/agent/:agentId

Get details for a specific agent.

**Price:** Free

**Path Parameters:**
- `agentId` - Agent identifier

**Response:**
```json
{
  "agentId": "defi-assistant",
  "name": "DeFi Assistant",
  "priceUsdcMicro": 100000,
  "model": "claude-sonnet-4-20250514",
  "isActive": true,
  "vault": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "registry": "9yMwrDqHpmmWBFxRTjMvJpNmWUp2uGkLhPDVYJqRmGuN"
}
```

**Errors:**
- `404` - Agent not found

---

### POST /v1/agent/:agentId/run

Run a hosted inference agent.

**Price:** Agent-configured (typically $0.01 - $1.00 USDC)

**Path Parameters:**
- `agentId` - Agent identifier

**Request:**
```json
{
  "input": "Your question or request",
  "context": {
    "optional": "Additional context data"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `input` | string | Yes | The prompt/question for the agent |
| `context` | object | No | Additional context passed to the agent |

**Response:**
```json
{
  "output": "The agent's response text...",
  "agentId": "defi-assistant",
  "jobId": 7,
  "receiptTx": "5xYz...abc",
  "revenueTx": "3wKp...def"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `output` | string | Agent's response |
| `agentId` | string | Agent identifier |
| `jobId` | number \| null | On-chain job receipt ID |
| `receiptTx` | string \| null | Receipt recording transaction signature |
| `revenueTx` | string \| null | Revenue routing transaction signature |

**Errors:**
- `400` - Invalid input
- `402` - Payment required (see x402 flow)
- `403` - Agent not active
- `404` - Agent not found
- `500` - Execution failed

---

### POST /v1/test

Test an agent prompt without payment (rate limited).

**Price:** Free (5 requests/minute per IP)

**Request:**
```json
{
  "systemPrompt": "You are a helpful DeFi assistant...",
  "input": "What is impermanent loss?"
}
```

| Field | Type | Required | Max Length | Description |
|-------|------|----------|------------|-------------|
| `systemPrompt` | string | Yes | 10,000 chars | System prompt to test |
| `input` | string | Yes | 2,000 chars | User input |

**Response:**
```json
{
  "output": "Impermanent loss occurs when...",
  "model": "claude-sonnet-4-20250514",
  "tokensUsed": 847
}
```

**Errors:**
- `400` - Missing or invalid fields
- `429` - Rate limit exceeded

---

### POST /admin/agents

Register a new hosted agent (admin only).

**Price:** Free (requires auth)

**Headers:**
```
Authorization: Bearer <ADMIN_SECRET>
```

**Request:**
```json
{
  "agentId": "my-agent",
  "name": "My Custom Agent",
  "systemPrompt": "You are a helpful assistant specialized in...",
  "agentWallet": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "priceUsdcMicro": 100000,
  "model": "claude-sonnet-4-20250514",
  "vault": "optional-vault-address",
  "registry": "optional-registry-address",
  "isActive": true
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `agentId` | string | Yes | - | Unique identifier |
| `name` | string | Yes | - | Display name |
| `systemPrompt` | string | Yes | - | Agent's system prompt |
| `agentWallet` | string | Yes | - | Solana wallet for payments |
| `priceUsdcMicro` | number | No | 100000 | Price in USDC micro-units ($0.10) |
| `model` | string | No | claude-sonnet-4-20250514 | Claude model |
| `vault` | string | No | "" | On-chain vault address |
| `registry` | string | No | "" | On-chain registry address |
| `isActive` | boolean | No | true | Whether agent accepts requests |

**Response:**
```json
{
  "message": "Agent registered",
  "agent": {
    "agentId": "my-agent",
    "name": "My Custom Agent",
    "priceUsdcMicro": 100000,
    "model": "claude-sonnet-4-20250514",
    "isActive": true
  }
}
```

**Errors:**
- `400` - Missing required fields
- `401` - Unauthorized
- `409` - Agent already exists
- `503` - Admin API not configured

---

### GET /admin/agents

List all agents with full details (admin only).

**Price:** Free (requires auth)

**Headers:**
```
Authorization: Bearer <ADMIN_SECRET>
```

**Response:**
```json
{
  "agents": [
    {
      "agentId": "defi-assistant",
      "name": "DeFi Assistant",
      "systemPrompt": "You are a DeFi expert...",
      "priceUsdcMicro": 100000,
      "model": "claude-sonnet-4-20250514",
      "agentWallet": "7xKXtg...",
      "vault": "9yMwr...",
      "registry": "3wKp...",
      "isActive": true
    }
  ]
}
```

---

## Patch Agent API (Tier 2 Reference)

The DefiData Patch Agent is a specialized Tier 2 agent that performs code security analysis and generates patches for DeFi vulnerabilities.

**Base URL:** `https://patch.blockhelix.io` (or your deployment)

### GET /health

Service status.

**Price:** Free

**Response:**
```json
{
  "status": "ok",
  "agent": "DefiData Patch Agent",
  "version": "0.2.0",
  "x402": "v2",
  "endpoints": {
    "/analyze": {
      "method": "POST",
      "price": "$0.05 USDC",
      "description": "DeFi code analysis"
    },
    "/patch": {
      "method": "POST",
      "price": "$0.10 USDC",
      "description": "Patch generation + optional PR"
    }
  },
  "network": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
  "wallet": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
}
```

---

### POST /analyze

Analyze a GitHub repository for DeFi security vulnerabilities.

**Price:** $0.05 USDC

**Request:**
```json
{
  "repoUrl": "https://github.com/owner/repo",
  "filePath": "programs/vault/src/lib.rs",
  "focus": "Access control and arithmetic overflow"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `repoUrl` | string | Yes | GitHub repository URL |
| `filePath` | string | No | Specific file to analyze (analyzes full repo if omitted) |
| `focus` | string | No | Focus area for analysis |

**Response:**
```json
{
  "analysis": "The codebase implements a DeFi vault with several security concerns...",
  "issues": [
    {
      "severity": "high",
      "title": "Missing overflow check in deposit calculation",
      "description": "The deposit function uses unchecked multiplication which can overflow...",
      "location": "programs/vault/src/lib.rs:calculate_shares",
      "recommendation": "Use checked_mul() or Rust's checked arithmetic"
    },
    {
      "severity": "medium",
      "title": "Authority check missing on withdraw",
      "description": "The withdraw instruction does not verify...",
      "location": "programs/vault/src/lib.rs:withdraw",
      "recommendation": "Add require!(ctx.accounts.authority.key() == vault.authority)"
    }
  ],
  "riskScore": 72,
  "filesAnalyzed": [
    "programs/vault/src/lib.rs",
    "programs/vault/src/state.rs"
  ],
  "onChain": {
    "revenueRouted": true,
    "revenueTx": "5xYz...abc",
    "receiptRecorded": true,
    "receiptTx": "3wKp...def",
    "jobId": 42,
    "artifactHash": "a1b2c3d4..."
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `analysis` | string | High-level summary of findings |
| `issues` | array | List of identified issues |
| `issues[].severity` | string | `critical`, `high`, `medium`, `low`, or `info` |
| `issues[].title` | string | Brief issue title |
| `issues[].description` | string | Detailed description |
| `issues[].location` | string | File and line/function |
| `issues[].recommendation` | string | How to fix |
| `riskScore` | number | Overall risk score (0-100) |
| `filesAnalyzed` | array | List of files analyzed |
| `onChain` | object | On-chain receipt data |

**Errors:**
- `400` - Missing repoUrl or non-GitHub URL
- `402` - Payment required
- `500` - Analysis failed

---

### POST /patch

Generate a code patch and optionally create a GitHub PR.

**Price:** $0.10 USDC

**Request:**
```json
{
  "repoUrl": "https://github.com/owner/repo",
  "filePath": "programs/vault/src/lib.rs",
  "issueDescription": "Missing overflow check in deposit calculation - use checked_mul()",
  "createPr": true
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `repoUrl` | string | Yes | GitHub repository URL |
| `filePath` | string | Yes | File to patch |
| `issueDescription` | string | Yes | Description of the issue to fix |
| `createPr` | boolean | No | Create a GitHub PR (requires GITHUB_TOKEN) |

**Response:**
```json
{
  "patch": "--- a/programs/vault/src/lib.rs\n+++ b/programs/vault/src/lib.rs\n@@ -45,7 +45,7 @@\n-    let shares = amount * total_shares / total_assets;\n+    let shares = amount.checked_mul(total_shares)?.checked_div(total_assets)?;",
  "explanation": "Changed unchecked multiplication to checked_mul() and checked_div() to prevent arithmetic overflow in share calculation.",
  "affectedFiles": [
    "programs/vault/src/lib.rs"
  ],
  "pullRequest": {
    "prUrl": "https://github.com/owner/repo/pull/123",
    "prNumber": 123,
    "branchName": "blockhelix/patch-1707134400000"
  },
  "onChain": {
    "revenueRouted": true,
    "revenueTx": "5xYz...abc",
    "receiptRecorded": true,
    "receiptTx": "3wKp...def",
    "jobId": 43,
    "artifactHash": "e5f6g7h8..."
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `patch` | string | Unified diff format patch |
| `explanation` | string | What was changed and why |
| `affectedFiles` | array | Files modified by the patch |
| `pullRequest` | object \| null | PR details (if createPr was true) |
| `pullRequest.prUrl` | string | GitHub PR URL |
| `pullRequest.prNumber` | number | PR number |
| `pullRequest.branchName` | string | Branch created for the PR |
| `onChain` | object | On-chain receipt data |

**Errors:**
- `400` - Missing required fields or non-GitHub URL
- `402` - Payment required
- `500` - Patch generation failed

---

## x402 Payment Flow

BlockHelix uses the [x402 protocol](https://x402.org/) for HTTP-native payments. Here's how it works:

### 1. Request Without Payment

```bash
curl -X POST https://agent.blockhelix.io/v1/agent/defi-assistant/run \
  -H "Content-Type: application/json" \
  -d '{"input": "Hello"}'
```

### 2. Receive 402 Response

```json
{
  "error": "Payment Required",
  "accepts": {
    "scheme": "exact",
    "price": "$0.10",
    "network": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
    "payTo": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
  },
  "facilitator": "https://x402.org/facilitator"
}
```

### 3. Pay via Facilitator

Send payment details to the x402 facilitator:

```bash
curl -X POST https://x402.org/facilitator/pay \
  -H "Content-Type: application/json" \
  -d '{
    "network": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
    "payTo": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "amount": "100000",
    "payer": "<your-wallet-address>",
    "signature": "<transaction-signature>"
  }'
```

The facilitator returns a payment proof.

### 4. Retry with Payment Proof

```bash
curl -X POST https://agent.blockhelix.io/v1/agent/defi-assistant/run \
  -H "Content-Type: application/json" \
  -H "X-Payment-Response: <payment-proof-from-facilitator>" \
  -d '{"input": "Hello"}'
```

### Using x402 SDK

For programmatic access, use the x402 client SDK:

```typescript
import { x402Client } from '@x402/client';
import { Connection, Keypair } from '@solana/web3.js';

const connection = new Connection('https://api.devnet.solana.com');
const wallet = Keypair.fromSecretKey(/* your key */);

const client = x402Client({
  facilitatorUrl: 'https://x402.org/facilitator',
  network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
  payer: wallet.publicKey.toBase58(),
  signTransaction: async (tx) => {
    tx.sign(wallet);
    return tx;
  },
  connection,
});

// Automatically handles 402 responses and payment
const response = await client.fetch(
  'https://agent.blockhelix.io/v1/agent/defi-assistant/run',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: 'Explain flash loans' }),
  }
);

const data = await response.json();
console.log(data.output);
```

---

## Error Codes

| Code | Description |
|------|-------------|
| `400` | Bad Request - Missing or invalid parameters |
| `401` | Unauthorized - Invalid or missing admin credentials |
| `402` | Payment Required - x402 payment needed |
| `403` | Forbidden - Agent not active or access denied |
| `404` | Not Found - Agent or resource not found |
| `409` | Conflict - Resource already exists |
| `429` | Too Many Requests - Rate limit exceeded |
| `500` | Internal Server Error - Execution failed |
| `503` | Service Unavailable - Feature not configured |

---

## On-Chain Integration

All paid requests generate on-chain receipts and route revenue to the agent's vault.

### Receipt Registry

Each job creates an immutable `JobReceipt` on Solana:

```typescript
interface JobReceipt {
  registry: PublicKey;      // Registry PDA
  jobId: number;            // Auto-incrementing job ID
  artifactHash: Uint8Array; // SHA-256 hash of the response
  paymentAmount: number;    // Amount paid (USDC micro-units)
  paymentTx: Uint8Array;    // x402 payment transaction signature
  status: 'Active' | 'Challenged' | 'Resolved' | 'Rejected';
  createdAt: number;        // Unix timestamp
}
```

### Revenue Routing

Revenue is automatically split via the AgentVault program:

- **Agent share:** 70% (configurable)
- **Protocol share:** 5% minimum
- **Vault depositors share:** 25%

Vault depositors can invest USDC and receive proportional share tokens representing their stake in the agent's future revenue.

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| `/v1/test` | 5 requests/minute per IP |
| Paid endpoints | No limit (pay per request) |
| Admin endpoints | No limit (authenticated) |

---

## Networks

| Network | CAIP-2 Identifier |
|---------|-------------------|
| Solana Devnet | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` |
| Solana Mainnet | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` |

Default: Devnet (set `SOLANA_NETWORK=mainnet` for production)

---

## USDC Amounts

All monetary amounts use USDC with 6 decimal places:

| Display | Micro-units |
|---------|-------------|
| $0.01 | 10,000 |
| $0.05 | 50,000 |
| $0.10 | 100,000 |
| $1.00 | 1,000,000 |

USDC Mint (Devnet): `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`
