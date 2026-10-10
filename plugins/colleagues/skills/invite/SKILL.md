---
name: invite
description: Bring one or more colleagues into the conversation already going on with colleagues. Use when, during a conversation or meeting, the user asks to add someone ("chiama anche Sara", "let's hear Elena too").
argument-hint: <first names>
---
Run, with Bash, from the project's folder: `node "<this skill's folder>/../../scripts/conversation.mjs" invite <first names>`. Then follow what it prints.

If `node` is missing (the shell says it is not found or not recognized), do it by hand as `<this skill's folder>/../colleagues/references/conversation.md` says under "Without Node". Tell the user once that conversations need Node.js 20 or later to be kept reliably, and offer to install it (Windows: `winget install OpenJS.NodeJS.LTS`; macOS: `brew install node`; Linux: the distribution's package or nodejs.org), only if they say yes.
