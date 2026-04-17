# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Artifacts

### EnvCraft (`artifacts/env-generator`)
AI-powered .env file generator for Vercel deployments.
- Frontend-only React + Vite app at `/`
- Uses OpenRouter API (`qwen/qwen3-235b-a22b:free`) via user-provided API key
- User enters their OpenRouter key (stored in localStorage, never persisted server-side)
- API proxy route: `POST /api/ai/generate-env` (in `artifacts/api-server/src/routes/ai.ts`)
- Key sent per-request to OpenRouter, never stored on server
- Downloads `.env` and `.env.example` files client-side

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
