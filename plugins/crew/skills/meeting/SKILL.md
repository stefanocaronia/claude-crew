---
name: meeting
description: Open a meeting with colleagues, first asking the user the topic. The Crew panel's meeting button runs it; the user may type it too.
argument-hint: "<first names> [-- topic]"
disable-model-invocation: true
---
Without a topic after `--`, ask it first, with the host's question tool (`AskUserQuestion` in Claude Code), else a short numbered list: three topics drawn from the session's work and from these colleagues' open todo lines (proposals waiting for the user first), each with one line on why; the user's own answer is the fourth (Claude Code adds it).

Then run, with Bash, from the project's folder: `node "<this skill's folder>/../../scripts/conversation.mjs" talk <first names> -- <topic>`, and follow what it prints: from there on the colleagues speak, each message starting with the speaker's name.

If `node` is missing (the shell says it is not found or not recognized), follow `<this skill's folder>/../crew/references/conversation.md`, "Without Node".
