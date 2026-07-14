# stuff-sync — Todoist ⇄ Notion sync worker

A [Notion Worker](https://developers.notion.com/workers/get-started/overview) that
two-way syncs Notion task databases (source of truth, agent-facing) with **Todoist**
(the human front-end on mobile/desktop).

It syncs one or more **boards** — each a (Notion data source ⇄ Todoist project) pair:

- **Personal Tasks** → Todoist Inbox (the original board).
- **🏠 Apartment Tasks** → a dedicated Todoist project. This database is shared with a
  collaborator, so only tasks the configured owner holds (or unowned tasks) sync to the
  user's Todoist.

A board captures everything that differs between databases (`src/config.ts`): its data
source, Todoist project, property names, status model, DB automations, and an optional
owner filter. All the sync logic is board-agnostic.

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
| `todoist` | webhook | Inbound: Todoist `item:added/updated/completed/uncompleted/deleted` → upsert the Notion page. HMAC-verified (`X-Todoist-Hmac-SHA256`, signed with `TODOIST_CLIENT_SECRET`). Routes to the board owning the task's Todoist project. |
| `notionPush` | webhook | Outbound: target of **each** board's DB automation (*page added / any property edited → Send webhook*). Both databases point at this one URL; the board is resolved from the page's parent data source. Diffs the page against Todoist and creates/updates/closes/reopens the task. |
| `reconcile` | tool | Two-way backstop and backfill across all configured boards. Agent-callable and `ntn workers exec reconcile -d '{"apply": true}'`. `apply: false` reports without writing. |

## Field mapping

| Todoist | Notion |
|---|---|
| `content` | `Task` (title) |
| `due` | `Date` (timezone-aware: instants compared, wall time + `time_zone` written) |
| `description` | `Notes` |
| `checked` | `Status` = `Done` |
| deleted | `Status` = `Cancelled` |
| — | `External ID` = `todoist:<task id>` (the pairing key) |
| comment file attachments | `Attachments` (Files & media); two-way, deletions synced |

File attachments sync both ways (`src/attachments.ts`): a file on a Todoist task comment
appears in the Notion `Attachments` property and vice versa. Files are **copied** (both sides'
URLs are temporary), identified by filename, and reconciled against a per-page `Sync Manifest`
(hidden text property) that distinguishes an add on one side from a delete on the other.
Triggered by Todoist `note:*` webhooks, the `Attachments` property edit (via `notionPush`), and
the `reconcile` backstop. Requires the Notion automation to watch `Attachments` (not `Sync
Manifest`), and the Todoist app to emit `note:added/updated/deleted`.

On **Personal Tasks**, open Todoist tasks land by due date: **due today → `Today`**,
future → `Upcoming`, undated → `Inbox`. This respects the database's own automation
rules ("Status = Inbox → Clear Date", "Future Date → Status = Upcoming"); landing a dated
task in Inbox would get its date wiped.

### The `Today` ⇄ due-today coupling (personal)

`Status = Today` and "due today" are kept equivalent, both directions:

- **Notion → Todoist:** whenever a page is in `Today`, the worker pins its `Date` to today
  (in `TIMEZONE`, default `America/New_York`) and the normal Date→due sync makes the
  Todoist due today. Recurring tasks are exempt (Todoist owns their date).
- **Todoist → Notion:** a task due today lands in `Today`.
- **Roll-forward:** `reconcile` re-stamps every open `Today` page to today's date, so
  running it on a daily schedule keeps the Today list current instead of going overdue.

Deletes are soft: a Todoist delete sets `Cancelled` (personal). Moving a page back from
`Cancelled`/`Done` to an open status revives it in Todoist — reopening the task if it
still exists, or **re-creating** it if the original was deleted.

## Boards & routing

Each board pairs a Notion data source with a Todoist project (`src/config.ts`).

- **Inbound (Todoist → Notion):** the task's Todoist project picks the board
  (`boardForTodoistProject`). If the task already exists in another board's database
  (`findByExternalIdAnyBoard`), it is updated there instead — moving a task between
  Todoist projects does **not** move the Notion page between databases (a documented
  limitation; the page stays in its original database).
- **Outbound (Notion → Todoist):** the page's parent data source picks the board
  (`boardForDataSource`), so both databases' automations can target the single
  `notionPush` webhook.

**Apartment Tasks** differs from Personal in three ways:

- **Status model:** open tasks land as `Not started` (the DB has no automations, so no
  Inbox/Upcoming dance). `Done`/`Cancelled` close it.
- **Owner filter:** only tasks whose `Owner` is the configured user (`APARTMENT_OWNER_USER_ID`,
  default Amit) *or* that are unowned sync to the user's Todoist. A collaborator's tasks
  never appear. Reassigning a linked task away from the user **closes** it in Todoist;
  reassigning it back re-creates/reopens it. Tasks created from Todoist are stamped with the
  user as `Owner`.
- **Collaboration nuance:** the user's Todoist is the only Todoist wired in, so a Todoist
  completion marks the shared page `Done`, and a Todoist delete marks it `Cancelled` — both
  visible to the collaborator.

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
- `TIMEZONE` — IANA timezone for the `Today` ⇄ due-today coupling (default `America/New_York`)

Apartment board (optional — until all three are set, the board is inert and only Personal syncs):

- `STUFF_APARTMENT_DATA_SOURCE_ID` — data source id of 🏠 Apartment Tasks
- `TODOIST_APARTMENT_PROJECT_ID` — the dedicated Todoist project apartment tasks live in
- `APARTMENT_OWNER_USER_ID` — Notion user id whose apartment tasks sync (defaults to Amit's id)

The 🏠 Apartment Tasks database must first be upgraded (in the Notion UI) to carry the rich
schema: `Date` (date), `Notes` (rich_text), `External ID` (rich_text), `Priority` (select
P1/P2/P3), `Labels` (multi_select), and a `Cancelled` option on `Status`. The worker's Notion
connection must also be granted access to that database.

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
  webhooks activate for a personal account via a one-time manual OAuth exchange. `item:*`
  events are account-wide, so apartment-project tasks flow through this same webhook.
- The `notionPush` URL is the "Send webhook" action of a database automation. Add one such
  automation on **each** synced database (Personal Tasks and 🏠 Apartment Tasks), both
  pointing at the same `notionPush` URL. Do **not** add Inbox/Upcoming automations to the
  apartment database.
