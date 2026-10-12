---
name: ask
description: Put a quick question to one or more colleagues and have them answer at once in the chat, in their own voice, without a review, a task or a meeting. Use when the user asks a colleague something in passing ("domanda per Giulia: …", "chiedi a Matteo se…", "Sara, secondo te…", "ask Elena whether…"); not when they want something checked, researched or changed ("fai controllare a Giulia", "verifica con Matteo"), which is a task.
argument-hint: <first names> [-- question]
---
Run, with Bash, from the project's folder: `node "<this skill's folder>/../../scripts/conversation.mjs" ask <first names> -- <the question>`, with the first names the user named and their question as they put it. Then follow what it prints: each one asked answers once, starting with their name, and the chat is Claude's again.

Without a question (the panel's button sends only the name), ask the user in one line what they want to ask, then run the command with it.

If `node` is missing (the shell says it is not found or not recognized), follow `<this skill's folder>/../crew/references/conversation.md`, "A quick question" and "Without Node".
