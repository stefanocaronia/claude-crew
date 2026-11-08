# Crew guide

The details behind the [README](../README.md): what each command does, where things live, and the rules the colleagues follow.

## Commands

You rarely type them: ask in your own words, in any language, or press the panel's buttons.

| Command | What it does |
|---|---|
| `/crew:init` | Sets the team up, or adopts the reviewer agents the project already has |
| `/crew:hire`, `/crew:fire` | Hires a colleague, or the coordinator, after a short interview; fires one, keeping their profile and memory |
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

Where [Project](https://github.com/stefanocaronia/claude-project) keeps its docs in a git repo of their own, the team lives among them, in `<docs>/crew/agents` and `<docs>/crew/memory`: private, and shared with whoever works on the docs. `.claude/agents` and `.claude/agent-memory` are links to them, which Crew makes and keeps out of your code's repo: on another machine the panel links them by itself, and a team still in `.claude` moves there with one press in the panel.

Where several people work on one project, each with their own Claude, the memories are shared: they say whose each preference, decision or request is, by name, never "the user". The name is the one Project gives you (`me:`), else git's `user.name`.

## The coordinator

The Claude of your chat can have a personality, a name, a character and a memory: ask Claude to hire a coordinator. There is still one Claude in the chat, and the coordinator is who it is. Their role is «your assistant», unless you pick another when hiring them. Their profile says `coordinator: true`, and the panel puts it in the chat's system prompt at every turn, with their memory's index, and draws them after the team, in a section of their own, with Claude's tasks of the backlog, with their portrait or, without one, Claude's face.

They are not a colleague: never started as a subagent, never in a round, and nobody holds a talk or a meeting with them, since they are the chat. Outside a meeting you talk with them in the chat as you always did with Claude. In a meeting the colleagues speak, and when Claude speaks to you it is the coordinator, under their name, with their face and color; without a coordinator, it is Claude. Fire them and the chat is plain Claude again.

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

## Project and Crew

[Crew](https://github.com/stefanocaronia/claude-crew) gives the project colleagues; Project keeps the work they do. They are two plugins, each working alone and both together, and what one reads and writes of the other is this contract, written in both guides in the same words.

- **Crew reads of Project**: `.claude/project.yaml`, its `docs:` (`project` when it does not say), `prefixes:`, `people:` and `types:`; `.claude/project.local.yaml`, its `me:`; the backlog through `backlog.mjs list --atomic --json` and `show`.
- **Crew writes of Project**: the backlog only through `backlog.mjs`: `add "<text>" --type <type> --to <who> --by <who>`, `comment --by <who>`, `set`, `archive`.
- **Project reads of Crew**: the colleagues' profiles, `.claude/agents/<id>.md` (the first name, full name and role from the heading `# <First> <Last>, <role>`, the color from `color:`, a name of Claude Code's or a hex, and `coordinator: true` for the coordinator); their portraits, `.claude/agent-memory/<id>/avatar-small.jpg`, or `avatar.svg`; their `todo.md` and its done and archived notes.
- **Colors**: a profile's `color:` is one of Claude Code's names, drawn red `#C0453A`, blue `#3F7CC4`, green `#4E9A6B`, yellow `#C9A227`, purple `#8A63C9`, orange `#D9773A`, pink `#D0679B`, cyan `#2FA3B5`, or a hex; anything else gray `#888780`.
- **Shared folders**: where the docs are a repo of their own, Crew keeps the colleagues in `<docs>/crew/agents` and `<docs>/crew/memory`, with `.claude/agents` and `.claude/agent-memory` as links that Crew makes and keeps out of the code's repo. Project's sync commits and pushes them with the docs: the memories and todos merge line by line, a profile changed by two at once is a clash to mend.
- **The coordinator**: Crew hires them, and they are Claude with a personality: in the backlog, the first of `people:`, and `--to <their name>` is theirs too. Their role is the one in their heading, else «your assistant», as Claude's. The panel and the page draw Claude with their name, color and portrait; without a portrait, or without a coordinator, with Claude's face, the orange pixel critter on a cream circle; without a coordinator, in Claude's orange, `#D97757`. No ▶ hands them a task as a colleague.
- **Colleagues** hold tasks by first name. Their `todo.md` is their own notebook; a line that is work for the project becomes a task when you tidy the backlog.

## Cost

Each colleague at work is a subagent and spends your plan's usage as Claude does: a round with five colleagues costs about five tasks. Fewer colleagues, narrower rounds and lower effort spend less.
