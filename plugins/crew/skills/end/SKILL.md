---
name: end
description: Close the conversation with the colleagues and give the chat back to Claude. Use when the user ends it ("torna Claude", "riunione finita", "back to Claude", "the meeting is over").
---
Run, with Bash, from the project's folder: `node "<this skill's folder>/../../scripts/conversation.mjs" end`. Then follow what it prints: each colleague updates memory and todo, and Claude is back.

If `node` is missing (the shell says it is not found or not recognized), follow `<this skill's folder>/../crew/references/conversation.md`, "Without Node".
