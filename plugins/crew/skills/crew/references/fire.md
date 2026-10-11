# Firing a colleague

1. It is the user's decision: before anything, ask in the chat "Do I fire <First>?" and wait for a yes (`/crew:fire`, which the panel's buttons run, asks it with the choice form). If they hesitate, offer to change the colleague instead ([edit.md](edit.md)).
2. **Open tasks**: show the unticked lines of their `todo.md` and ask, in one message, which go to another colleague (moved into that colleague's todo, with "(from <First>)"), which are closed, which stay in the archive.
3. **Last memory line**: `## <date>: left the team`, and why.
4. **Archive**: move `.claude/agents/<id>.md` to `.claude/agent-memory/_former/<id>/profile.md`, and the content of `.claude/agent-memory/<id>/` beside it; with `git mv` where `.claude/` is under git. Nothing is deleted, and outside `.claude/agents/` the profile is no longer an agent.
5. **Team table**: remove the row.
6. Rehiring is the same move backwards, with a `## <date>: back` line.
