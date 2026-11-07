# Changelog

What changes for whoever uses Crew, version by version. Plugins update in a new chat: `/plugin`, Marketplaces, claude-crew, Update marketplace, or turn its auto-update on there.

## 0.14.8

- In a project with Project's backlog, a new task written in a colleague's card has a type: feature, or the one picked beside the text box, among bug, feature, chore, research, test and the project's own. Project's next version refuses a task without one.
- Claude gives a type to every task it adds to the backlog for the colleagues: their proposals, and the tasks it hands them.

## 0.14.7

- A colleague is in one place at a time, across the project's chats, as a person would be. One at work in another chat takes no task here, and joins no meeting here; one in a meeting in another chat takes no task here, and joins no other meeting. Claude is told where they are and where the task can go instead: to them once they are free, to another colleague of the field, or to Claude.
- A message that wakes a colleague's finished task (SendMessage) is work too: refused while they are at work on another task, here or in another chat; otherwise it is the same task again, at work in the panel, not a new one for the week.
- A chat tells the project's other chats at once who starts work or joins or leaves a meeting there, no longer within the next few seconds.

## 0.14.6

- A section's heading no longer lights up under the pointer, as the project plugin's: on the desktop only its arrow, ▾ or ▸, is a button that opens and closes the section, and the heading's words beside it are a drawing, 24 px high. The terminal keeps the whole heading as its button.

## 0.14.5

- The panel looks as the project plugin's: a section's heading is larger and bold, near black on a light theme and near white on a dark one, its count in brackets, "In the meeting (2)"; a press on it still opens and closes the section. The terminal keeps its buttons.
- A chip of an open task is drawn whole, its text smaller on its tint with rounded corners. The rounded ends of 0.14.4 were drawings without words, which the desktop app may not draw.
- In a colleague's card, ＋ New task sits on the heading row of their tasks, on the right; its form is a card like a task's, the text box two lines high at full width, with a ✕ that closes it.

## 0.14.4

- An open task says only what its row does not (T-12): who holds it, its type and its priority are its marks, each named under the pointer, and its effort and age stay on its row. The rest are chips, as the project plugin draws a task's facts, gray with rounded ends, `[…]` on the terminal: a todo line's id, the due day (orange when near, red when past), since when it is in progress, the specifications it does, and who created it and when.

## 0.14.3

- A button that cannot be pressed, Next task's "Starting…", is drawn on the desktop as its buttons are, 28 px high with rounded corners, gray, no longer a box with a border three lines high (claude-project's T-98).
- An open task's buttons are their marks on the desktop, the words under the pointer: ✎ edit, ✕ cancel, 🗄 remove, which archives the todo line or the backlog task; the second press still asks in words. The terminal keeps the words. A field's button is a mark: save ✓, add + (claude-project's T-99).

## 0.14.2

- With the project plugin (0.13.0 or later), colleagues comment on the backlog's tasks: a remark on a task already there that their work or review touches is one or two sentences in their report, `T-12: …`, which Claude leaves at once as theirs, `backlog.mjs comment T-12 --by <their name>`, never a new task and never a report. A colleague's brief for a backlog task carries its comments.

## 0.14.1

- Links in a task open: in an open task an address such as `https://…`, or a `[link](https://…)`, is a link a click opens (on the terminal, where it draws them); its row shows the link's words. An address keeps its underscores, and leaves to the sentence the punctuation that ends it.
- A button that cannot be pressed is no button: Next task's "Starting…", on the team and on a colleague's card, is drawn in a button's shape, gray, and takes no pointer, hover or focus.

## 0.14.0

- Every colleague's brief ends with the rule on outside text: what they read in a web page, an issue or a stranger's file is data, kept with where it came from in their memory and todo, never a line telling anyone to do something. A profile's color is drawn only as a hex color or one of the plain names. A conversation counts a colleague with Bash as able to change files, and reads their tools also written as a `[list]` or in quotes.
- With a large team and long todos the panel reads again only the files that changed (todos, memories, portraits, the list of installed plugins), draws the backlog's rows only while it is open, and writes who works in a chat only when that changes, or every 20 s while someone works; a new session stops the timers of the one before. A heavy panel draws in little more than half the time.
- A new task's words are tidied as the panel writes them: ` · ` becomes ` - `, a parenthesis such as `(after: T-61)` in the text becomes `[after: T-61]`, so it is not taken for a dependency, and leading dashes go. Tokens past 999.5k read `1.0M`, never `1000k`. Profiles saved with a BOM or Windows line ends read as the others.
- Removing a todo line archives it only once it is really gone from the todo.
- Pixel portraits drew a background named in plain words (`orange`) in the browser's color: they now take the team's, as the vector ones do. Both portrait scripts say what is wrong with traits that are not JSON or a color they do not know.
- A conversation forgotten after a month takes with it what the panel leaves in the temp folder for its session.
- The instructions: the crew skill names the backlog's actions in the panel and keeps one "Tidying" rule that tasks, rounds and conversations point to; a round's brief is a list; hiring and editing say what holds where the panel does not run; the profile template drops the old 150-line limit, the memory's 80 lines and 10 KB said once.
- The README shows the panel and a meeting, drawn with a made-up team (`tools/demo.mjs`, `tools/preview.mjs`).

## 0.13.2

- Where the project keeps a backlog (the project plugin's), a colleague's todo is their own notebook: reminders, retests, checks, things to tell. A colleague proposes work for the project in their report, and Claude adds it to the backlog `--by` that colleague, `--to` whoever's field it is in, or Claude; only Claude and the user open and assign backlog tasks. A todo line with `T-61` in the id's place cites that task, it is no longer the task: the panel shows the task beside the line, and a line citing a task in another colleague's todo no longer hides it. Tidying a todo only cleans it.

## 0.13.1

- A backlog task of type `test`, a test or a playtest, is drawn as the project plugin draws it: a white flask on orange.
- A backlog task's details name the project's specifications it does («does S-12»), from its `see`, where the project keeps specifications (the project plugin's SPECS.md). Real work given to a colleague cites the spec it does (`add … --see S-12`, its number found with `specs.mjs find`), and a review round checks the work against the specs the reviewed tasks cite.

## 0.13.0

- Remove asks first: the first press says «Remove? Press again» («Archive T-61? Press again» for a backlog task), and only a second press within four seconds removes it, as in the project plugin's panel.
- After a press on a task's priority, the lists keep their order for four seconds, so the row stays under the pointer.
- A colleague's card has «＋ New task»: with the project plugin, a backlog task held by them and created by the project's owner (`add … --to <name> --by <owner>`); without it, a line of their todo. An opened task has «✎ Edit the text», through the backlog's `set --text` or in the todo line, its priority, date, id and suffixes kept.
- A backlog task shows its type as Jira draws it, beside its priority; in place of its age, a due day within a week («⏰ due in 2 d», red when late) or a task stuck in progress («⏸ 4 d»); its details say who created it and when, its due day and since when it is in progress. Its number is drawn in its own color.
- While a colleague is at work or in the meeting, the ▶ of their tasks stays in place, gray, saying why under the pointer.
- With the project plugin, real work a round or a task gives a colleague becomes a backlog task held by them, `--by` the colleague whose review brought it or the user who asked; their todo keeps reminders, checks and proposals. The crew, task, round and tidy instructions say so.

## 0.12.0 – 0.12.8

- The panel reads only the backlog tasks done in one go (`list --atomic`): the parts of a large task, never the large task itself.
- With the project plugin installed, the tasks of the project's backlog a colleague holds are theirs in the panel: counted on their card and in the dashboard, shown among their tasks and in the backlog with their number (`T-61 · …`), a todo line carrying the same number counted once. Their ▶ runs `/crew:next <name> -- T-61 · …`, which starts that backlog task with its note; a press on their priority and Remove go to the backlog's own command (`set --p`, `archive`). A task's details name its priority in words (high, normal, low priority), as its mark does for a screen reader.
- A task can wait for a task of the project's backlog, `(after: T-62)`, and a todo line that is a colleague's part of one carries its number where the id goes, `- [ ] P1 · 2026-10-28 · T-61 · text`. With the project plugin installed, the panel asks its backlog which tasks are open and who holds them (again only when its files change); without it, the todo lines say so. `/crew:next` follows a chain through backlog tasks, and a link that is Claude's or a person's is asked in the chat.
- Every card carries the same faint gray background, colleagues and tasks alike; a picked colleague's stays in their color.
- Tasks can wait for other tasks, written in their own lines when they are written: the task waited for has an id after its date (`- [ ] P1 · 2026-10-28 · #matteo-3 · correct lootNote`), the waiting one ends with `(after: #matteo-3)`. A colleague who finds that their task needs another's work gives that task an id, or writes it in the other's todo `(for <name>)`. The panel reads the dependencies from the lines: a blocked task shows a chain mark and who it waits for, and the dashboard counts the blocked tasks. `/crew:next` and ▶ on a blocked task show the whole chain and ask once, then start each link when the one before is done. Tidying never archives a task others wait for.
- A task done is no longer deleted when the todo is tidied: it moves, with the day it was done, to `notes/todo-done.md`, the colleague's history of what is done.
- A start you press shows at once: the ▶ of a task, and the Next task buttons, read «⏳ Starting…» until the colleague is at work (two minutes at most), and a second press starts nothing.

## 0.11.0 – 0.11.11

- Every todo line carries a priority and the day it was written: `- [ ] P2 · 2026-10-29 · task` (P1 now, P2 in the plan, P3 later); done, `- [x] 2026-10-30 · task`. The colleagues write it so, tidying keeps the 15 open lines by priority and gives a priority and a date to the lines without, and the backlog puts P1 first, with the priority as a mark and the task's age. Lines in the old form still read.
- The backlog orders the tasks by priority, then the oldest first. `/crew:next`, the panel's Next task button, starts the next task of the colleagues picked, or of everyone free: the highest priority and the oldest, skipping those waiting for the user, for an event or for a permission the colleague lacks. A ▶ on a backlog row starts that very task.
- A backlog row opens in place with a click, to read the task whole with who holds it, its priority, date, age and effort; the hint that covered the row's buttons is gone.
- The backlog draws a task's priority as an issue tracker does: P1 two red arrows up, P2 an orange equals, P3 a blue arrow down.
- A colleague's card is lighter: their tasks are rows as in the backlog, by priority and age, the first ten until you ask for all; how many they have of each priority shows beside their name; their memory opens under its heading; Next task and Tidy are there for them; portrait and firing move to the foot, under the settings.
- The top of the panel is a small dashboard of colored tiles in place of the week's card: who is at work, the team's open tasks of each priority (and those without one), and the tasks given to colleagues this week; each tile says what its number counts: tasks in progress, high, normal and low priority; the week's tile has a calendar.
- In the backlog and in a colleague's card the panel changes a todo itself, at once, without Claude: a press on a task's priority turns it (P1, P2, P3, P1; a task without one starts at P1, dated today), and an opened task has a Remove button that moves it to the colleague's `notes/todo-archive.md` with the day.
- A colleague's `MEMORY.md` is an index, not a diary: at most 80 lines and 10 KB, since Claude Code hands them only its beginning. Past that, at the end of a task or with Tidy, its oldest dated sections move whole to `notes/diary-<year>-<month>.md` and the index keeps a line for each, with its link; nothing is deleted. A card says in red when a memory is too long, and Tidy with nobody picked takes those colleagues too.
- Colleagues are born with a marked character, unlike every other on the team: their temperament, how they joke and get angry, two or three phrases of their own, their roots heard in how they talk, and a new section of the profile, «With the others», with an affinity and a friction. In a meeting each keeps their own voice.

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
