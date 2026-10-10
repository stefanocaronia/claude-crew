---
name: end
description: Close the conversation with the colleagues and give the chat back to Claude. Use when the user ends it ("torna Claude", "riunione finita", "back to Claude", "the meeting is over").
---
Run, with Bash, from the project's folder: `node "<this skill's folder>/../../scripts/conversation.mjs" end`. Then follow what it prints: each colleague updates memory and todo, and Claude is back.

If `node` is missing (the shell says it is not found or not recognized), do it by hand as `<this skill's folder>/../crew/references/conversation.md` says under "Without Node". Tell the user once that conversations need Node.js 20 or later to be kept reliably, and offer to install it (Windows: `winget install OpenJS.NodeJS.LTS`; macOS: `brew install node`; Linux: the distribution's package or nodejs.org), only if they say yes.
