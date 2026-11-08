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
2. **Before the first hire in a project**, see where the team will live: `node "<this skill's folder>/../../scripts/folders.mjs" status`, from the project's folder. With `"mode": "shared"` (the project plugin's docs are a git repo of their own) the team lives in `<docs>/crew/`, private and shared with the docs, and `.claude/agents` and `.claude/agent-memory` are links kept out of the code's repo: with `"due": "create"` run the script with `link --create`; with `"due": "link"` the team is there already and this machine lacks only the links, so run it with `link`; with `"due": "move"` the team is still in `.claude`, and the panel's button, or the script's `move`, moves it on the user's yes; with `"due": "conflict"` both places hold files: tell the user, and merge them on their yes before hiring. Otherwise, or without Node, check whether `.claude/` is committed to a public repository: their memories hold notes about the people and the work. If so, tell the user and offer to ignore it in git or keep it in a private folder linked in.
3. **Write the profile**, `.claude/agents/<id>.md`, from [../templates/agent.md](../templates/agent.md), in the project's language: every section written for this person and this project. Keep the last two sections ("What you return", "Your memory") in meaning, with their headings translated: the plugin's hook leaves them out of conversations, and recognises them in English and Italian.
4. **Open their folder**, `.claude/agent-memory/<id>/`: `MEMORY.md` (`# <First>: memory`, then `## <date>: hired` and why, in a line or two) and `todo.md` (`# <First>: todo`, with the first tasks if there are any).
5. **Portrait**: [portrait.md](portrait.md).
6. **Add their row** to the team table.
7. **Tell the user** who joined, their field and their files. Claude Code picks up a new agent file during the session when `.claude/agents/` was there at its start; when it was not, the panel defines the new colleague, called by their id from the next message. Where the panel does not run, a colleague the Agent tool does not list yet works from the next session.

## The coordinator

The user may want the chat's Claude to have a personality, a name, a character and a memory: a coordinator, at most one in a team. They are not someone beside Claude: they are the Claude of the chat, in every turn and in the meetings too. Hire them as above, with these differences:
- their field is the team and the work: Claude's own, with a person's name. The interview asks only experience, character, their role if not «your assistant», and whether they want a portrait: without one the panel and the chat draw Claude's face. Step 1 has no borders, `watches:`, permissions, `model` or `effort`, since their tools and model are the chat's;
- their role, after the name in the heading, is «your assistant» in the project's language («Elena Rossi, il tuo assistente»), unless the user picks another in the interview: it is drawn under their name in the panel and in the meetings, as Project reads it too;
- their first name is one no colleague has, as a colleague's is: the chat shows Claude's turns under it; their id is their first and last name, as a colleague's; a coordinator called only Claude takes `claude-coordinator`, never `claude`: a profile of the project takes the place of the user's agent of the same name, and the panel would refuse to start it;
- the profile is written from [../templates/coordinator.md](../templates/coordinator.md): `coordinator: true` in its frontmatter, and a description that says they are the Claude of the chat, never to be started as a subagent («Elena Rossi, your assistant. The Claude of this chat, hired with Crew: never start them as a subagent.»), since Claude Code lists every profile of `.claude/agents/` among its agents;
- their folder holds `MEMORY.md`, and `todo.md` only where the project keeps no backlog: with one, Claude's tasks there are theirs;
- their row in the team table says they coordinate;
- tell the user that from the next message the chat's Claude is them: the panel puts their profile and their memory's index in the system prompt at every turn, and a colleague at work never sees it. Where the panel does not run, nothing does: say so.
