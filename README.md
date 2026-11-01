# Crew

A standing team of expert colleagues for your projects, in Claude Code. Each colleague is a subagent with a profile, a memory that lasts across sessions and a todo: they review the work in their field at milestones, and you can talk with them one-to-one or in a meeting.

```
> voglio parlare con Matteo e Giulia
[Matteo] Ho riletto il passo 9: due cose non mi tornano…
[Giulia] Io invece partirei dalla prova di ieri sera…
> riunione finita
```

One plugin, `crew`:

- **The skill**: setting the team up, hiring and firing, portraits, review rounds, tasks, conversations and meetings. Its commands are `/crew:init`, `/crew:review`, `/crew:meeting`, `/crew:ask`, `/crew:talk`, `/crew:invite`, `/crew:leave`, `/crew:end`, `/crew:hire`, `/crew:fire`, `/crew:portraits`, `/crew:tidy`, `/crew:next` and `/crew:panel`; a hook hands the chat over to the colleagues and back.
- **The panel**, beside the chat:
  - a small dashboard of colored tiles: tasks in progress, open tasks of high, normal and low priority, blocked tasks, tasks given this week;
  - the team in four sections: in the meeting, at work (the steps they report, their context, tokens and time), finished (their report one press away), on a coffee break;
  - buttons for a review, a meeting, hiring, firing, new portraits, Tidy and Next task; each runs a command that asks in the chat what it needs;
  - the backlog of open tasks, by priority and then the oldest first (see [Tasks](#tasks));
  - a colleague's card: their tasks by priority, a new task, their latest memory (in red past 80 lines or 10 KB, the most Claude Code hands a colleague), their profile and settings, effort and permissions;
  - eleven languages (English, Italian, Spanish, French, German, Portuguese, Japanese, Chinese, Korean, Arabic, Russian), following Claude Code's language or the system's; its settings page (⚙) picks another and says whether it opens at the start of a session.
- **The group chat**: in a meeting, each colleague's turn is drawn under their portrait, name and role, and a card above the prompt holds the participants, an invite menu and the button that closes it.

## Requirements

- **Node.js 20 or later**: check with `node -v` in a terminal. If it says the command is not found, install the LTS version from nodejs.org and open the terminal again. If you don't have it, that's fine too: the panel works, Claude keeps conversations by hand and offers to install Node for you.
- **Claude Code 2.1.287 or later** for the panel: check with `claude --version` (the desktop app from 2.1.286). The panel shows in the terminal and in the desktop app's Code tab; in VS Code the hooks run but the panel does not show.
- Install from a terminal `claude` session: the desktop app's Code tab does not take `/plugin install`. The commands run `node` through Bash: allow it once when Claude asks.
- Optional, for painted portraits: the Codex CLI logged in with ChatGPT, or an image-generation connector. Without them, Claude draws pixel-art or cartoon portraits in SVG.

## Install

```
/plugin marketplace add stefanocaronia/claude-crew
/plugin install crew@claude-crew
```

Until 0.6 the panel was a separate plugin, `crew-mod`: if you have it, remove it with `/plugin uninstall crew-mod@claude-crew`, then update `crew`.

## First steps

1. Open a terminal in your project's folder and type `claude`.
2. Paste the two install lines above.
3. Open a new chat (or restart the app): plugins load when a chat starts.
4. Type `/crew:init`, or ask "set up a team of colleagues for this project". Claude reads the project, proposes a few roles, and you pick.

## Use

Ask Claude in your own words; the `crew` skill knows the operations:

| Ask | What happens |
|---|---|
| `/crew:init`, or "set up a team of colleagues for this project" | Claude reads the project, proposes three to eight roles, you pick, they are hired |
| "hire a colleague for security" / "assumi un collega per la sicurezza" | a profile (who they are, where they grew up and studied, how they work and how they talk), a memory folder, a todo, sensible permissions and a portrait |
| "fire Sara" / "licenzia Sara" | their open tasks are reassigned or closed, profile and memory archived |
| "change Matteo's tools" | the profile changes, the memory notes why |
| "a portrait for each colleague" | an image connector, the Codex CLI, or Claude drawing SVG, in one style for the team |
| "run a review round", or `/crew:review Matteo Giulia` | Claude asks what to review; the colleagues whose field it touches review it in parallel; findings reach you as proposals, one at a time; each report stays readable in the panel |
| any work Claude does | Claude hands a colleague a check, a test or a change in their field whenever it helps, within the permissions you set in their card: Read, Write, Testing, Web |
| "domanda per Giulia: …", "ask Matteo whether…", or `/crew:ask Giulia -- the question` | they answer at once in the chat, in their own voice, and the chat is Claude's again: no task, no report |
| "voglio parlare con Matteo", "I want to talk to Matteo and Giulia", or `/crew:talk Matteo Giulia` | they answer in the chat, each message starting with their name, until you close it ("back to Claude", `/crew:end`) |

`/crew:init` sets the team up in the current project; if it already has colleagues, Claude says who they are and asks whether to add someone. Conversations go through four commands, `/crew:talk Matteo Giulia`, `/crew:invite Sara`, `/crew:leave Sara` and `/crew:end`; `/crew:meeting Matteo Giulia` asks the topic first. The panel's other buttons run `/crew:review`, `/crew:hire`, `/crew:fire`, `/crew:portraits`, `/crew:tidy` and `/crew:next`, which only you or the panel start. You can type them, press the panel's buttons, or just ask in your own words in any language: Claude invokes them. Nothing starts from a phrase that only mentions a colleague.

The panel opens by itself at the start of a session in a project with colleagues, and whenever a colleague starts a task or joins a meeting. `/crew:panel` asks Claude to open it, as asking in words does; `/crew-panel`, the panel's own command, shows or hides it at once, without Claude.

## Permissions and tasks

Each colleague has four permissions, set in their card or by Claude at hiring from their field: **Read** the project, **Write** its files, **Testing** (run commands, which brings Write, since a command can change files), **Web**. A reviewer starts with Read only: they give opinions and touch nothing but their own notes. Without Read or Write, the panel refuses their reading or writing outside their own memory. Claude hands a colleague a check, a test or a change in their field whenever it helps, within those permissions; a colleague at work or in a meeting takes no other task.

**Cost.** Each colleague at work is a subagent and spends your plan's usage like Claude does: a review round with five colleagues costs about five tasks. Fewer colleagues, narrower rounds, lower effort in their card: all spend less.

A meeting can open on a topic: `/crew:meeting Matteo Giulia -- the parser`, or in words. Each version's changes are in [CHANGELOG.md](CHANGELOG.md).

## Tasks

A colleague's `todo.md` holds one task a line, with a priority (P1 now, P2 in the plan, P3 later) and the day it was written: `- [ ] P2 · 2026-10-29 · task`; done, `- [x] 2026-10-30 · task`, moved at the next tidying to `notes/todo-done.md`. At most 15 lines stay open; the rest go to `notes/todo-archive.md`, never deleted.

- **Waiting for another task**: the task waited for carries an id after its date, `#matteo-3`, and the waiting one ends with `(after: #matteo-3)`. The panel shows who it waits for; `/crew:next` and ▶ show the whole chain and start each link after one yes.
- **In the panel**: a row opens in place to read the task whole, edit its words or remove it (to the colleague's archive, after a second press); a press on its priority turns it, P1, P2, P3, the rows keeping their places for a few seconds; ▶ starts it, gray while the colleague is busy.
- **`/crew:next`**, or Next task: the next open task of the colleagues picked, or of everyone free, the highest priority and the oldest first, skipping those waiting for you, for an event or for a permission the colleague lacks. **`/crew:tidy`** ticks what is already done, merges duplicates and archives the rest.

**With the [project](https://github.com/stefanocaronia/claude-project) plugin**, the project's work lives in its backlog of numbered tasks, and a colleague's todo is their own notebook: reminders, retests, checks, things to tell. Only Claude and you open and assign backlog tasks: a colleague proposes work in their report, and Claude adds it to the backlog, by them, held by whoever's field it is in. Then:

- the backlog tasks a colleague holds count among their tasks and show in the panel with their number, type, due day, creator and the specifications they do; their priority, words and removal go through the backlog's own command, and a colleague's card adds a new one there;
- a todo line may cite a backlog task by its number in the id's place, `- [ ] P2 · 2026-10-28 · T-61 · retest once it is done`, and a task may wait for one, `(after: T-62)`, open as the backlog says.

## Files

Everything stays in your project, under `.claude/`:

```
.claude/agents/matteo-conti.md          the profile: who they are and how they work
.claude/agent-memory/matteo-conti/
    MEMORY.md                           their memory, an index of at most 80 lines, handed to them at every round
    todo.md                             their tasks, or with the project plugin their notebook
    avatar.jpg, avatar-small.jpg        their portrait at 128 and 32 px (or avatar.svg)
    notes/                              longer notes and reports, linked from MEMORY.md
    notes/todo-done.md                  the tasks done, each with its day
    notes/todo-archive.md               the open tasks set aside
    notes/diary-<year>-<month>.md       the memory's older sections
.claude/agent-memory/_former/           colleagues who left
```

## Development

```
node --test plugins/crew/scripts/conversation.test.mjs plugins/crew/hooks/pure.test.mjs
claude plugin test plugins/crew
claude plugin validate .
```

Installed from a local folder (`/plugin marketplace add <folder>`), the plugin runs from a copy in Claude Code's cache, not from the folder: after a change, raise the version in `.claude-plugin/marketplace.json` and in `plugins/crew/.claude-plugin/plugin.json`, then run `claude plugin marketplace update claude-crew` and `claude plugin update crew@claude-crew`, and start a new session.

To see the mod as the desktop gets it, with a project's real colleagues, `node tools/preview.mjs <project> [--meeting matteo-conti,giulia-ferri] [--working elena-galli]` writes an HTML page (by default in the project's `tmp/`): the trees the mod hands over, in the app's dark colors.

## Credits

The step tool, the run tracking and the drawings' light and dark colors follow [savvy-progress](https://github.com/johnnyvizz/claude-kit/tree/main/plugins/savvy-progress) by johnnyvizz (MIT).

## License

MIT. Crew is an independent project, not affiliated with or endorsed by Anthropic. Claude is a trademark of Anthropic.

## Development notes

Developed with the help of AI coding agents. Everything is designed, reviewed and tested by the project's human maintainer.

**We encourage everyone to use AI for their own purposes.**  
The means of production should belong to the people.  
Fight corporate control of technology, not our right to use it.
