# Setting the team up in a project

1. **Look at what exists**: `.claude/agents/`, `.claude/agent-memory/`, the instructions file (`AGENTS.md` or `CLAUDE.md`), and whether `.claude/` is under git, ignored or private: tell the user where the colleagues will live. Agents that already work as reviewers can become colleagues: a `todo.md` in their memory folder and, if the user wants, an id by first and last name ([edit.md](edit.md)); a `tools:` with the Read tool alone reads no project file in the panel's eyes, so add `Grep, Glob` when they review the project.
2. **Read the project**: the README, the docs, the plan, the shape of the code. Which expertise does its work need, now and soon?
3. **Propose a team** of three to eight roles, one line of why for each; the user picks. Fewer is better: each one costs a subagent at every round in their field.
4. **Choose the portraits' style** once ([portrait.md](portrait.md)), then **hire** each chosen role ([hire.md](hire.md)).
5. **Write the "Colleagues" section** in the instructions file: a line on what the colleagues are, the team table (who, field, `<id>`), the portraits' line, these two lines word for word, which keep them in use:
   - «- **Rounds**: when a step of the plan is done, a feature finished or a playtest played, Claude runs a review round with the colleagues the work touches (the crew skill), before calling the step done.»
   - «- **Tasks**: when a question or a check falls in a colleague's field and needs more than a glance, Claude gives it to them as a subagent, within the permissions of their `tools`.»

   Then the project's own rules, if any (what they must never touch). The method itself is this skill: don't copy it there.
