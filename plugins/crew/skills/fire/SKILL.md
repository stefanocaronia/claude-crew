---
name: fire
description: Fire one or more colleagues, after the user confirms. The Crew panel's fire buttons run it; the user may type it too.
argument-hint: <first names>
disable-model-invocation: true
---
First ask for the user's yes, with the host's question tool (`AskUserQuestion` in Claude Code), else a yes-or-no question in the chat: who leaves, and that their profile and memory are archived, not deleted. Three answers: fire them; change them instead (field, tools, character); keep them.

On the first, follow `<this skill's folder>/../crew/references/fire.md` from step 2. On the second, ask what to change and follow `<this skill's folder>/../crew/references/edit.md`. On the third, nothing changes.
