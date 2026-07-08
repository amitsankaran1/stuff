# Stuff

Todoist as the front-end for a Notion tasks database, with fast two-way sync.
Notion stays the source of truth so custom agents can read and act on the same
tasks; Todoist's apps are the human capture/completion surface.

```
   Todoist apps (mobile + desktop)          Notion Custom Agents
            │  (capture / complete)                 │ (read / act / reconcile)
            ▼                                       ▼
      Todoist Cloud ──item:* webhook──▶ ┌───────────────────────┐
            ▲                            │  stuff-sync worker    │
            │  Todoist API v1            │  (Notion Workers)     │
            └────────────────────────────└───────────▲───────────┘
                                                     │
        Notion DB automation ("Send webhook") ───────┘
        Personal Tasks DB ◀── source of truth
```

- **Inbound** (real-time): Todoist webhooks → worker → Notion page upserts.
- **Outbound** (real-time): a Personal Tasks database automation posts to the
  worker on any page add/edit — human edits in the Notion UI and agent edits
  flow to Todoist identically.
- **Backstop**: a `reconcile` worker tool (agent-callable) converges any drift;
  it also performed the initial backfill.
- **Recurrence**: native Todoist recurring due dates. No custom engine.

Everything lives in [`apps/sync-worker/`](apps/sync-worker/README.md) — a single
Notion Worker (~4 small TypeScript modules) deployed with `ntn workers deploy`.
See its README for capabilities, field mapping, echo/loop-safety rules,
environment variables, and operating commands.

## History

Stuff v0 was a Next.js PWA on Vercel (custom GTD UI, web push, cron reminders,
an RRULE recurrence engine, and an agent HTTP API). It was replaced wholesale by
this architecture: Todoist provides the apps, Notion provides the agent surface
and automations, and the worker provides the glue. The PWA, its packages, docs,
and schedulers were removed in the rewrite — see git history if you need them.
