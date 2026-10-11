---
name: portraits
description: Draw new portraits for some colleagues or the whole team, first asking the user the style. The Crew panel's portrait buttons run it; the user may type it too.
argument-hint: "[first names] [-- style]"
disable-model-invocation: true
---
Without a style after `--`, ask it first, with the host's question tool (`AskUserQuestion` in Claude Code), else a short numbered list: the four styles of `<this skill's folder>/../crew/references/portrait.md`, the team's current style first and marked so, each with a few words on its look and on what it needs (an image generator for realistic and anime).

Then draw them as portrait.md says, "Doing them again": the colleagues named, or, with none, the whole team.
