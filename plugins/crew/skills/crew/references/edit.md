# Changing a colleague

- **Field, tools, character, color, model or effort**: edit the profile (`.claude/agents/<id>.md`), then add a `## <date>: changed` line to their `MEMORY.md` with what and why. The memory stays.
- **Name**: the first name is how the user calls them and how the hook recognises them; the id names their files. Rename both: the profile file and its `name:`, the memory folder, the heading and the description, the team table, and every path to their folder in the profile and in the memory. The new first name must be unique in the team.
- **A new color or a new look**: offer a new portrait ([portrait.md](portrait.md)).

## Permissions

Four, in the profile's `tools:`, which the user also switches in the panel's card: **Read** (`Grep, Glob`), **Write** (`Edit, Write`), **Testing** (`Bash`), **Web** (`WebSearch, WebFetch`). The Read tool is always listed, for their memory; `mcp__crew-mod__step` too, when the crew-mod is installed. Write needs Read; Testing brings Read and Write, since a command can change any file.

The panel enforces Read and Write on the file tools (and keeps two colleagues off the same file at once). Without the panel, Claude Code gives every colleague with a memory Edit and Write: then the permissions hold through the brief, which states them.

Sensible ones, from what the colleague does:
- **Read**: everyone who judges the project's work; not a colleague who only gives opinions on what they are told.
- **Write**: only who owns files of their field and keeps them (the instructions they write, the docs of their field).
- **Testing** (with Write): who must run, reproduce or look at things working: code review, tests, the page in a browser, a build.
- **Web**: who checks sources outside the project: rules and licences, references, what other products do.

When the user asks to set them for the team, or for one colleague, set them from this list and their profile, write a `## <date>: permissions` line in each changed memory, and show the user a short table (who, permissions, why in a few words); they change any of them in the card. Keep the profile's `description` in step, since Claude reads it when choosing whom to call: when to call them proactively, with two or three concrete tasks of their field, and what their permissions let them do (changes to their files, or checks, tests and research only).
