---
name: talk
description: Hand the chat to one or more of the project's colleagues, one-to-one or as a meeting. Use whenever the user asks, in any words or language, to talk with colleagues by name ("voglio parlare con Matteo", "I want to talk to Matteo and Giulia", "fammi sentire Sara"); not when a colleague is only mentioned.
argument-hint: <first names>
---
Run, with Bash, from the project's folder: `node "<this skill's folder>/../../scripts/conversation.mjs" talk <first names>`, with the first names the user asked for. Then follow what it prints: from there on the colleagues speak, each message starting with the speaker's name.

If `node` is missing (the shell says it is not found or not recognized), do it by hand as `<this skill's folder>/../crew/references/conversation.md` says under "Without Node". Tell the user once that conversations need Node.js 20 or later to be kept reliably, and offer to install it (Windows: `winget install OpenJS.NodeJS.LTS`; macOS: `brew install node`; Linux: the distribution's package or nodejs.org), only if they say yes.
