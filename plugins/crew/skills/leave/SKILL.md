---
name: leave
description: Let one or more colleagues leave the conversation while the others stay. Use when the user lets someone go ("Giulia può andare", "thanks Sara, you can go").
argument-hint: <first names>
---
Run, with Bash, from the project's folder: `node "<this skill's folder>/../../scripts/conversation.mjs" leave <first names>`. Then follow what it prints: who leaves updates memory and todo; the last one leaving closes the conversation.

If `node` is missing (the shell says it is not found or not recognized), do it by hand as `<this skill's folder>/../crew/references/conversation.md` says under "Without Node". Tell the user once that conversations need Node.js 20 or later to be kept reliably, and offer to install it (Windows: `winget install OpenJS.NodeJS.LTS`; macOS: `brew install node`; Linux: the distribution's package or nodejs.org), only if they say yes.
