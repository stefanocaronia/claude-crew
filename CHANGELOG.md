# Changelog

What changes for whoever uses Crew, version by version. Plugins update in a new chat: `/plugin`, Marketplaces, claude-crew, Update marketplace, or turn its auto-update on there.

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
