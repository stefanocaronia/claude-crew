# Crew

A plugin for [Claude Code](https://claude.com/claude-code) that gives your project a standing team of expert colleagues: they review the work in their field, take tasks, and talk with you one-to-one or in a meeting.

<p align="center">
  <img src="docs/crew.png" alt="A meeting with two colleagues in the chat, the meeting's card above the prompt, and the panel with the team: two in the meeting, one at work on a review, two on a coffee break" width="720">
</p>
<p align="center"><sub>A meeting in the chat, and the panel with the team beside it.</sub></p>

## What you get

- **Colleagues** for your project's fields, each with a profile, a memory that lasts across chats and a todo.
- **Review rounds**: at a milestone, the colleagues it touches review it, and their findings reach you as proposals.
- **Tasks**: Claude hands a colleague a check, a test or a change in their field, within the permissions you give them.
- **Conversations**: a quick question, a talk with one of them, or a meeting, each answering in their own voice.
- **A panel** beside the chat with the team, who is at work and on what, their reports and their tasks.
- **Portraits**, painted by an image connector or the Codex CLI, or drawn by Claude.

Everything lives in your project's `.claude/` folder: each colleague's profile, memory, todo and notes.

## Install

You need **Claude Code** and **Node.js 20 or later**. If you don't have Node.js, install it from [nodejs.org](https://nodejs.org) and check it with `node -v` in a terminal.

1. Open a terminal in your project's folder and start Claude Code (the desktop app's Code tab does not take `/plugin install`):
   ```
   claude
   ```
2. In the chat, add the plugin's marketplace:
   ```
   /plugin marketplace add stefanocaronia/claude-crew
   ```
3. Install the plugin:
   ```
   /plugin install crew@claude-crew
   ```
4. Close the chat and start a new one, so the plugin loads.
5. Set the team up:
   ```
   /crew:init
   ```
   Claude reads the project, proposes a few roles, and you pick who joins.

The panel opens beside the chat by itself, in the terminal and in the desktop app's Code tab; `/crew-panel` shows or hides it.

When Claude asks to run `node`, allow it: the plugin's commands run on it.

## Use it

Just talk to Claude:

- "hire a colleague for security"
- "run a review round on the parser"
- "ask Giulia whether the menu is clear"
- "I want to talk to Matteo and Giulia", then "back to Claude"
- "start the next task for Matteo"

Claude hands the colleagues work in their field as it goes, one task at a time each, and their findings come to you as proposals: you decide.

**Each colleague at work spends your plan's usage** as Claude does: fewer colleagues and narrower rounds spend less.

**Already have reviewer agents?** `/crew:init` adopts them as colleagues.

**Working with [Project](https://github.com/stefanocaronia/claude-project)?** The colleagues hold its backlog's tasks and propose new ones. Project is optional.

## Settings

Each colleague's card in the panel sets their effort and their permissions: **Read** the project, **Write** its files, **Testing**, **Web**. A reviewer starts with Read only. The panel's ⚙ picks its language and whether it opens at the start.

Claude knows the rest: ask it to change a setting.

## Development

```
node --test plugins/crew/scripts/conversation.test.mjs plugins/crew/scripts/portraits.test.mjs plugins/crew/hooks/pure.test.mjs
claude plugin test plugins/crew
claude plugin validate .
```

`node tools/demo.mjs <folder>` and `node tools/preview.mjs <folder>` make this README's picture again. Installed from a local folder (`/plugin marketplace add <folder>`), the plugin runs from a copy in Claude Code's cache: after a change, raise the version in `.claude-plugin/marketplace.json` and `plugins/crew/.claude-plugin/plugin.json`, run `claude plugin marketplace update claude-crew` and `claude plugin update crew@claude-crew`, and start a new chat. Each version is tagged on its commit, `git tag -a vX.Y.Z -m vX.Y.Z` and `git push --follow-tags`. The changes are in [CHANGELOG.md](CHANGELOG.md).

## Credits

The step tool, the run tracking and the drawings' light and dark colors follow [savvy-progress](https://github.com/johnnyvizz/claude-kit/tree/main/plugins/savvy-progress) by johnnyvizz (MIT).

## License

MIT. Crew is an independent project, not affiliated with or endorsed by Anthropic. Claude is a trademark of Anthropic.

## Development notes

Developed with the help of AI coding agents. Everything is designed, reviewed and tested by the project's human maintainer.

**We encourage everyone to use AI for their own purposes.**  
The means of production should belong to the people.  
Fight corporate control of technology, not our right to use it.
