# Local Development

This guide is the public-safe local setup path for Civilis.

## Prerequisites

- Node.js 18+
- pnpm
- PostgreSQL 16+
- Docker / Docker Compose optional

## Install

```bash
cd src
pnpm install
cp .env.example .env
docker compose up -d postgres
pnpm build
```

For local compile / build / contract test flows, the public `.env.example`
intentionally leaves deployment private keys blank. That is expected. Fill
private keys only in your own private env file when you are testing deployment
or funded on-chain write paths.

## Run

Open three terminals inside `src/`:

```bash
pnpm dev:server
pnpm dev:agent
pnpm dev:dashboard
```

Useful health checks:

- dashboard: `http://localhost:3000`
- server: `http://localhost:3001/health`

## Main Commands

```bash
pnpm build
pnpm build:contracts
pnpm test:contracts
pnpm dev:server
pnpm dev:agent
pnpm dev:dashboard
pnpm mainnet:preflight
pnpm --filter @agentverse/server type-check
```

## Environment Templates

Use:

- [`src/.env.example`](../../src/.env.example)
- [`src/.env.mainnet.release.example`](../../src/.env.mainnet.release.example)

These files intentionally contain placeholders only. Operator-specific secrets,
keys, and filled deployment env files stay private.
