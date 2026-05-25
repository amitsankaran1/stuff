# Using Stuff Tasks directly in Notion (desktop)

Stuff's PWA is for fast capture and triage on the phone. The Notion side of the Stuff Tasks DB is for everything that's easier with a keyboard and a bigger screen: bulk processing, longer notes, and time-blocking the day via Notion Calendar.

You don't need to choose — both writers hit the same DB and the cron jobs see whatever you set.

## The three views

I added three views to the **Stuff Tasks** database. Each one is a different doorway into the same data; switch tabs at the top.

| View | Type | Use it when |
|---|---|---|
| **Inbox** | List | Capturing. Pre-filtered to `Status = Inbox`, so hitting **New** in the top-right creates a task already in Inbox — type the name, hit enter, move on. |
| **Triage** | Board grouped by Status | Processing. Drag cards between Inbox / Today / Anytime / Someday / Scheduled columns. Done/Cancelled are hidden so the board stays focused. |
| **Calendar** | Calendar by `When` | Time-blocking. Drag tasks onto days; this is also what Notion Calendar subscribes to. |

The noisy system fields (`Source`, `Agent Touched At`, `Proposed Status`, `Last Reminded At`, `External ID`, etc.) are hidden on all three. Open a task to see them if you ever need to.

## A light desktop loop

**Capture (any time):** type into the Inbox view's "+ New". Title only; don't fill in anything else.

**Process (5 minutes, morning):** open Triage. For each card in Inbox, drag it to one of:

- **Today** — you'll do it today
- **Scheduled** — has a real date; open it and set `When`
- **Anytime** — should happen, no time pressure
- **Someday** — nice idea, not yet
- (or hit `cmd-shift-bksp` to trash)

**Time-block (optional):** open Calendar. Drag any Today / Scheduled task to a slot. The `When` field updates. The reminders cron (every 5 min on GitHub Actions) sends a push at that time.

**Close out (5 minutes, evening):** in Triage, walk the Today column. Any unfinished card either gets dragged back to Anytime or rescheduled. Today should not silently roll over.

## Hooking up Notion Calendar

Notion Calendar (the standalone Mac/iOS app — `calendar.notion.so`) can subscribe to any Notion DB view that has a date property. The **Calendar** view I added uses the `When` property.

1. Open Notion Calendar.
2. Sidebar → `+` next to **Calendars** → **Add Notion database**.
3. Pick **Stuff Tasks** → choose the **Calendar** view → confirm.
4. Tasks with a `When` date now appear on your calendar alongside your meetings. Dragging them to a new time writes back to Notion.

**Tip:** to put a task at a specific time of day, click the `When` field on the task page (not the cell), enable **Include time**, set the time, and optionally pick a duration (Notion Calendar will respect both). All-day tasks just have a date.

## How this fits with the rest of Stuff

- **Notion is still the source of truth.** Everything you do here is what Stuff's API reads. The PWA, agents, cron jobs, and Notion Calendar are all looking at the same rows.
- **Tasks created in Notion default to `Source = User`** (no value is the same as the schema default). They show up in the PWA's Inbox immediately on next refetch.
- **`When` sets the start-time reminder.** Whichever surface writes it — PWA detail sheet, Notion property, Notion Calendar drag — the reminders cron picks it up within ~10 minutes.
- **Recurrence still rolls over nightly** regardless of which surface created the task, as long as `Recurrence` is a valid rrule string.
- **Notion's own per-task reminders** (the "Remind" option on a date property) are independent of Stuff's push pipeline. They fire on Notion's apps. Convenient backup; not required.
