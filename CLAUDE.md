# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

KK-Image (kk-life) is a full-stack Cloudflare-native image hosting and file management system. It serves as a Flickr/imgur alternative using Cloudflare Pages, D1, R2, and KV.

**Language**: Use Chinese (中文) for all communication and code comments.

## Commands

```bash
# Development
pnpm dev              # Start Vite dev server (frontend only)
pnpm start            # Run full stack locally with wrangler (after build)
pnpm dev:full         # Build + start full stack

# Build
pnpm build            # Build frontend with Vite

# Testing
pnpm test             # Run Mocha integration tests
pnpm test:unit        # Run Vitest unit tests
pnpm test:coverage    # Run unit tests with coverage
pnpm test:ui          # Run Vitest with UI

# Linting & Formatting
pnpm lint             # ESLint check for src/ and functions/
pnpm lint:fix         # ESLint auto-fix
pnpm format           # Prettier format

# Database Migrations
pnpm db:migrate:preview   # Apply migrations to preview D1
pnpm db:migrate:prod      # Apply migrations to production D1

# Deployment
pnpm deploy           # Build and deploy to Cloudflare Pages
pnpm deploy:preview   # Deploy to preview branch
pnpm deploy:prod      # Deploy to production (main branch)
```

## Architecture

### Frontend (`src/`)
- **Framework**: Vue 3 with `<script setup>` syntax + Vite
- **Styling**: Tailwind CSS v4 (via `@tailwindcss/vite` plugin) - no raw CSS
- **State**: Vue Composition API + Composables in `src/composables/`
- **Routing**: Vue Router with views in `src/views/`
- **Pages**: Multi-page app with entry points in `src/pages/*.html`

### Backend (`functions/`)
- **Runtime**: Cloudflare Workers (Pages Functions) with Node.js compat
- **Routing**: File-based routing (`functions/api/` → `/api/`)
- **Middleware**: `functions/_middleware.js` handles auth and context
- **Repositories**: Data access layer in `functions/repositories/`

### Storage Architecture
- **D1**: SQLite database for structured data (files, orders, customers, spaces)
- **R2**: Primary object storage for files (`R2_BUCKET`, `R2_BACKUP_BUCKET`)
- **KV**: Image URL metadata cache (`img_url` binding)
- **Multi-storage**: Supports R2, Telegram, and S3-compatible backends with fallback chain

### Key Directories
```
src/
├── components/     # Reusable Vue components
├── composables/    # Composition functions (useToast, useApi, etc.)
├── views/          # Page-level Vue components
├── utils/          # Frontend utilities
└── router/         # Vue Router configuration

functions/
├── api/            # API endpoints (file-based routing)
│   ├── manage/     # Admin management APIs
│   ├── gallery/    # Gallery/album APIs
│   └── utils/      # Response helpers, validation
├── repositories/   # D1 data access layer
├── storage/        # Multi-storage provider abstraction
├── lib/            # Shared libraries (auth, crypto)
└── utils/          # Backend utilities

migrations/         # D1 SQL migration files (0001_*.sql, 0002_*.sql, ...)
```

## Code Conventions

### Database (D1)
- **Batch operations**: Always use `env.DB.batch()` for multiple inserts/updates
- **Parameterized queries**: Use `prepare().bind().run()/all()/first()` - never concatenate SQL strings
- Migrations are in `migrations/` directory, numbered sequentially

### API Responses
- Use helpers from `functions/api/utils/response.js` for consistent JSON responses
- Standard error format via `error()` helper function

### Frontend Patterns
- Toast notifications via `useToast` composable (`addToast`)
- Reuse existing utilities in `src/utils/` before creating new ones
- SVG icons (Heroicons style) - avoid icon library imports

### Security
- Never hardcode secrets - use environment variables (`env.KEY` or `context.env`)
- JWT for admin authentication, Upload Tokens for API auth
- Backend APIs must validate permissions via middleware context

## Environment Variables

Sensitive credentials must be set via Cloudflare Dashboard or `.dev.vars` file:
- `BASIC_USER`, `BASIC_PASS` - Admin login
- `JWT_SECRET` - JWT signing key
- `TG_Bot_Token`, `TG_Chat_ID` - Telegram storage (optional)
- `S3_*` - S3-compatible storage credentials
- `ModerateContentApiKey` - Image moderation API
