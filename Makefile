# NDIDD Monorepo — Developer Makefile
# Requires: make, pnpm >=8, node >=18, docker, docker-compose

.DEFAULT_GOAL := help
SHELL         := /bin/bash
.PHONY: help install build dev test lint lint-fix format format-check typecheck clean \
        docker-up docker-down docker-logs docker-reset \
        deploy-contracts verify-contracts generate-types subgraph-build subgraph-deploy \
        prepare-env db-migrate db-seed

# ── Colors ────────────────────────────────────────────────────────────────────
CYAN  := \033[0;36m
RESET := \033[0m
BOLD  := \033[1m

# ── Variables ─────────────────────────────────────────────────────────────────
NETWORK        ?= localhost
CHAIN_ID       ?= 31337
DOCKER_COMPOSE  = docker compose -f docker/docker-compose.yml
HARDHAT         = pnpm --filter @ndidd/contracts exec hardhat
GRAPH_CLI       = pnpm --filter @ndidd/subgraph exec graph

# ── Help ──────────────────────────────────────────────────────────────────────
help: ## Show this help message
	@echo ""
	@echo "$(BOLD)$(CYAN)NDIDD Monorepo$(RESET)"
	@echo "$(CYAN)──────────────────────────────────────────────────────$(RESET)"
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_0-9-]+:.*?##/ { printf "  $(CYAN)%-26s$(RESET) %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@echo ""

# ── Setup ─────────────────────────────────────────────────────────────────────
prepare-env: ## Copy .env.example → .env (skips if .env already exists)
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "✅  Created .env from .env.example — fill in your secrets."; \
	else \
		echo "ℹ️   .env already exists — skipping."; \
	fi

install: prepare-env ## Install all workspace dependencies
	pnpm install

# ── Build ─────────────────────────────────────────────────────────────────────
build: ## Build all packages and apps (production)
	pnpm turbo run build

build-packages: ## Build workspace packages only (not apps)
	pnpm turbo run build --filter="./packages/*"

# ── Development ───────────────────────────────────────────────────────────────
dev: ## Start all services in development mode (requires Docker infra)
	pnpm turbo run dev --parallel

dev-web: ## Start the Next.js frontend only
	pnpm --filter @ndidd/web dev

dev-api: ## Start the API server only
	pnpm --filter @ndidd/api dev

dev-node: ## Start a local Hardhat node
	$(HARDHAT) node --network hardhat

# ── Testing ───────────────────────────────────────────────────────────────────
test: ## Run all tests
	pnpm turbo run test

test-contracts: ## Run Hardhat/Foundry contract tests
	pnpm --filter @ndidd/contracts test

test-api: ## Run API unit & integration tests
	pnpm --filter @ndidd/api test

test-web: ## Run frontend component & e2e tests
	pnpm --filter @ndidd/web test

test-ci: ## Run all tests (CI mode — no cache, coverage enabled)
	pnpm turbo run test:ci --concurrency=4

# ── Linting & Formatting ──────────────────────────────────────────────────────
lint: ## Run ESLint across all workspaces
	pnpm turbo run lint

lint-fix: ## Run ESLint with auto-fix
	pnpm turbo run lint:fix

format: ## Format all files with Prettier
	pnpm prettier --write "**/*.{ts,tsx,js,jsx,json,md,yaml,yml,css,scss,sol}" --ignore-path .prettierignore

format-check: ## Check formatting without writing files
	pnpm prettier --check "**/*.{ts,tsx,js,jsx,json,md,yaml,yml,css,scss,sol}" --ignore-path .prettierignore

typecheck: ## Run TypeScript type checking across all workspaces
	pnpm turbo run typecheck

# ── Docker Infrastructure ─────────────────────────────────────────────────────
docker-up: ## Start all Docker services (Postgres, Redis, Graph Node, IPFS)
	$(DOCKER_COMPOSE) up -d
	@echo "✅  Infrastructure is up. Services:"
	@$(DOCKER_COMPOSE) ps

docker-down: ## Stop all Docker services
	$(DOCKER_COMPOSE) down

docker-logs: ## Tail logs from all Docker services
	$(DOCKER_COMPOSE) logs -f

docker-reset: ## Remove all Docker volumes and restart (⚠️  destroys data)
	@read -p "This will destroy all local data. Continue? [y/N] " confirm && \
	[ "$$confirm" = "y" ] || exit 1
	$(DOCKER_COMPOSE) down -v
	$(DOCKER_COMPOSE) up -d
	@echo "✅  Docker reset complete."

# ── Database ──────────────────────────────────────────────────────────────────
db-migrate: ## Run pending database migrations
	pnpm --filter @ndidd/api exec prisma migrate dev

db-migrate-prod: ## Apply migrations in production (no prompt)
	pnpm --filter @ndidd/api exec prisma migrate deploy

db-seed: ## Seed the database with development fixtures
	pnpm --filter @ndidd/api exec prisma db seed

db-studio: ## Open Prisma Studio (database GUI)
	pnpm --filter @ndidd/api exec prisma studio

db-reset: ## Reset the database (drop, recreate, migrate, seed) ⚠️
	pnpm --filter @ndidd/api exec prisma migrate reset --force

db-generate: ## Regenerate the Prisma client
	pnpm --filter @ndidd/api exec prisma generate

# ── Smart Contracts ───────────────────────────────────────────────────────────
compile-contracts: ## Compile Solidity contracts
	$(HARDHAT) compile --network $(NETWORK)

deploy-contracts: ## Deploy contracts to NETWORK (default: localhost)
	$(HARDHAT) run scripts/deploy.ts --network $(NETWORK)
	@echo "✅  Contracts deployed to $(NETWORK)"

verify-contracts: ## Verify contracts on block explorer (requires API key)
	$(HARDHAT) verify --network $(NETWORK)

deploy-and-verify: ## Deploy then verify in one step
	$(MAKE) deploy-contracts NETWORK=$(NETWORK)
	$(MAKE) verify-contracts NETWORK=$(NETWORK)

flatten-contracts: ## Flatten contracts for manual verification
	$(HARDHAT) flatten

# ── Type Generation ───────────────────────────────────────────────────────────
generate-types: ## Generate TypeChain types from contract ABIs
	pnpm --filter @ndidd/contracts exec typechain --target ethers-v6 \
		--out-dir typechain-types \
		"artifacts/contracts/**/*.json"
	@echo "✅  TypeChain types generated."

generate-sdk: ## Regenerate the SDK package from ABIs + subgraph schema
	pnpm --filter @ndidd/sdk build
	@echo "✅  SDK regenerated."

# ── Subgraph ──────────────────────────────────────────────────────────────────
subgraph-codegen: ## Generate subgraph AssemblyScript types
	$(GRAPH_CLI) codegen subgraph/subgraph.yaml -o subgraph/generated

subgraph-build: ## Build the subgraph
	$(GRAPH_CLI) build subgraph/subgraph.yaml

subgraph-deploy-local: ## Deploy subgraph to local Graph Node
	$(GRAPH_CLI) create --node http://localhost:8020 $(SUBGRAPH_NAME)
	$(GRAPH_CLI) deploy --node http://localhost:8020 --ipfs http://localhost:5001 $(SUBGRAPH_NAME) subgraph/subgraph.yaml

subgraph-deploy: ## Deploy subgraph to The Graph hosted service
	$(GRAPH_CLI) auth --product hosted-service $(SUBGRAPH_DEPLOY_KEY)
	$(GRAPH_CLI) deploy --product hosted-service $(SUBGRAPH_NAME) subgraph/subgraph.yaml

# ── Clean ─────────────────────────────────────────────────────────────────────
clean: ## Remove all build artifacts and caches
	pnpm turbo run clean
	rm -rf node_modules .turbo
	find . -name "node_modules" -type d -prune -exec rm -rf {} + 2>/dev/null || true
	find . -name ".turbo" -type d -prune -exec rm -rf {} + 2>/dev/null || true
	find . -name "dist" -type d -prune -exec rm -rf {} + 2>/dev/null || true
	find . -name ".next" -type d -prune -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.tsbuildinfo" -delete 2>/dev/null || true
	@echo "✅  Clean complete."

clean-cache: ## Remove only Turbo and TypeScript caches
	rm -rf .turbo
	find . -name "*.tsbuildinfo" -delete 2>/dev/null || true

# ── Release / Changesets ──────────────────────────────────────────────────────
changeset: ## Add a changeset for the current changes
	pnpm changeset

version: ## Bump versions from pending changesets
	pnpm changeset version

release: ## Build and publish packages to npm
	pnpm turbo run build --filter="./packages/*"
	pnpm changeset publish
