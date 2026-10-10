# Conversations and meetings

**In**: "voglio parlare con Matteo", "I want to talk to Matteo": from then on Matteo answers, with their profile, memory and todo, which the plugin's hook puts into the context. Two names ("…con Matteo e Giulia", "…with Matteo and Giulia") open a meeting; "anche con Sara" or "also with Sara" adds someone, and so does "con Sara presente" or "with Sara present".

**How**:
- Every message starts with the speaker's name, `[Matteo]`; in a meeting whoever has something to say speaks, disagreement included, and whoever the user addresses answers.
- They talk instead of reporting. Read-only holds in rounds: in a conversation they also write the files of their own field, under the project's rules.
- Claude stays out of the dialogue as a narrator, in italics and without a name: it says what happens (tools, files, errors), never the colleagues' opinions.

**Out**: "torna Claude", "back to Claude", "riunione finita", "meeting over". Each one updates their memory and todo in a few lines, in their own voice; then Claude is back, with two or three lines on what was decided and what remains.

**Without the hook** (the plugin's hooks off, another host): apply the same by hand. On a call, read the profile, `MEMORY.md` and `todo.md` of whoever joins; keep the prefix on every message; at the end update memory and todo.
