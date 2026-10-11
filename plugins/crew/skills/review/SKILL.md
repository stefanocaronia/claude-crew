---
name: review
description: Run a review round with colleagues, first asking the user what to review. The Crew panel's review button runs it; the user may type it too.
argument-hint: "[first names] [-- subject]"
disable-model-invocation: true
---
Without a subject after `--`, ask first what to review, with the host's question tool (`AskUserQuestion` in Claude Code), else a short numbered list: three subjects drawn from the session's work (the step just done, the latest commits, the files changed) and from the open todo lines of the colleagues named (retests, lines waiting for this event), each with one line on what it covers and whose field it touches; the user's own answer is the fourth (Claude Code adds it). With names, the subjects are in their fields.

Then run the round on that subject as `<this skill's folder>/../crew/references/round.md` says, from step 1, with the colleagues named, or, with none named, those whose field the subject touches.
