# Hiring a colleague

1. **Agree on who they are**, in one message the user can amend:
   - the field, and why the team needs it now; what they review and what they leave to whom (the borders with the others);
   - first and last name, plausible in the project's language and culture, the first name unique in the team; age, city and a career that makes them credible;
   - character: standards, what they cannot stand, how they disagree;
   - tools: read-only by default (`Read, Grep, Glob`), `Bash` when they must run or reproduce things, `WebSearch, WebFetch` when they must check sources, `Edit, Write` only when they own files of their field; their memory and todo they always write;
   - a color among `red, blue, green, yellow, purple, orange, pink, cyan` that no colleague has;
   - `model` and `effort` only when the user asks: otherwise they inherit the session's.
2. **Write the profile**, `.claude/agents/<id>.md`, from [../templates/agent.md](../templates/agent.md), in the project's language: every section written for this person and this project. Keep the last two sections ("What you return", "Your memory") in meaning, with their headings translated: the plugin's hook leaves them out of conversations, and recognises them in English and Italian.
3. **Open their folder**, `.claude/agent-memory/<id>/`: `MEMORY.md` (`# <First>: memory`, then `## <date>: hired` and why, in a line or two) and `todo.md` (`# <First>: todo`, with the first tasks if there are any).
4. **Portrait**: [portrait.md](portrait.md).
5. **Add their row** to the team table.
6. **Tell the user** who joined, their field and their files. Claude Code reads agents at session start: if the Agent tool does not list the new colleague yet, they work from the next session.
