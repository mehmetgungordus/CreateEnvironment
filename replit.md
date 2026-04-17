# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Artifacts

### EnvForge.ai (`artifacts/env-generator`)
AI-powered .env file generator for Vercel deployments.
- React + Vite app at `/`
- Two-panel dark UI: chaotic raw input (left) → syntax-highlighted .env output with inline AI annotation badges (right)
- Three transformation directives: Auto-Detect Groups, Inject Vercel Prefix, Generate Missing Keys
- Uses OpenRouter API (`openai/gpt-oss-120b:free` model) via server-side `OPENROUTER_API_KEY` secret — never exposed to client
- API proxy route: `POST /api/ai/generate-env` accepts `{ rawText, directives }`, returns `{ envContent, annotations, summary, moduleCount }`
- No data stored server-side; raw input is relayed once to OpenRouter and forgotten
- Client-side download of `.env.local`

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
