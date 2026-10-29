# Changelog

What changes for whoever uses Crew, version by version. Plugins update in a new chat: `/plugin`, Marketplaces, claude-crew, Update marketplace, or turn its auto-update on there.

## 0.11.0 – 0.11.3

- Every todo line carries a priority and the day it was written: `- [ ] P2 · 2026-10-29 · task` (P1 now, P2 in the plan, P3 later); done, `- [x] 2026-10-30 · task`. The colleagues write it so, tidying keeps the 15 open lines by priority and gives a priority and a date to the lines without, and the backlog puts P1 first, with the priority as a mark and the task's age. Lines in the old form still read.
- The backlog orders the tasks by priority, then the oldest first. `/crew:next`, the panel's Next task button, starts the next task of the colleagues picked, or of everyone free: the highest priority and the oldest, skipping those waiting for the user, for an event or for a permission the colleague lacks. A ▶ on a backlog row starts that very task.
- A backlog row opens in place with a click, to read the task whole with who holds it, its priority, date, age and effort; the hint that covered the row's buttons is gone.
- The backlog draws a task's priority as an issue tracker does: P1 two red arrows up, P2 an orange equals, P3 a blue arrow down.

## 0.10.0 – 0.10.14

- The panel shows the colleagues at work in the project's other chats too, under At work with «in another chat» beside their role: each panel shares who works in its chat every 5 seconds: who starts, stops or changes step shows at once, what they are doing and their tokens every 15 seconds, as for one's own colleagues; a chat that closes stops showing within a minute.
- The bar's filled part is rounded at both ends too, at any width.
- Under a quick answer, a button opens a meeting with whoever answered, for ten minutes after the question.
- A colleague hired in a project that had no `.claude/agents/` when the chat started works from the next message, without restarting: Claude Code loads that folder only when it was there at the start, so the panel defines the new colleagues itself until the next chat.
- The panel opens by itself whenever a colleague starts a task or joins a meeting, even if it was closed.
- In a conversation, long work asked of a colleague goes in the background: they say so in their turn, leave the conversation (the others stay) and take it as a task, with its steps and report in the panel. A colleague's plans are always their own turn, under their name.
- The cards of the plan's limits are gone: their figures could be old, and the app shows them. At the top of the panel instead, the colleagues' week: their tasks, their tokens and who worked most.
- A colleague no longer shows twice at work when their first step comes while their start is still being recorded.
- Todos stay short: at the end of every task, round or conversation each colleague tidies theirs, removing what is done, merging duplicates and keeping at most 15 open lines, the most important first; the rest, and what no longer matters, goes to `notes/todo-archive.md`, never deleted. `/crew:tidy`, or the panel's Tidy button among the actions, has the colleagues picked, or with none those whose todo is past 15 lines, tidy theirs now, checking each line against the project.
- `/crew:panel` opens the panel through Claude, named like the other commands; `/crew-panel` stays, the panel's own command, which shows or hides it at once.
- A colleague checks their todo against where the project keeps the state of its work (its plan, decisions, tracker, history): Claude knows it from the project's context and names it in the brief, with the excerpts for a colleague who cannot read it.

## 0.9.0 – 0.9.8

- A quick question to a colleague: `/crew:ask Giulia -- the question`, "domanda per Giulia: …", or the Ask button on their card. They answer at once in the chat, in their own voice, and the chat is Claude's again: no task, no report, no meeting; what the exchange leaves worth keeping (your decision, something learned) becomes one line of their memory. A second question to the same colleague within ten minutes opens a conversation with them; a question that needs real work becomes a task at once. Something to check or change is still a task with its report; when in doubt Claude asks quickly.

- On a free colleague's card the effort is its meter, as on a card at work, beside the pencil and the opener on the name's row, pressed to change it, its words in a hint; the box that picks is a small square, ticked in the colleague's color, its hint above it.

## 0.7.1 – 0.8.12

- A colleague's card at work has one thing a line: the task, the step in progress with its number in their color, what they are doing now with its sign (📄 reading, ✎ editing, 🔎 searching, ▶ a command, told by the command's own description), then the bar and what the task costs: the model with its effort meter at the left, memory, tokens and time at the right behind their signs. The role is dimmed; the pencil of a colleague who may change files sits under their portrait, with a hint. The bar keeps its rounded ends at any width. Their card in the panel shows the same while they work.
- A colleague's own card: their work drawn as on their row; their profile at the bottom in sections that open one by one (who they are, what they are like, how they speak, what they know, how they work); the profile's description for Claude is no longer shown.
- The box that picks a free colleague for a meeting or a review is a small bordered button, with a check once picked; the picked card is tinted in their color.
- Finished, a card says how long the task took and has a Report button that opens what they answered.
- A colleague resumed by a message, or started before the panel saw them, shows at work.
- In a meeting, turns are short work-chat messages; Claude speaks as itself, with its own portrait, even when it forgets to write [Claude], and a note between tools that carries italics stays the narrator's; colleagues act within their permissions, and the narrator's italic lines name who acts.
- Hints under the pointer on the controls that are only a sign; the settings open from a gear beside the team's actions.

## 0.7.0

- One plugin: the panel is now inside `crew`. Remove the old `crew-mod` with `/plugin uninstall crew-mod@claude-crew`, then update `crew`.
- The colleagues' step tool is now `mcp__crew__step`: in each profile's `tools:`, `mcp__crew-mod__step` becomes `mcp__crew__step` (ask Claude to do it).

## 0.6.0

- The panel in eleven languages: English, Italian, Spanish, French, German, Portuguese, Japanese, Chinese, Korean, Arabic and Russian. It follows Claude Code's language, then the system's; everything Claude writes in the chat was already in yours.
- A settings page in the panel (⚙ at its top): the panel's language, and whether it opens by itself at the start of a session. Both are kept across sessions.

## 0.5.0

- The panel's buttons run commands that ask in the chat what they need, with the choice form: `/crew:review` asks what to review, `/crew:meeting` the meeting's topic (three proposals from the work and the todos, and a box for your own), `/crew:hire` starts the interview, `/crew:fire` asks for a yes, `/crew:portraits` the style. You can type them too, with the answer already given: `/crew:meeting Sara -- the map`.
- The style switch is gone from the panel: the portraits' command asks it.
- A finished colleague's report opens in the panel, from their row under Finished or from "Latest report" in their card.
- A meeting from the panel takes only the colleagues who are free; while a meeting goes on, the band above the prompt invites.
- A colleague's profile is a made-up person, never a real one, nor real employers or works as theirs.

## 0.4.0 – 0.4.5

- `/crew:init` sets the team up in the current project; the empty panel offers it with a button.
- The profile says where a colleague grew up, where they live and what they studied; their voice is soft, as people write at work, with at most an occasional saying from their region.
- Permissions are binding, and set by Claude at hiring from the colleague's field; one writer per file; a colleague at work or in a meeting takes no other task.
- Each report is kept in the colleague's notes; their card shows the week's tasks and refusals.
- Installing the panel installs the skill with it.
