# A review round

**When**: at a milestone (a step of the plan done, a feature finished, a playtest, a release), or when the user asks.

0. **Ask what to review**, when the request does not say (`/crew:review`, which the panel's buttons run, asks the same way): one question with the host's question tool (`AskUserQuestion` in Claude Code), else a short numbered list. Three subjects drawn from the session's work (the step just done, the latest commits, the files changed) and from the colleagues' open todo lines (retests, lines waiting for this event), each with one line on what it covers and whose field it touches; the user's own answer is the fourth (Claude Code adds it). With names in the request, the subjects are in their fields.
1. **Who**: only the colleagues whose field the work touches, each with a narrow scope. A round costs one subagent each.
2. **Before calling one**, read their `MEMORY.md` and `todo.md`: if they already answered on the matter, or noted an idea about it, start from there and skip the call, unless the context has changed.
3. **The brief**:
   - what changed (commits, files), the scope, the questions;
   - the specifications the reviewed tasks cite, with their text, to check the work against (`backlog.mjs show T-n` of the project plugin, where the project keeps specs);
   - their todo lines that touch the scope, and where the project keeps the state of its work (the crew skill, "Always");
   - what to return (their profile's "What you return"); where the project keeps a backlog, work for the project goes in the report as proposals for it, never in their todo, and a remark on a task already there as a comment on it, one or two sentences with its number;
   - that they are read-only except their memory and todo, and at the end tidy the todo and compact the memory as the crew skill says ("Always", "Tidying"), in the brief's own words;
   - their steps with `mcp__crew__step`: a total at the start, then each step done (it must be among their tools).

   A colleague without reading (no `Grep` among their tools) gets in the brief the material itself, not paths.
4. **Launch** them in one message, each named with their first name (the Agent tool's `name`): a running agent is reachable with `SendMessage`, so the user can ask one of them something while they work. In the background, when the user can go on meanwhile.
5. **Findings reach the user as proposals, one at a time**, most important first, each with who proposed it, together with the colleagues' open todo lines that concern the user. A proposal the user has not decided yet becomes a line in the proposer's todo, `- [ ] P2 · <today> · (waiting for the user) <what>, <round>`, so it outlives the session. A comment on a task of the backlog is no proposal: Claude leaves it at once as the colleague's (the crew skill, "Always") and names it to the user in one line.
6. **After each decision**: add it to the proposer's `MEMORY.md` (date, what, why) and tick the todo lines it closes. When the decision becomes work and the project keeps a backlog of numbered tasks (the project plugin's), Claude adds it there, never in a todo: `backlog.mjs add "<what>" --type <type> --to <who> --by <proposer>`, `<type>` the kind of work: `bug`, `feature`, `chore`, `research` or `test` (a test or a playtest), or a type the project adds (`types:` of .claude/project.yaml), `<who>` Claude for what the proposer meant for Claude, else whoever's field the work is in, with `--see S-n` for a specification it does (the crew skill, "Always"). Either way, give the proposer a line `- [ ] P2 · <today> · check at <the next playtest, release or milestone> that <what>`: the first point of their next brief.
7. **A todo line waiting for an event** (the next playtest, a release): when the event comes, Claude brings that line into the work, naming whose it is.
