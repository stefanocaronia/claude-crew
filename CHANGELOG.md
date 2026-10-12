# Changelog

What changes for whoever uses Crew, version by version. Plugins update in a new chat: `/plugin`, Marketplaces, claude-crew, Update marketplace, or turn its auto-update on there.

## 0.7.1 – 0.8.12

- A colleague's card at work has one thing a line: the task, the step in progress with its number in their color, what they are doing now with its sign (📄 reading, ✎ editing, 🔎 searching, ▶ a command, told by the command's own description), then the bar and what the task costs: the model with its effort meter at the left, memory, tokens and time at the right behind their signs. The role is dimmed; the pencil of a colleague who may change files sits under their portrait, with a hint. The bar keeps its rounded ends at any width. Their card in the panel shows the same while they work.
- A colleague's own card: their work drawn as on their row; their profile at the bottom in sections that open one by one (who they are, what they are like, how they speak, what they know, how they work); the profile's description for Claude is no longer shown.
- The box that picks a free colleague for a meeting or a review is a small bordered button, with a check once picked; the picked card is tinted in their color.
- Finished, a card says how long the task took and has a Report button that opens what they answered.
- A colleague resumed by a message, or started before the panel saw them, shows at work.
- In a meeting, turns are short work-chat messages; Claude speaks as itself, with its own portrait, even when it forgets to write [Claude]; colleagues act within their permissions, and the narrator's italic lines name who acts.
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
