# Scheduled jobs

Stuff has three scheduled jobs. Two run on Vercel Cron (daily); the every-5-minutes one runs on GitHub Actions because Vercel's Hobby tier caps cron at daily.

| Job | Where | Schedule | What it does |
|---|---|---|---|
| `/api/cron/reminders` | GitHub Actions (`.github/workflows/reminders.yml`) | `*/5 * * * *` (5–10 min slip) | Start-time reminders for tasks past their `When`, plus deadline warnings for tasks due within 1 day. Idempotent via `Last Reminded At`. |
| `/api/cron/morning-digest` | Vercel Cron (`apps/web/vercel.json`) | `0 14 * * *` UTC (~7am `USER_TZ` default) | Single push with Today / Inbox / overdue counts. |
| `/api/cron/recurrence` | Vercel Cron | `5 7 * * *` UTC (~midnight `USER_TZ` default) | Spawns the next occurrence of recurring Done tasks. Deduped via `External ID = recurrence:<parentId>:<date>`. |

All three are guarded by `Authorization: Bearer ${CRON_SECRET}` — the same secret value lives in both Vercel project env and the GitHub Actions repo secrets.

## Setup checklist

**Vercel env (Project → Settings → Environment Variables):**

- `CRON_SECRET` — generate with `openssl rand -hex 32`
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` — from `npx web-push generate-vapid-keys`
- `NOTION_DEVICES_DB_ID` — from `pnpm --filter @stuff/notion run init`
- `USER_TZ` — IANA TZ string (default `America/Los_Angeles`)

**GitHub repo (Settings → Secrets and variables → Actions):**

- Variable `STUFF_BASE_URL` — e.g. `https://stuff.your-domain.com`
- Secret `CRON_SECRET` — **same value** as the Vercel env var

You can verify the workflow by triggering it manually: Actions → "reminders" → Run workflow.

## Falling back to Notion's native reminders

Notion's apps will fire local push notifications for any task whose `When` (or `Deadline`) date property has a reminder configured. If you have the Notion mobile app installed, this gives you a per-task reminder channel that's completely independent of Stuff's push infrastructure — useful as a backup or if you'd rather skip the Vercel/GitHub Actions setup entirely. The downside is no morning digest and no app-level deep links back to Stuff.
