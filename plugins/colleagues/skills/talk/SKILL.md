---
name: talk
description: Hand the chat to one or more of the project's colleagues, one-to-one or as a meeting. Use whenever the user asks, in any words or language, to talk with colleagues by name ("voglio parlare con Matteo", "I want to talk to Matteo and Giulia", "fammi sentire Sara"); not when a colleague is only mentioned.
argument-hint: <first names>
---
Run, with Bash, from the project's folder: `node "<this skill's folder>/../../scripts/conversation.mjs" talk <first names>`, with the first names the user asked for. Then follow what it prints: from there on the colleagues speak, each message starting with the speaker's name.
