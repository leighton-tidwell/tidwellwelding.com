# The repo harness. `make` lists every command. Agents and humans use these,
# and CI calls them too — never copy a command into a workflow.
.DEFAULT_GOAL := help
SHELL := /bin/bash

help: ## List every command
	@awk 'BEGIN {FS = ":.*## "} /^[a-z0-9-]+:.*## / {printf "  make %-12s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install dependencies from the lockfile
	pnpm install --frozen-lockfile

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

e2e: ## End-to-end tests (Playwright)
	pnpm exec playwright test

pr-size: ## Fail if this branch is over 500 lines / 10 files without an explainer
	node scripts/check-pr-size.mjs

ci: lint typecheck test pr-size ## Every check the PR pipeline runs, in its order

.PHONY: help install lint fix typecheck test e2e pr-size ci
