---
name: talk
description: Hand the chat to one or more of the project's colleagues, one-to-one or as a meeting. Use whenever the user asks, in any words or language, to talk with colleagues by name ("voglio parlare con Matteo", "I want to talk to Matteo and Giulia", "fammi sentire Sara"); not when a colleague is only mentioned.
argument-hint: <first names> [-- topic]
---
Run, with Bash, from the project's folder: `node "<this skill's folder>/../../scripts/conversation.mjs" talk <first names>`, with the first names the user asked for and, when they give a topic, the topic after `--` (`talk Matteo Giulia -- the map of a place`). Then follow what it prints: from there on the colleagues speak, each message starting with the speaker's name.

If `node` is missing (the shell says it is not found or not recognized), follow `<this skill's folder>/../crew/references/conversation.md`, "Without Node".
