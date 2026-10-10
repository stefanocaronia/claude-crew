# Setting the team up in a project

1. **Look at what exists**: `.claude/agents/`, `.claude/agent-memory/`, the instructions file (`AGENTS.md` or `CLAUDE.md`), and whether `.claude/` is under git, ignored or private: tell the user where the colleagues will live. Agents that already work as reviewers can become colleagues: a `todo.md` in their memory folder and, if the user wants, an id by first and last name ([edit.md](edit.md)).
2. **Read the project**: the README, the docs, the plan, the shape of the code. Which expertise does its work need, now and soon?
3. **Propose a team** of three to eight roles, one line of why for each; the user picks. Fewer is better: each one costs a subagent at every round in their field.
4. **Choose the portraits' style** once ([portrait.md](portrait.md)), then **hire** each chosen role ([hire.md](hire.md)).
5. **Write the "Colleagues" section** in the instructions file: a line on what the colleagues are, the team table (who, field, `<id>`), the portraits' line, the two lines that keep them in use (rounds at milestones; tasks in their field whenever it helps, within the permissions of their `tools`), and the project's own rules if any (what they must never touch). The method itself is this skill: don't copy it there.
