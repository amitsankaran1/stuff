# How to use Stuff (+ Notion) to manage your productivity

This guide describes how Stuff and Notion fit together. Stuff is for execution and triage. Notion is the source of truth and the place for long-form context. Agents read and write the same data you do.

The six sections below are the operating manual. Each one will be filled in as the corresponding milestone ships.

## 1. Capture flow

Every input lands in **Inbox** in under five seconds. The capture sheet asks only for a title. You don't pick a project, a date, or tags at capture time — that's triage, and doing it at capture slows you down. Trust the Inbox; you'll see everything in it next time you triage.

_When to capture in Stuff vs. Notion:_ if it's a task, use Stuff's quick entry. If it's a thought, a paragraph, or a half-baked idea, drop it in a Notion daily note and convert to a task during review.

## 2. Daily review

**Morning (5 min):** open Inbox; for each item decide one of: Today, Anytime, Someday, or trash. Anything with a real deadline gets a When date.

**Evening (5 min):** clear Today. Move anything you didn't finish back to Anytime, or reschedule it. Today should never roll over silently.

## 3. Weekly review

**Friday (20–30 min):**

- Walk every **Project**. Is it still active? Is the next action clear?
- Walk every **Area**. Is the standard of maintenance being met? Add tasks if not.
- Sweep **Someday**. Promote what's ready; retire what's stale.
- Read your **Logbook** to see what you actually shipped this week.

## 4. Projects vs. Areas

- **Projects** have an outcome and end. "Ship the iOS app." "File 2026 taxes." A project is done when the outcome is achieved.
- **Areas** are ongoing standards of maintenance. "Family & Friends." "Health." "Career." Areas never end; they accumulate tasks against them.

If you can't tell whether something is a project or an area, ask: "When would this be done?" If the answer is "never," it's an area.

## 5. Agent delegation patterns

Custom agents read and write the same `Stuff Tasks` DB. When you delegate to an agent:

- **Drafting tasks:** ask the agent to add tasks to Inbox with `Source = Agent` and a one-line `Agent Notes` explaining what it did. Triage them like any other Inbox item.
- **Proposing status changes:** an agent can never mark a task `Done` directly — it writes `Proposed Status = Done`, and Stuff shows you a pending-action banner. One tap to confirm.
- **Summarizing:** for weekly review, ask the agent to summarize the Logbook and surface anything in Someday that's been stale for >30 days.

Patterns to avoid: don't let agents auto-create recurring tasks; don't let them edit `When` for tasks the user has already scheduled.

## 6. When to use Notion web vs. Stuff

- **Stuff**: capture, triage, daily/weekly review, execution. Anything one-handed on the phone.
- **Notion web**: long-form notes inside a task, project planning, editing the source DBs (Areas/Projects/Stuff Tasks) directly. Most desktop work.

A task page in Notion is the same page you see in Stuff — the page body is your notes. Edit it in whichever place is convenient.
