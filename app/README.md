# BlockHelix Frontend

Next.js app for blockhelix.tech: marketing site plus the vault-creation flow.
Users sign up with Clerk, enter a Gnosis Safe as vault admin (no wallet
connection — the Safe is a validated address input), and deploy a USDC vault
on Base through the vault-factory API (`https://api.blockhelix.tech`).

## Setup

```bash
npm ci --legacy-peer-deps
cp .env.example .env.local   # then fill in real values
npm run dev
```

### Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | client | Clerk publishable key |
| `CLERK_SECRET_KEY` | server | Clerk secret key |
| `VAULT_API_URL` | server | Vault-factory API base URL (default `https://api.blockhelix.tech`) |
| `VAULT_API_KEY` | server | Vault-factory `X-API-Key`. Server-only — never expose to the browser |
| `NEXT_PUBLIC_BASE_RPC_URL` | client | Base RPC for Safe preflight checks (default `https://mainnet.base.org`) |
| `RESEND_API_KEY` / `RESEND_AUDIENCE_ID` | server | Waitlist form (existing) |

Without the Clerk vars the marketing pages still build and render; `/dashboard`
and `/api/vaults/*` return 503 and the sign-in pages show a "not configured"
notice.

### Clerk app setup (one-time, manual)

1. Create an application at https://dashboard.clerk.com (email sign-in).
2. Enable **Passkeys** under User & Authentication → Email, Phone, Username →
   Authentication strategies.
3. Enable **Two-step verification**: Authenticator app (TOTP) and Backup codes
   under User & Authentication → Multi-factor.
4. Copy the publishable + secret keys into the env vars above (Amplify console
   for deployed branches, `.env.local` for local dev).

## Vault-creation flow

- `/sign-up`, `/sign-in` — Clerk components, themed to the site.
- `/dashboard` — lists the user's deployments (ids stored in Clerk
  `privateMetadata.vaultDeployments`, statuses fetched via the proxy).
- `/dashboard/new-vault` — form; the admin address is validated client-side
  against Base (`getCode` + Safe `getOwners/getThreshold/VERSION`) before
  submit, and re-validated on-chain by the vault-factory API.
- `/dashboard/vaults/[id]` — polls the deployment every 5s through
  `queued → validating → simulating → broadcasting → confirming → verifying →
  complete | failed`, then shows component addresses with Basescan links.
- `/api/vaults` + `/api/vaults/[id]` — Node route handlers that require a
  Clerk session, enforce the 1-free-vault quota, and proxy to the vault-factory
  API with the server-side `X-API-Key`. Base asset is pinned server-side to
  USDC on Base (8453) for v1.

Quota note: the check-then-update on Clerk metadata is not transactional; two
simultaneous POSTs could both pass. Accepted for v1. The per-user rate limit is
in-memory per server instance (soft brake only).

## Deployment

Amplify builds from `amplify.yml` (`npm ci --legacy-peer-deps && npm run build`,
appRoot `app`). `main` auto-deploys to blockhelix.tech — set the env vars in
the Amplify console **before** merging Clerk changes to `main`.

## Legacy

`scripts/verify-onchain.ts` (`npm run verify`) and `src/lib/{anchor,pda,idl}`
are left over from the Solana hackathon programs and are not used by the web
app.
