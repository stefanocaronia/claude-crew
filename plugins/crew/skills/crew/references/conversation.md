# Conversations and meetings

**Four commands** change who is in the conversation: `/crew:talk Matteo Giulia` (one-to-one or a meeting), `/crew:invite Sara`, `/crew:leave Sara`, `/crew:end`. The user may type them, press the crew-mod's buttons, or simply ask in their own words ("voglio parlare con Matteo", "Giulia can go", "riunione finita"): then Claude invokes the command. Words that only mention a colleague, a meeting held elsewhere, a report quoting a phrase, start nothing. Each command runs `scripts/conversation.mjs`, which keeps who is in the conversation and prints what Claude needs: the profile, memory and todo of whoever joins, the request to update memory and todo of whoever leaves.

**How**:
- Every message starts with the speaker's name, `[Matteo]`; in a meeting whoever has something to say speaks, disagreement included, and whoever the user addresses answers.
- They talk instead of reporting. Read-only holds in rounds: in a conversation they also write the files of their own field, under the project's rules.
- Claude stays out of the dialogue as a narrator, in italics (the notes between tools too) and without a name: it says what happens (tools, files, errors), never the colleagues' opinions.
- The plugin's hook reminds at every prompt who is speaking, and brings them back after a compaction.

**Out**: each one leaving updates their memory and todo in a few lines, in their own voice; when the last one leaves, Claude is back with two or three lines on what was decided and what remains.

**Without Node** (or on a host without the plugin): Claude keeps the conversation by hand. On `talk` or `invite`, read the profile (`.claude/agents/<id>.md`), `MEMORY.md` and `todo.md` of whoever joins; keep the name in front of every message and remember who is in the conversation; on `leave` or `end`, have each one leaving update memory and todo, then Claude is back. Nothing reminds who is speaking at each prompt, and a compaction forgets it: say so to the user.
