# Crew guide

The details behind the [README](../README.md): what each command does, where things live, and the rules the colleagues follow.

## Commands

You rarely type them: ask in your own words, in any language, or press the panel's buttons.

| Command | What it does |
|---|---|
| `/crew:init` | Sets the team up, or adopts the reviewer agents the project already has |
| `/crew:hire`, `/crew:fire` | Hires a colleague after a short interview; fires one, keeping their profile and memory |
| `/crew:portraits` | New portraits, in one style for the team |
| `/crew:review` | A review round: the colleagues whose field it touches review in parallel |
| `/crew:ask` | A quick question, answered at once in the chat |
| `/crew:talk`, `/crew:meeting` | A conversation, one-to-one or a meeting; the meeting asks the topic first |
| `/crew:invite`, `/crew:leave`, `/crew:end` | Someone joins, someone leaves, the conversation ends |
| `/crew:next` | Starts the next open task, by priority, then the oldest |
| `/crew:tidy` | Ticks what is done, merges duplicates, archives the rest, compacts long memories |
| `/crew:panel` | Opens the panel; `/crew-panel` shows or hides it without Claude |

## Files

Everything stays in your project, under `.claude/`:

```
agents/matteo-conti.md              the profile: who they are and how they work
agent-memory/matteo-conti/
    MEMORY.md                       their memory, at most 80 lines, handed to them at every task
    todo.md                         their tasks
    avatar.jpg, avatar-small.jpg    their portrait, 128 and 32 px (or avatar.svg)
    notes/                          reports and longer notes
agent-memory/_former/               colleagues who left
```

## Tasks

One task a line in `todo.md`, with a priority and the day it was written:

```
- [ ] P2 · 2026-10-29 · check the import of long tracks
- [ ] P1 · 2026-10-30 · #matteo-3 · review the parser
- [ ] P2 · 2026-10-30 · retest the import (after: #matteo-3)
- [x] 2026-10-31 · review the map
```

- **Priority**: P1 now, P2 in the plan, P3 later.
- **Waiting**: a task ending with `(after: #id)` starts only once that one is done.
- **Limits**: at most 15 open lines; the rest go to `notes/todo-archive.md`, done ones to `notes/todo-done.md`. Nothing is deleted.

## Permissions

Set in each colleague's card, or by Claude when hiring.

| Permission | Lets them |
|---|---|
| **Read** | read the project's files |
| **Write** | change the project's files |
| **Testing** | run commands (brings Write, since a command can change files) |
| **Web** | search and read the web |

A reviewer starts with Read only. Without Read or Write, a colleague reads and writes only their own memory folder.

## One place at a time

A colleague behaves like a person:

- **One task at a time**, in all the project's chats.
- **At work or in a meeting**, in this chat or another, they take no other task and join no other meeting. Claude says where they are and offers to wait, to give the task to someone else, or to do it.
- **One file, one writer**: two colleagues at work never change the same file at once.

## The panel

- **Dashboard**: tasks in progress, open tasks by priority, blocked tasks, tasks given this week.
- **Team**: in the meeting, at work (with the steps they report), finished (report one press away), on a coffee break.
- **Backlog**: the open tasks, by priority, then the oldest; each opens in place to read, edit, remove or start.
- **A colleague's card**: their tasks, memory, profile, effort and permissions.
- **Languages**: eleven, following Claude Code's or the system's; ⚙ picks another.

It shows in the terminal and in the desktop app's Code tab, from Claude Code 2.1.287. It opens by itself when a chat starts in a project with colleagues.

## Portraits

Painted by an image-generation connector, or by the Codex CLI logged in with ChatGPT. Without either, Claude draws them in SVG.

## With Project

With the [Project](https://github.com/stefanocaronia/claude-project) plugin, the work lives in its backlog of numbered tasks:

- **Backlog tasks** a colleague holds show among their tasks, with their number.
- **New work** a colleague finds comes as a proposal in their report; Claude adds it to the backlog.
- **Their todo** becomes their own notebook: reminders, retests, things to tell. A line may cite a backlog task, `T-61`.

## Cost

Each colleague at work is a subagent and spends your plan's usage as Claude does: a round with five colleagues costs about five tasks. Fewer colleagues, narrower rounds and lower effort spend less.
