# UX validation findings — 2026-05-25

Driven via Playwright MCP against `m4-agent-integration` at
`http://localhost:3000`. Mobile viewport: 414×896.

Screenshots referenced live next to the README at
`apps/web/.playwright-mcp/` (capture timestamps in filenames). Numbered
references below match `stuff-NN-*.png`.

## What passed

| # | Flow | Result |
|---|---|---|
| 01 | `/` → middleware redirect to `/login`; form renders | ✅ |
| 02 | Sign in with passphrase → land on `/inbox` with "Nothing here yet." | ✅ |
| 03 | Hamburger opens drawer; all 9 items present (Inbox, Today, Upcoming, Anytime, Someday, Logbook, Projects, Areas, Settings); drawer has Close button | ✅ |
| 04 | Drawer closes on navigation (click Today → drawer collapses) | ✅ |
| 05 | All six task views (`inbox`, `today`, `upcoming`, `anytime`, `someday`, `logbook`) load with no JS errors | ✅ |
| 06 | `/projects` and `/areas` render | ✅ |
| 07 | FAB opens quick entry sheet; placeholder copy is "What needs to happen?" | ✅ |
| 08 | Submit creates task; it appears in Inbox optimistically and persists after refetch | ✅ |
| 09 | Task detail sheet opens on row click; Name/Status/Project/Area/When/Deadline/Checklist all present; Status combobox lists all 7 values | ✅ |
| 10 | Change Status=Today, Save → task disappears from Inbox, appears on `/today` | ✅ |
| 11 | `/settings` Notifications card renders status "Off. Turn on to receive reminders…" with a `role=switch` toggle | ✅ |
| 12 | Plant `Proposed Status=Done` via Notion → reload `/today` → amber banner appears with task name + "proposes Done — <agent notes>" + Confirm/Reject | ✅ |
| 13 | Click Confirm → banner disappears, task moves to `/logbook` with `Status=Done`, list view refreshes | ✅ |
| 14 | Plant a second `Proposed Status=Cancelled` proposal, click Reject → banner clears, task remains in Today unchanged | ✅ |

## Findings

### Real UX bugs

- **`/settings` is missing the ViewHeader / hamburger button.** Once on
  Settings, the only way back to the nav is browser back or typing a URL.
  Fix: render `ViewHeader title="Settings"` (or whatever its current API)
  inside `apps/web/src/app/(app)/settings/page.tsx` the way the list views
  do. Screenshot: `stuff-11-settings.png`.
- **Quick entry sheet stays mounted in the accessibility tree after
  submit.** Calling `onClose()` in `quick-entry.tsx` triggers the visual
  hide but the Sheet component still appears in the snapshot with an empty
  `What needs to happen?` textbox. Functionally fine; screen-reader users
  will see/hear a duplicate "New task" dialog at the bottom of every page.
  Worth verifying whether `<Sheet>` should unmount or `aria-hidden` when
  closed.
- **Row click target ambiguity for screen readers.** A task row's outer
  button gets accessible name `Mark as done UX test — Playwright run`
  because the inner round-check button is named `Mark as done`. After
  agent action is set, the outer name becomes
  `Mark as done UX test — Playwright run Agent proposes: Done` — too long
  and starts with a verb that doesn't describe what the outer button does
  (it opens detail, not marks done). Suggest changing the outer element's
  role/name: the row is a navigation target ("Open task: UX test —
  Playwright run") and the check is a separate action button.
- **`/icon-192.png` 404 on every page load.** The manifest and the
  service worker's `showNotification` both reference it; create it under
  `apps/web/public/icon-192.png` (and a 512 variant) to stop the warning
  and so notification badges actually have an icon when push is live.
- **`favicon.ico` 404 on `/login` only** (the route group `(app)` must
  have one inherited from elsewhere). Minor.

### Things working better than expected

- **Inline agent annotation on task rows**: when a task has
  `Proposed Status` set, the row in the list view also shows
  `Agent proposes: Done` under the name, in addition to the banner.
  Two-tier surfacing is nice — the banner is the call to action, the row
  annotation is context.
- **Confirm/Reject latency**: the React Query invalidation feels
  instant. Banner clears, list refetches, task lands in the right view
  in one tick.

### Couldn't exercise this session

| Surface | Why |
|---|---|
| `/api/push/subscribe` end-to-end | `NOTION_DEVICES_DB_ID` and `VAPID_*` not set in `.env.local` |
| `/settings` Notifications toggle enable | same as above |
| `/api/cron/{reminders,morning-digest,recurrence}` | `CRON_SECRET` not set |
| `/api/agent/*` (instead of editing Notion directly) | `AGENT_TOKEN` not set |

The agent **UI** flow is fully validated because the
`/api/tasks/pending-agent-actions` endpoint sees any
`Proposed Status` — regardless of whether the agent wrote it or the
user did. Wiring `AGENT_TOKEN` is purely about validating the
agent-side write authentication.

## Suggested follow-up PR

A small "Settings + a11y polish" PR could land:

1. Add `ViewHeader` to `/settings`.
2. Make `<Sheet>` unmount (or `aria-hidden`) when `open=false`.
3. Split the row into a navigation element and a separate "Mark as
   done" button so the accessible names are clean.
4. Add `apps/web/public/icon-192.png` + `icon-512.png` (and a
   `favicon.ico` if the manifest doesn't already cover it).
