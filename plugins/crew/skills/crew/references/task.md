# Giving a colleague a task

Claude uses the colleagues as subagents whenever it helps, not only in rounds: a check, a piece of research, a test, a change in their field. A colleague in a meeting or at work on a task takes no other one.

1. **Who**: the colleague whose field the task is in, among those whose permissions allow it. The permissions bind, read from the profile's `tools:`:
   - **Read** (`Grep`, `Glob`): reading the project's files. Without it, put the material itself in the brief, not paths.
   - **Write** (`Edit`, `Write`): changing the project's files. Only these colleagues get tasks that change files.
   - **Testing** (`Bash`): running commands and tests.
   - **Web** (`WebSearch`, `WebFetch`): searching and reading the web.

   When no colleague has the permission the task needs, Claude does that part itself, or asks the user to give the permission.
2. **The brief**: what to do and why, the scope (the files they may change), when it is done, the project's rules that apply, and what to return: what they changed, file by file, and how they checked it. Their memory and todo, as always. When the crew-mod is installed, their steps with `mcp__crew-mod__step`.
3. **After**: Claude reads what they changed as its own work (the diff, the tests, the project's checks), fixes or sends back what is wrong, and tells the user who did what. Commits stay Claude's, on the user's word, as the project says.
