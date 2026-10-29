# Hiring a colleague

0. **Ask what the request leaves open**, when it does not say who is wanted (as `/crew:hire`, which the panel's button runs): an interview in the chat, one question at a time, each with two to four answers drawn from the project and the team, plus the user's own. Use the host's question tool when it has one (`AskUserQuestion` in Claude Code), else a short numbered list. Skip what the request already says.
   1. The field: what the team lacks now. Propose fields from the work in progress and from what no colleague covers in the team table, each with one line on why.
   2. Experience and character: a veteran who demands a lot or someone younger and curious; blunt or diplomatic when they disagree.
   3. The portrait style ([portrait.md](portrait.md)), only when the team has no style line yet.

   Then step 1, from the answers.
1. **Agree on who they are**, in one message the user can amend, and write nothing until they say yes:
   - the field, and why the team needs it now; what they review and what they leave to whom (the borders with the others);
   - first and last name, plausible in the project's language and culture, the first name unique in the team; age, where they grew up and where they live, what they studied, and a career that makes them credible; a made-up person: never a real one, nor real employers or works as theirs;
   - a character that is marked and unlike every colleague already on the team (read their profiles: no two share a temperament or a voice): their temperament (warm, gruff, ironic, shy, exuberant, theatrical…), their standards, what they cannot stand, how they get angry and how they joke, how they disagree;
   - how they talk, so anyone can tell them apart in a meeting without their name: rhythm and register, two or three phrases or habits of speech that are theirs, and their roots heard in it (the expressions of their region or language, a word of dialect now and then, never whole sentences the user cannot read);
   - their bonds: an affinity and a friction with two or three colleagues, in a line each, so a meeting has voices and not one tone;
   - `watches:`, the files of their field as globs (`src/mcp/**, docs/tools.md`): a commit that touches them reminds Claude of them;
   - their permissions, chosen by Claude from their field as [edit.md](edit.md) says ("Permissions") and written as `tools:`, one line in the proposal with why; their memory and todo they always write. Without Read or Write the panel refuses their reading or writing outside their memory folder. `mcp__crew__step` is among their tools too, to report their steps to the panel;
   - a color among `red, blue, green, yellow, purple, orange, pink, cyan` that no colleague has;
   - `model` and `effort` only when the user asks: otherwise they inherit the session's.

   The user may ask for someone else, or give criteria (experience, background, age, character, how they disagree): propose again until they are happy. They may also ask for two or three candidates, a few lines each, to pick from.
2. **Before the first hire in a project**, check whether `.claude/` is committed to a public repository: their memories hold notes about the user and the work. If so, tell the user and offer to ignore it in git or keep it in a private folder linked in.
3. **Write the profile**, `.claude/agents/<id>.md`, from [../templates/agent.md](../templates/agent.md), in the project's language: every section written for this person and this project. Keep the last two sections ("What you return", "Your memory") in meaning, with their headings translated: the plugin's hook leaves them out of conversations, and recognises them in English and Italian.
4. **Open their folder**, `.claude/agent-memory/<id>/`: `MEMORY.md` (`# <First>: memory`, then `## <date>: hired` and why, in a line or two) and `todo.md` (`# <First>: todo`, with the first tasks if there are any).
5. **Portrait**: [portrait.md](portrait.md).
6. **Add their row** to the team table.
7. **Tell the user** who joined, their field and their files. Claude Code picks up a new agent file during the session when `.claude/agents/` was there at its start; when it was not, the panel defines the new colleague, called by their id from the next message. Without the panel, a colleague the Agent tool does not list yet works from the next session.
