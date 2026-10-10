# colleagues

A standing team of expert colleagues for your projects, in Claude Code. Each colleague is a subagent with a profile, a memory that lasts across sessions and a todo: they review the work in their field at milestones, and you can talk with them one-to-one or in a meeting.

```
> voglio parlare con Matteo e Giulia
[Matteo] Ho riletto il passo 9: due cose non mi tornano…
[Giulia] Io invece partirei dalla prova di ieri sera…
> riunione finita
```

Two plugins, each working without the other:

- **colleagues**: the skill (hiring and firing, portraits, review rounds, conversations and meetings) and the hook that hands the chat over to the colleagues and back.
- **colleagues-mod**: a panel and a group chat. The panel shows the team with their portraits, roles and open tasks, and who is at work with the steps they report, their context, tokens and time; a click on a name opens their card (profile, open tasks, latest memory). In a meeting, each colleague's turn is drawn under their portrait and name, and above the prompt sit the participants with buttons to let one go, invite another, or close the meeting.

## Install

```
/plugin marketplace add stefanocaronia/colleagues
/plugin install colleagues@colleagues
/plugin install colleagues-mod@colleagues
```

## Use

Ask Claude in your own words; the `colleagues` skill knows the operations:

| Ask | What happens |
|---|---|
| "set up a team of colleagues for this project" | Claude reads the project, proposes three to eight roles, you pick, they are hired |
| "hire a colleague for security" / "assumi un collega per la sicurezza" | a profile, a memory folder, a todo and a portrait |
| "fire Sara" / "licenzia Sara" | their open tasks are reassigned or closed, profile and memory archived |
| "change Matteo's tools" | the profile changes, the memory notes why |
| "a portrait for each colleague" | an image connector, the Codex CLI, or Claude drawing SVG, in one style for the team |
| "run a review round" | the colleagues whose field the work touches review it in parallel; findings reach you as proposals, one at a time |
| "voglio parlare con Matteo", "I want to talk to Matteo and Giulia" | they answer in the chat, each message starting with their name, until "torna Claude" / "back to Claude" |

The hook recognises Italian and English phrases: *voglio / vorrei / fammi / posso parlare con*, *parliamo con*, *riunione con*, *I want to / I'd like to / let me talk to*, *let's talk with*, *meeting with*; *anche con* or *also with* adds someone; *Sara può andare* or *Sara can go* lets one leave; *torna Claude*, *riunione finita*, *back to Claude*, *meeting over* end it.

The panel opens by itself at the start of a session in a project with colleagues; `/colleagues-panel` shows or hides it.

## Files

Everything stays in your project, under `.claude/`:

```
.claude/agents/matteo-conti.md          the profile: who they are and how they work
.claude/agent-memory/matteo-conti/
    MEMORY.md                           their memory, handed to them at every round
    todo.md                             their tasks
    avatar.png                          their portrait (or avatar.svg)
    notes/                              longer notes, linked from MEMORY.md
.claude/agent-memory/_former/           colleagues who left
```

## Development

```
node --test plugins/colleagues/scripts/conversation.test.mjs plugins/colleagues-mod/hooks/pure.test.mjs
claude plugin test plugins/colleagues-mod
claude plugin validate .
```

To see the mod as the desktop gets it, with a project's real colleagues, `node tools/preview.mjs <project> [--meeting matteo-conti,giulia-ferri] [--working elena-galli]` writes an HTML page (by default in the project's `tmp/`): the trees the mod hands over, in the app's dark colors.

## Credits

The step tool, the run tracking and the drawings' light and dark colors follow [savvy-progress](https://github.com/johnnyvizz/claude-kit/tree/main/plugins/savvy-progress) by johnnyvizz (MIT).

## License

MIT
