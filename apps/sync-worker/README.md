# stuff-sync — Todoist ⇄ Notion sync worker

A [Notion Worker](https://developers.notion.com/workers/get-started/overview) that
two-way syncs the **Personal Tasks** Notion database (source of truth, agent-facing)
with **Todoist** (the human front-end on mobile/desktop).

```
Todoist apps ──▶ Todoist Cloud ──item:* webhook──▶ ┌──────────────────────┐
     ▲                                              │  stuff-sync worker    │
     └───────────── Todoist API v1 ◀──────────────  │  (Notion-hosted)      │
                                                    └──────────▲───────────┘
        Notion DB automation ("Send webhook") ────────────────┘│
        Personal Tasks DB  ◀── @notionhq/client writes ────────┘
```

## Capabilities

| Key | Kind | Purpose |
|---|---|---|
| `todoist` | webhook | Inbound: Todoist `item:added/updated/completed/uncompleted/deleted` → upsert the Notion page. HMAC-verified (`X-Todoist-Hmac-SHA256`, signed with `TODOIST_CLIENT_SECRET`). |
| `notionPush` | webhook | Outbound: target of the Personal Tasks automation (*page added / any property edited → Send webhook*). Diffs the page against Todoist and creates/updates/closes/reopens the task. |
| `reconcile` | tool | Two-way backstop and backfill. Agent-callable and `ntn workers exec reconcile -d '{"apply": true}'`. `apply: false` reports without writing. |

## Field mapping

| Todoist | Notion |
|---|---|
| `content` | `Task` (title) |
| `due` | `Date` (timezone-aware: instants compared, wall time + `time_zone` written) |
| `description` | `Notes` |
| `checked` | `Status` = `Done` |
| deleted | `Status` = `Cancelled` |
| — | `External ID` = `todoist:<task id>` (the pairing key) |

Open Todoist tasks land as `Upcoming` when dated, `Inbox` when undated — this
respects the database's own automation rules ("Status = Inbox → Clear Date",
"Future Date → Status = Upcoming"). Landing a dated task in Inbox would get its
date wiped by those rules.

## Loop / echo safety (learned the hard way)

1. **Diff-gated writes everywhere** — handlers compute target state and skip
   no-op writes, so echoes converge instead of ping-ponging.
2. **Inbound trusts the live task, not the webhook payload** — `event_data` can
   be stale or partial (a create-with-due's `item:added` arrives without the
   due). The handler re-fetches the task; `item:added` additionally waits 5s
   for Todoist's read path to settle.
3. **Outbound echo guard** — if a page's `last_edited_by` is this integration's
   own bot, the automation fired on our own write; skip.
4. **Recurring tasks are never reopened from Notion** — Todoist advances them
   itself.
5. **Delete in Todoist ⇒ `Cancelled` in Notion** (soft), and a page already
   Done/Cancelled is never resurrected by a reopen event.

Reconcile conflict rules: missing counterparts are created, field drift →
Todoist wins (it's the front-end), completion mismatch → done wins.

## Environment

Set locally in `.env` (gitignored) and remotely via `ntn workers env set`:

- `TODOIST_API_TOKEN` — personal API token (Todoist Settings → Integrations)
- `TODOIST_CLIENT_SECRET` — app secret from the App Management Console; verifies webhook HMAC
- `TODOIST_EXCLUDED_PROJECT_IDS` — comma-separated project ids never synced (the onboarding project)
- `STUFF_NOTION_TOKEN` — internal integration token (env names may not start with the reserved `NOTION_` prefix, hence the name; local `.env` also carries `NOTION_API_TOKEN` for `ntn workers exec --local`)
- `STUFF_TASKS_DATA_SOURCE_ID` — data source id of Personal Tasks

## Operating it

```bash
ntn workers deploy                                  # build + publish
ntn workers webhooks list                           # the two webhook URLs
ntn workers exec reconcile -d '{"apply": false}'    # drift report (remote)
ntn workers exec reconcile -d '{"apply": true}'     # reconcile now
ntn workers runs list                               # run history
ntn workers runs logs <runId>                       # logs for a run
```

External registration:
- The `todoist` webhook URL + watched events live in the Todoist
  [App Management Console](https://app.todoist.com/app/settings/integrations/app-management);
  webhooks activate for a personal account via a one-time manual OAuth exchange.
- The `notionPush` URL is the "Send webhook" action of the Personal Tasks automation.
