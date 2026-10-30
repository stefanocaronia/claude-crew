# Giving a colleague a task

Claude uses the colleagues as subagents whenever it helps, not only in rounds: a check, a piece of research, a test, a change in their field. A colleague in a meeting or at work on a task takes no other one.

1. **Who**: the colleague whose field the task is in, among those whose permissions allow it. The permissions bind, read from the profile's `tools:`:
   - **Read** (`Grep`, `Glob`): reading the project's files. Without it, put the material itself in the brief, not paths.
   - **Write** (`Edit`, `Write`): changing the project's files. Only these colleagues get tasks that change files.
   - **Testing** (`Bash`): running commands and tests; it brings Read and Write, since a command can change any file.
   - **Web** (`WebSearch`, `WebFetch`): searching and reading the web.

   When no colleague has the permission the task needs, Claude does that part itself, or asks the user to give the permission.
2. **Real work, in a project with a backlog of numbered tasks** (the project plugin's): unless the task is already one of it, Claude adds it first, `backlog.mjs add "<what>" --to <their first name> --by <who asked for it>` (the colleague when it came from their review, the user's name when the user asked), and the brief names its number; a check or a piece of research for Claude's own work is not a backlog task.
3. **The brief**: what to do and why, and the tasks it waited for, now done, with what they changed, the scope (the files they may change), when it is done, the project's rules that apply, and what to return: what they changed, file by file, and how they checked it. Their memory and todo, as always, checked against the sources the brief names (the crew skill, "Always"): at the end they tidy the todo: move the lines ticked [x] to notes/todo-done.md, the history of what is done, tick what this work closed, merge duplicates; keep at most 15 open lines, the most important first, and move the rest, and what no longer matters, to notes/todo-archive.md with the date: never deleted, and compact their memory when it is past its limit (the crew skill, "Always"). Their steps with `mcp__crew__step`.
4. **Never two on the same files**: two colleagues never change the same files at once; the second waits for the first's result (the panel refuses a write to a file another colleague is changing). For a larger change, launch the colleague in a worktree of their own (the Agent tool's `isolation: "worktree"`): their branch, merged by Claude after reading it.
5. **After**: Claude reads what they changed as its own work (the diff, the tests, the project's checks), fixes or sends back what is wrong, and tells the user who did what. Commits stay Claude's, on the user's word, as the project says.
