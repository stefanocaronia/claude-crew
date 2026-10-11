# Hiring a colleague

0. **Ask what the request leaves open**, when it does not say who is wanted (as the panel's button, which sends only "hire a colleague"): an interview in the chat, one question at a time, each with two to four answers drawn from the project and the team, plus the user's own. Use the host's question tool when it has one (`AskUserQuestion` in Claude Code), else a short numbered list. Skip what the request already says.
   1. The field: what the team lacks now. Propose fields from the work in progress and from what no colleague covers in the team table, each with one line on why.
   2. Experience and character: a veteran who demands a lot or someone younger and curious; blunt or diplomatic when they disagree.
   3. The portrait style ([portrait.md](portrait.md)), only when the team has no style line yet.

   Then step 1, from the answers.
1. **Agree on who they are**, in one message the user can amend, and write nothing until they say yes:
   - the field, and why the team needs it now; what they review and what they leave to whom (the borders with the others);
   - first and last name, plausible in the project's language and culture, the first name unique in the team; age, city and a career that makes them credible;
   - character: standards, what they cannot stand, how they disagree; and how they talk (sentence length, register, a habit of speech), so each sounds like themselves in a meeting;
   - `watches:`, the files of their field as globs (`src/mcp/**, docs/tools.md`): a commit that touches them reminds Claude of them;
   - their permissions, chosen by Claude from their field as [edit.md](edit.md) says ("Permissions") and written as `tools:`, one line in the proposal with why; their memory and todo they always write. Without Read or Write the panel refuses their reading or writing outside their memory folder. With the crew-mod installed, `mcp__crew-mod__step` is among their tools too, to report their steps to the panel;
   - a color among `red, blue, green, yellow, purple, orange, pink, cyan` that no colleague has;
   - `model` and `effort` only when the user asks: otherwise they inherit the session's.

   The user may ask for someone else, or give criteria (experience, background, age, character, how they disagree): propose again until they are happy. They may also ask for two or three candidates, a few lines each, to pick from.
2. **Before the first hire in a project**, check whether `.claude/` is committed to a public repository: their memories hold notes about the user and the work. If so, tell the user and offer to ignore it in git or keep it in a private folder linked in.
3. **Write the profile**, `.claude/agents/<id>.md`, from [../templates/agent.md](../templates/agent.md), in the project's language: every section written for this person and this project. Keep the last two sections ("What you return", "Your memory") in meaning, with their headings translated: the plugin's hook leaves them out of conversations, and recognises them in English and Italian.
4. **Open their folder**, `.claude/agent-memory/<id>/`: `MEMORY.md` (`# <First>: memory`, then `## <date>: hired` and why, in a line or two) and `todo.md` (`# <First>: todo`, with the first tasks if there are any).
5. **Portrait**: [portrait.md](portrait.md).
6. **Add their row** to the team table.
7. **Tell the user** who joined, their field and their files. Claude Code picks up a new agent file during the session; if the Agent tool does not list the new colleague yet, they work from the next session.
