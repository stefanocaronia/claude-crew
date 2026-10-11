---
name: init
description: Set up a team of colleagues in the current project, or adopt the reviewer agents it already has. Use when the user asks to start Crew here ("prepara un team per questo progetto", "set up Crew", "start a crew").
---
Load the `crew` skill and follow its `references/adopt.md`, from the project's folder: look at what exists, read the project, propose a team, and hire the roles the user picks.

If the project already has colleagues (agents in `.claude/agents/` with a `todo.md` in their memory folder), say who they are and ask whether to add someone or adopt other agents, instead of starting again.
