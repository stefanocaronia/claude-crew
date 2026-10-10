# Hiring a colleague

1. **Agree on who they are**, in one message the user can amend, and write nothing until they say yes:
   - the field, and why the team needs it now; what they review and what they leave to whom (the borders with the others);
   - first and last name, plausible in the project's language and culture, the first name unique in the team; age, city and a career that makes them credible;
   - character: standards, what they cannot stand, how they disagree;
   - tools: read-only by default (`Read, Grep, Glob`), `Bash` when they must run or reproduce things, `WebSearch, WebFetch` when they must check sources, `Edit, Write` only when they own files of their field; their memory and todo they always write; and, when the colleagues-mod is installed, `mcp__colleagues-mod__step`, with which they report their steps to the panel;
   - a color among `red, blue, green, yellow, purple, orange, pink, cyan` that no colleague has;
   - `model` and `effort` only when the user asks: otherwise they inherit the session's.

   The user may ask for someone else, or give criteria (experience, background, age, character, how they disagree): propose again until they are happy. They may also ask for two or three candidates, a few lines each, to pick from.
2. **Write the profile**, `.claude/agents/<id>.md`, from [../templates/agent.md](../templates/agent.md), in the project's language: every section written for this person and this project. Keep the last two sections ("What you return", "Your memory") in meaning, with their headings translated: the plugin's hook leaves them out of conversations, and recognises them in English and Italian.
3. **Open their folder**, `.claude/agent-memory/<id>/`: `MEMORY.md` (`# <First>: memory`, then `## <date>: hired` and why, in a line or two) and `todo.md` (`# <First>: todo`, with the first tasks if there are any).
4. **Portrait**: [portrait.md](portrait.md).
5. **Add their row** to the team table.
6. **Tell the user** who joined, their field and their files. Claude Code picks up a new agent file during the session; if the Agent tool does not list the new colleague yet, they work from the next session.
