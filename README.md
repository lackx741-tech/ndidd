<div align="center">

# NDIDD

**A production-ready Web3 monorepo — smart contracts, indexing, backend API, and frontend in one place.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node ≥ 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![pnpm ≥ 8](https://img.shields.io/badge/pnpm-%3E%3D8-orange)](https://pnpm.io)
[![Turborepo](https://img.shields.io/badge/built%20with-Turborepo-EF4444)](https://turbo.build)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6)](https://www.typescriptlang.org)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Local Development](#local-development)
- [Smart Contracts](#smart-contracts)
- [Subgraph](#subgraph)
- [Deployment](#deployment)
- [Environment Variables](#environment-variables)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

NDIDD is a full-stack Web3 application monorepo. It ships a Solidity smart contract suite, a
Graph Protocol subgraph for on-chain data indexing, a Node.js API backend, and a Next.js
frontend — all sharing code through a suite of internal TypeScript packages.

The repo is designed for teams: enforced linting, formatting, type safety, commit hooks, and a
Turborepo pipeline ensure every workspace stays consistent regardless of size.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        NDIDD Monorepo                           │
│                                                                 │
│  ┌──────────────────────┐   ┌───────────────────────────────┐  │
│  │    apps/web (Next.js) │   │     apps/api  (Node / Fastify)│  │
│  │  - React / wagmi      │   │  - REST + WebSocket endpoints │  │
│  │  - RainbowKit         │   │  - Prisma ORM (PostgreSQL)    │  │
│  │  - TanStack Query     │   │  - BullMQ task queue (Redis)  │  │
│  └──────────┬───────────┘   └───────────────┬───────────────┘  │
│             │                               │                   │
│             │   @ndidd/sdk  @ndidd/types    │                   │
│             │   @ndidd/ui   @ndidd/config   │                   │
│             └──────────────┬────────────────┘                   │
│                            │                                    │
│  ┌─────────────────────────▼──────────────────────────────┐    │
│  │               packages/ (shared libraries)              │    │
│  │  ┌─────────┐ ┌─────────┐ ┌───────┐ ┌────────────────┐ │    │
│  │  │   sdk   │ │  types  │ │  ui   │ │    config      │ │    │
│  │  │ (ABIs + │ │(shared  │ │(React │ │ (ESLint/TS/    │ │    │
│  │  │TypeChain│ │ TS types│ │  cmp) │ │  Prettier base)│ │    │
│  │  └─────────┘ └─────────┘ └───────┘ └────────────────┘ │    │
│  └────────────────────────────────────────────────────────┘    │
│                            │                                    │
│  ┌─────────────────────────▼──────────────────────────────┐    │
│  │               On-Chain Layer                            │    │
│  │                                                         │    │
│  │  ┌──────────────────────┐   ┌─────────────────────┐    │    │
│  │  │  packages/contracts  │   │      subgraph/       │    │    │
│  │  │  (Hardhat + Solidity)│   │ (The Graph Protocol) │    │    │
│  │  │  - ERC-20 Token      │   │  - event handlers    │    │    │
│  │  │  - Staking           │   │  - GraphQL schema    │    │    │
│  │  │  - Governance        │   │  - AssemblyScript    │    │    │
│  │  └──────────────────────┘   └─────────────────────┘    │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
│  Infrastructure (Docker Compose)                                │
│  ┌────────────┐ ┌───────┐ ┌────────────┐ ┌──────────────────┐ │
│  │ PostgreSQL │ │ Redis │ │ Graph Node │ │ IPFS             │ │
│  └────────────┘ └───────┘ └────────────┘ └──────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Monorepo tooling** | [Turborepo](https://turbo.build), [PNPM Workspaces](https://pnpm.io/workspaces) |
| **Language** | [TypeScript 5](https://www.typescriptlang.org) (strict mode) |
| **Frontend** | [Next.js 14](https://nextjs.org) (App Router), [wagmi v2](https://wagmi.sh), [RainbowKit](https://www.rainbowkit.com), [TanStack Query](https://tanstack.com/query) |
| **Backend** | [Fastify](https://fastify.dev), [Prisma](https://www.prisma.io), [BullMQ](https://bullmq.io) |
| **Database** | [PostgreSQL 16](https://www.postgresql.org) |
| **Cache / Queue** | [Redis 7](https://redis.io) |
| **Smart Contracts** | [Hardhat](https://hardhat.org), [Solidity 0.8.x](https://soliditylang.org), [OpenZeppelin](https://openzeppelin.com/contracts), [TypeChain](https://github.com/dethcrypto/TypeChain) |
| **Indexing** | [The Graph Protocol](https://thegraph.com) (AssemblyScript) |
| **Code quality** | [ESLint](https://eslint.org), [Prettier](https://prettier.io), [Husky](https://typicode.github.io/husky), [lint-staged](https://github.com/lint-staged/lint-staged) |
| **Infrastructure** | [Docker Compose](https://docs.docker.com/compose) |

---

## Project Structure

```
ndidd/
├── apps/
│   ├── web/              # Next.js 14 frontend (App Router)
│   └── api/              # Fastify REST + WebSocket API
├── packages/
│   ├── contracts/        # Hardhat project — Solidity contracts + TypeChain
│   ├── sdk/              # Auto-generated contract SDK (ABIs, addresses, hooks)
│   ├── types/            # Shared TypeScript types and Zod schemas
│   ├── ui/               # Shared React component library
│   └── config/           # Shared ESLint / TS / Prettier configs
├── subgraph/             # The Graph subgraph (schema, mappings, manifest)
├── docker/               # Docker Compose files for local infra
├── .env.example          # Environment variable template
├── .eslintrc.js          # Root ESLint config
├── .prettierrc           # Root Prettier config
├── .nvmrc                # Node version pin (20)
├── Makefile              # Developer convenience commands
├── package.json          # Root workspace manifest
├── pnpm-workspace.yaml   # PNPM workspace packages
├── tsconfig.json         # Root (base) TypeScript config
└── turbo.json            # Turborepo pipeline config
```

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | ≥ 20 (LTS) | [nvm](https://github.com/nvm-sh/nvm) / [fnm](https://github.com/Schniz/fnm) |
| pnpm | ≥ 8 | `npm i -g pnpm` |
| Docker & Docker Compose | latest | [Docker Desktop](https://www.docker.com/products/docker-desktop) |
| make | system default | Pre-installed on macOS/Linux |

---

## Getting Started

```bash
# 1. Clone the repository
git clone https://github.com/ndidd/ndidd.git
cd ndidd

# 2. Use the correct Node version
nvm use          # reads .nvmrc (Node 20)

# 3. Install dependencies and copy .env template
make install     # runs: cp .env.example .env && pnpm install

# 4. Edit .env and fill in your API keys and secrets
$EDITOR .env

# 5. Start the local infrastructure (Postgres, Redis, Graph Node, IPFS)
make docker-up

# 6. Run database migrations and seed data
make db-migrate
make db-seed

# 7. Compile contracts and generate TypeChain types
make compile-contracts
make generate-types

# 8. Deploy contracts to the local Hardhat node
make dev-node        # (separate terminal) — starts hardhat node on :8545
make deploy-contracts NETWORK=localhost

# 9. Start all services in development mode
make dev
```

The frontend will be available at **http://localhost:3000**, the API at **http://localhost:3001**.

---

## Local Development

### Running individual services

```bash
make dev-web       # Next.js frontend — http://localhost:3000
make dev-api       # API server — http://localhost:3001
make dev-node      # Local Hardhat node — http://localhost:8545
```

### Running tests

```bash
make test                   # all workspaces
make test-contracts         # Hardhat / Foundry contract tests
make test-api               # API unit + integration tests
make test-web               # Frontend component tests (Vitest + Playwright)
```

### Linting and formatting

```bash
make lint          # ESLint (check)
make lint-fix      # ESLint (auto-fix)
make format        # Prettier (write)
make format-check  # Prettier (check only)
make typecheck     # tsc --noEmit across all workspaces
```

### Useful shortcuts

```bash
make db-studio     # Open Prisma Studio at http://localhost:5555
make docker-logs   # Tail all Docker service logs
make clean         # Remove all build artefacts and node_modules
```

---

## Smart Contracts

Contracts live in `packages/contracts/` and use the Hardhat toolchain.

```bash
# Compile
make compile-contracts

# Run tests
make test-contracts

# Deploy to localhost
make deploy-contracts NETWORK=localhost

# Deploy to a public network
make deploy-contracts NETWORK=sepolia
make deploy-contracts NETWORK=mainnet

# Verify on Etherscan/Polygonscan/etc.
make verify-contracts NETWORK=sepolia

# One-shot deploy + verify
make deploy-and-verify NETWORK=sepolia
```

> **Security note:** Never commit private keys. Use a hardware wallet or a secrets manager
> in production. The `DEPLOYER_PRIVATE_KEY` in `.env.example` is a well-known test key.

---

## Subgraph

The Graph subgraph lives in `subgraph/` and indexes on-chain events.

```bash
# Generate AssemblyScript types from the schema
make subgraph-codegen

# Build the subgraph WASM
make subgraph-build

# Deploy to the local Graph Node (requires docker-up)
make subgraph-deploy-local

# Deploy to The Graph hosted service
make subgraph-deploy
```

---

## Deployment

### Frontend (Vercel)

1. Connect the `apps/web` directory as the Vercel project root.
2. Set the build command to `cd ../.. && pnpm turbo run build --filter=@ndidd/web`.
3. Populate the required `NEXT_PUBLIC_*` environment variables in the Vercel dashboard.

### API (Docker / Railway / Render)

```bash
# Build the production Docker image
docker build -f apps/api/Dockerfile -t ndidd-api .

# Run with environment variables
docker run --env-file .env -p 3001:3001 ndidd-api
```

### Contracts (public networks)

```bash
# Make sure the correct RPC URL and private key are set in .env
make deploy-contracts NETWORK=mainnet
make verify-contracts NETWORK=mainnet
```

### Subgraph (The Graph)

```bash
# Set SUBGRAPH_DEPLOY_KEY in .env, then:
make subgraph-deploy
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in every value for your environment. The template is
heavily commented — each variable is explained inline.

Key sections:

| Section | Variables |
|---|---|
| **Database** | `DATABASE_URL`, `DATABASE_URL_TEST` |
| **Cache** | `REDIS_URL`, `REDIS_PASSWORD` |
| **Auth** | `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `SESSION_SECRET` |
| **RPC endpoints** | `ETH_RPC_URL`, `POLYGON_RPC_URL`, `ARBITRUM_RPC_URL`, … |
| **Provider keys** | `ALCHEMY_API_KEY`, `INFURA_PROJECT_ID`, … |
| **Explorer keys** | `ETHERSCAN_API_KEY`, `POLYGONSCAN_API_KEY`, … |
| **Contract addresses** | `MAINNET_TOKEN_ADDRESS`, `MAINNET_STAKING_ADDRESS`, … |
| **The Graph** | `SUBGRAPH_DEPLOY_KEY`, `NEXT_PUBLIC_SUBGRAPH_URL` |
| **Frontend** | `NEXT_PUBLIC_CHAIN_ID`, `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`, … |
| **Email** | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` |

---

## Contributing

We follow [Conventional Commits](https://www.conventionalcommits.org) and use
[Changesets](https://github.com/changesets/changesets) for versioning.

```bash
# 1. Create a feature branch
git checkout -b feat/my-feature

# 2. Make your changes, then stage them
git add .

# 3. Commit (husky will run lint-staged automatically)
git commit -m "feat(contracts): add vesting schedule"

# 4. Add a changeset describing your change
make changeset

# 5. Push and open a pull request
git push origin feat/my-feature
```

### Commit message format

```
<type>(<scope>): <short summary>

Types: feat | fix | docs | style | refactor | perf | test | chore | ci | build
Scope: web | api | contracts | subgraph | sdk | ui | types | config | deps
```

### Pull request checklist

- [ ] `make typecheck` passes
- [ ] `make lint` passes
- [ ] `make test` passes
- [ ] A changeset is included (for user-facing changes)
- [ ] Relevant documentation is updated

---

## License

[MIT](LICENSE) © NDIDD Contributors
