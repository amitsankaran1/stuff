# UX validation test plan

Drives the M3 + M4 surfaces via Playwright MCP. Run against a local dev server
on `m4-agent-integration` (which has M3 + M4 + the side-nav from main merged
in).

## Preconditions

- `pnpm --filter @stuff/web dev` running on http://localhost:3000.
- `.env.local` has: `NOTION_TOKEN`, `AUTH_SECRET`, `AUTH_PASSPHRASE`,
  `NOTION_PARENT_PAGE_ID`, `NOTION_{AREAS,PROJECTS,TASKS}_DB_ID`.

## Out of scope (env not wired in this session)

| Surface | Why skipped |
|---|---|
| Real push subscribe / Send Test | `NOTION_DEVICES_DB_ID` + `VAPID_*` not set |
| `/api/cron/*` endpoints | `CRON_SECRET` not set |
| `/api/agent/*` endpoints | `AGENT_TOKEN` not set |

For the agent **UI flow** we simulate a proposal by setting `Proposed Status`
on a Notion task directly (via the Notion MCP). `/api/tasks/pending-agent-actions`
sees that the same way it would see an agent-written value.

## Steps

1. **Auth**
   - GET `/` → expect redirect to `/login`.
   - Type passphrase → submit → land on `/inbox`.
   - Screenshot the landing.
2. **Side nav drawer**
   - Click hamburger.
   - Verify drawer shows 9 items: Inbox, Today, Upcoming, Anytime, Someday,
     Logbook, Projects, Areas, Settings.
   - Click Today → drawer closes, route changes.
   - Repeat for Upcoming, Anytime, Someday, Logbook, Projects, Areas, Settings.
3. **Quick entry**
   - Visit `/inbox`.
   - Tap FAB (+).
   - Type a unique name (`UX test <timestamp>`).
   - Submit → expect optimistic insert + persistence after refetch.
   - Screenshot.
4. **Status move**
   - Open the task created above.
   - Move to `Today`.
   - Navigate to `/today` → expect to see it.
   - Navigate to `/inbox` → expect it to be gone.
5. **Projects + Areas pages**
   - Visit `/projects` and `/areas` → ensure list renders without console
     errors. Open one of each detail page if present.
6. **Settings UI**
   - Visit `/settings`.
   - Verify Notifications card renders. Verify status text matches one of
     {Off, On, Blocked, Unsupported} based on browser support / permission.
   - Do **not** click the toggle (VAPID not wired this session).
7. **Agent actions banner**
   - Pick a task (e.g. the one we just moved to Today).
   - Via Notion MCP, set `Proposed Status` = `Done` and `Agent Notes` =
     `UX test proposal`.
   - Reload the app → expect the amber banner at the top showing the task
     name, "proposes Done — UX test proposal", and Confirm / Reject buttons.
   - Click **Confirm** → expect banner to clear, task to move to `/logbook`
     with `Status=Done` and `Completed At` stamped.
   - Plant a second proposal, this time click **Reject** → expect banner to
     clear, task otherwise unchanged.
8. **Cleanup**
   - Optionally delete or cancel the UX test task so it doesn't pollute the
     real workspace.
