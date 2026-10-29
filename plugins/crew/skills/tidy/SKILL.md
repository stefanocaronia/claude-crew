---
name: tidy
description: Tidy the todos of some colleagues, or of everyone whose todo is past 15 open lines: each, as a short task, ticks what is already done, merges duplicates, keeps the 15 most important open lines and archives the rest. The Crew panel's tidy button runs it; the user may type it too.
argument-hint: "[first names]"
disable-model-invocation: true
---
With first names, those colleagues; without, everyone whose `todo.md` has more than 15 open lines. Say in one line who, with how many open lines each; when the plan's weekly limit is near (Claude Code: the usage the app shows), ask the user before starting, since each one is a task.

Each colleague gets a task ([task.md](../crew/references/task.md)), all at once and in the background, with this brief: check each open line of your `todo.md` against the project (its log, its files, the decisions) and tick what is already done; then tidy it as the crew skill says under "Always": remove the lines ticked `[x]`, merge duplicates, keep at most 15 open lines, the most important first, and move the rest, and what no longer matters, to `notes/todo-archive.md` with the date, never deleted. Change no other file. Return one line: how many ticked, merged and archived, and the three open lines that matter most.

When they are back, give the user one line per colleague from their answer.
