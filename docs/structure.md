# Structure

What each folder of the repository holds, what it depends on, and where new code goes. It changes in the same change that adds, moves or removes a folder.

## The repository

| Folder | Holds |
|---|---|
| `.claude-plugin/` | the marketplace, `marketplace.json`, which lists the plugin |
| `plugins/crew/` | the plugin, the only thing that is installed |
| `docs/` | the guide for users (`guide.md`), this page, the README's picture |
| `tools/` | the maintainer's scripts, never installed: `preview.mjs` draws the panel as an HTML page, `demo.mjs` makes a made-up team for the README's picture |
| `project/` | the maintainer's own plan and tasks, a private repo of their own, ignored here |

## The plugin, `plugins/crew/`

| Folder | Holds | Runs in |
|---|---|---|
| `.claude-plugin/plugin.json` | the plugin's manifest | |
| `skills/` | one folder a skill: `crew` is the guide to the files and the operations, with its `references/` and `templates/`; the others (`talk`, `hire`, `review`, …) are the commands, each a `SKILL.md` | Claude reads them |
| `hooks/` | the mod: the panel, the meeting's chat, the guards on tool calls, the coordinator in the system prompt; `hooks.json` names its entry, `register.tsx`, and the command hooks | the engine's sandbox: no DOM, no Node, everything through `$` |
| `scripts/` | the Node scripts the skills and the command hooks run | Node |
| `types/` | the mod's contract: the values it keeps in `$.state` and the shapes they share | |

### `hooks/`

`register.tsx` only wires the engine's events to the folders that answer them. Each folder is a module: its `index.ts` (or the file the table names) is what the others import, the rest is its own.

| Folder | Holds |
|---|---|
| `session/` | what the session holds: the state's initial values and this load's own (`state.ts`), the panel's language and settings, its pane |
| `text/` | the panel's words, one file a language (`en.ts` sets the shape the others follow), and the formats: tokens, times, dates, names, links |
| `files/` | the project's files as the panel reads them, with their stamps; paths as the guards compare them |
| `draw/` | what the panel and the chat draw the same: the SVGs (`svg.ts`), portraits, names, captions |
| `team/` | the colleagues as their files describe them (`profile.ts`), their todo, the project plugin's backlog, the team read into the session, a colleague's card, their reports, where their folders are |
| `work/` | the colleagues at work: their runs and steps, what they are doing, the week's counts, who works in the project's other chats, the rules they work under (`guards.ts`) |
| `meeting/` | a conversation: who is in it, and a reply read turn by turn with its speakers |
| `chat/` | the chat's own drawings: the meeting's band above the prompt, a reply where colleagues speak as a group chat, with its pictures |
| `panel/` | the panel beside the chat (`pane.tsx`): what one drawing reads and makes of it (`scene.ts`), its controls, its views (team, card, report, settings) and their parts |

The engine takes a value of `$.state` only through an atom declared in the file that reads or writes it: each file declares the atoms it uses, from `session/`'s `initial`.

Tests: `register.test.tsx` (the mod, with `claude plugin test`) and `pure.test.mjs` (the pure functions, with `node --test`, which imports their files directly: Node cannot load `claude-code` or `.tsx`).

### `scripts/`

| Script or folder | Holds |
|---|---|
| `conversation.mjs` | who is in the conversation, run by the skills and as the command hook at every prompt |
| `folders.mjs` | where the colleagues' files are, `.claude` or the project's docs, and the links between them |
| `portrait/` | the portraits: `pixel.mjs` and `vector.mjs` draw an SVG from `traits.mjs`, `codex.mjs` asks the Codex CLI for a picture |

Each has its `*.test.mjs` beside it.

## Where new code goes

- Something the panel or the chat shows, or a hook on the engine: `hooks/`, in the folder of its area, or a new one; `register.tsx` only wires it.
- Something a skill runs with Node: `scripts/`, in a folder of its own once it has more than one file.
- A new command: a folder under `skills/`.
- What Crew reads or writes of Project goes in both guides, in the same words (see [CLAUDE.md](../CLAUDE.md)).
