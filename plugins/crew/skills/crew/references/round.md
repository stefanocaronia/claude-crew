# A review round

**When**: at a milestone (a step of the plan done, a feature finished, a playtest, a release), or when the user asks.

1. **Who**: only the colleagues whose field the work touches, each with a narrow scope. A round costs one subagent each.
2. **Before calling one**, read their `MEMORY.md` and `todo.md`: if they already answered on the matter, or noted an idea about it, start from there and skip the call, unless the context has changed.
3. **The brief**: what changed (commits, files), the scope, the questions, their todo lines that touch the scope, what to return (their profile's "What you return"), and that they are read-only except their memory and todo. A colleague without reading (no `Grep` among their tools) gets in the brief the material itself, not paths. When the crew-mod is installed, ask them to report their steps with `mcp__crew-mod__step`: a total at the start, then each step done (it must be among their tools).
4. **Launch** them in one message, each named with their first name (the Agent tool's `name`): a running agent is reachable with `SendMessage`, so the user can ask one of them something while they work. In the background, when the user can go on meanwhile.
5. **Findings reach the user as proposals, one at a time**, most important first, each with who proposed it, together with the colleagues' open todo lines that concern the user.
6. **After each decision**: add it to the proposer's `MEMORY.md` (date, what, why) and tick the todo lines it closes.
