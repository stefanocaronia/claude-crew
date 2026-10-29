---
name: next
description: Start the next task of some colleagues from their todo, or one task the user names: by priority, then the oldest. The Crew panel's Next task button and the ▶ on a backlog row run it; the user may type it too.
argument-hint: "[first names] [-- the task]"
disable-model-invocation: true
---
**One task named** (`/crew:next Joseph -- the task`, the ▶ on a backlog row): that line of the colleague's `todo.md`. The user chose it: start it, unless it waits for the user's decision or needs a permission the colleague lacks; then say so in one line and ask.

**Otherwise**, for each colleague named (without names, each one on a coffee break, neither at work nor in the meeting), their next open line: the highest priority (P1, then P2, then P3, then lines without), the oldest within it. Skip the lines waiting for the user's decision, those waiting for an event yet to come (the next playtest, a release), and those the colleague's permissions do not allow; say which were skipped and why when it matters. A colleague with nothing left to start is named in one line.

**A task that waits for others** (`(after: #id)` in its line, the ids found in the todos): its chain comes first. Follow each id to its open line, and that line's own `after`, to the start of the chain; show the whole chain in one line ("Matteo corrects lootNote → then Elena runs loot2") and ask once. On yes, start the first; when its colleague has ticked their line, start the next, without asking again, and so on; a link that fails stops the chain, and the user is told. A task that waits for an id no longer open is free.

Say in one line per colleague which task starts; when the plan's weekly limit is near (Claude Code: the usage the app shows), ask the user first, since each one is a task. Then each is a task ([task.md](../crew/references/task.md)), all at once and in the background: the line's words are the task, the brief adds what the project's context says about it, where the project keeps the state of its work, and that at the end they tick the line with the day and tidy their todo.
