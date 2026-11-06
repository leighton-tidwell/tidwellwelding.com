# The repo harness. `make` lists every command. Agents and humans use these,
# and CI calls them too — never copy a command into a workflow.
.DEFAULT_GOAL := help
SHELL := /bin/bash

# Each git worktree gets its own compose project and port block, so two agents
# can run the stack side by side. Override any of these on the command line.
SLOT := $(shell printf '%s' "$(CURDIR)" | cksum | awk '{print $$1 % 90}')
WEB_PORT ?= $(shell echo $$((20000 + $(SLOT) * 10)))
CONVEX_PORT ?= $(shell echo $$(($(WEB_PORT) + 1)))
CONVEX_SITE_PORT ?= $(shell echo $$(($(WEB_PORT) + 2)))
FAKES_PORT ?= $(shell echo $$(($(WEB_PORT) + 3)))
export WEB_PORT CONVEX_PORT CONVEX_SITE_PORT FAKES_PORT
export COMPOSE_PROJECT_NAME ?= tsws-$(SLOT)

# Point the Convex CLI and Next at the local backend, never a cloud one. The
# admin key is valid only for compose.yaml's fixed, local-only instance secret.
export CONVEX_DEPLOYMENT :=
export CONVEX_SELF_HOSTED_URL := http://127.0.0.1:$(CONVEX_PORT)
export CONVEX_SELF_HOSTED_ADMIN_KEY := tsws-local|0162f19744026baa6e6d2144b832c9a9b37b3927db9695311d78814f6761487636891648cf
export NEXT_PUBLIC_CONVEX_URL := $(CONVEX_SELF_HOSTED_URL)
# Remote targets drop the local settings so the Convex CLI uses its deploy key.
REMOTE = env -u CONVEX_SELF_HOSTED_URL -u CONVEX_SELF_HOSTED_ADMIN_KEY -u CONVEX_DEPLOYMENT E2E_BASE_URL="$(URL)"

help: ## List every command
	@awk 'BEGIN {FS = ":.*## "} /^[a-z0-9-]+:.*## / {printf "  make %-12s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install dependencies from the lockfile, plus the e2e browser
	pnpm install --frozen-lockfile
	pnpm exec playwright install $(if $(CI),--with-deps) chromium
	@# Relative on purpose: worktrees share .git/config, and an absolute path
	@# would break every other worktree when this one is removed.
	@git config commit.template .gitmessage

up: ## Start Convex and the API fakes in Docker, then push the functions
	docker compose up -d --wait
	pnpm exec convex deploy -y --codegen disable --typecheck disable
	pnpm exec convex env set --force --from-file local/convex.env

dev: up ## Run the whole stack with hot reload (prints the web URL)
	@mkdir -p .logs
	trap 'kill 0' EXIT; \
	  pnpm exec convex dev --typecheck disable > .logs/convex-dev.log 2>&1 & \
	  pnpm exec next dev --port $(WEB_PORT) 2>&1 | tee .logs/next.log

down: ## Stop the local stack; data is kept
	docker compose down

reset: ## Wipe local data, then start and seed a fresh stack
	docker compose down -v
	$(MAKE) up seed

seed: ## Load the owner account and sample customers, invoices and a quote
	node local/seed.mjs

logs: ## Backend, fakes and web-server logs
	docker compose logs --tail=200
	@tail -n 200 .logs/next.log .logs/convex-dev.log 2>/dev/null || true

lint: ## Lint and format check with Biome; a warning fails
	pnpm exec biome ci --error-on-warnings .

fix: ## Apply Biome's formatting and safe fixes
	pnpm exec biome check --write .

typecheck: ## Strict type check: app, tests and convex/
	pnpm exec next typegen
	pnpm exec tsc --noEmit
	pnpm exec tsc -p convex --noEmit

test: ## Unit and integration tests (Vitest)
	pnpm exec vitest run

e2e: up ## End-to-end tests (Playwright) against the local stack
	pnpm exec playwright test

e2e-remote: ## E2E against a deployed site, minus @live specs: make e2e-remote URL=https://...
	$(REMOTE) pnpm exec playwright test --grep-invert @live

smoke: ## Read-only page checks against a deployed site, one at a time: make smoke URL=https://...
	$(REMOTE) pnpm exec playwright test --no-deps --workers=1 tests/e2e/smoke.spec.ts tests/e2e/seo.spec.ts

screenshot: up seed ## Screenshot a local page: make screenshot URL=/quote [VIEWPORT=phone] [ADMIN=1]
	URL="$(URL)" VIEWPORT="$(VIEWPORT)" ADMIN="$(ADMIN)" node scripts/screenshot.mjs

pr-size: ## Fail if this branch is over 500 lines / 10 files without an explainer
	node scripts/check-pr-size.mjs

fail-first: ## Fail if a new unit test also passes against main's code
	node scripts/check-fail-first.mjs

ci: lint typecheck test fail-first pr-size e2e ## Every check the PR pipeline runs, in its order

.PHONY: help install up dev down reset seed logs lint fix typecheck test e2e e2e-remote smoke screenshot pr-size fail-first ci
