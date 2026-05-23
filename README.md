# Stuff

A fast, Notion-backed task manager. Things-style methodology, agent-friendly.

## Why

The Notion mobile app isn't built for fast task capture and triage. Stuff is a thin, fast client over the Notion API — installable as a PWA on iOS today, native SwiftUI later. Notion remains the source of truth, so AI agents can read and write the same tasks I do.

## Layout

```
apps/
  web/        Next.js 15 PWA + API routes (proxy + cron)
packages/
  shared/     zod Task schema, RRULE helpers, push payload types
  notion/     Notion DB schema-as-code, typed client, migration script
docs/         Productivity guide, ADRs
```

## Getting started

```bash
pnpm install
cp .env.example .env.local   # fill in NOTION_TOKEN, etc.
pnpm dev
```

## Milestones

- **M0** — schema (you are here)
- **M1** — read-only PWA + auth
- **M2** — write/edit
- **M3** — notifications + Vercel Cron
- **M4** — agent integration
- **M5** — native SwiftUI (later)

See [the plan](https://github.com/amitsankaran1/stuff) for full architecture.
