# Contributing

Issues and pull requests are welcome. Keep each change small and say what it is for.

## Try it locally

Install from your clone, then start a new chat:

```
claude plugin marketplace add <your clone>
claude plugin install crew@claude-crew
```

Claude Code runs a copy from its cache: after a change, raise the version (below) and run `claude plugin marketplace update claude-crew` and `claude plugin update crew@claude-crew`.

## Test

```
node --test plugins/crew/scripts/conversation.test.mjs plugins/crew/scripts/portraits.test.mjs plugins/crew/scripts/folders.test.mjs plugins/crew/hooks/pure.test.mjs
claude plugin test plugins/crew
claude plugin validate .
```

## Preview

```
node tools/demo.mjs <folder>       a made-up team, as in the README's picture
node tools/preview.mjs <folder>    the panel as the desktop app draws it, as an HTML page
```

## Rules

- **Words** the panel shows go in all eleven languages of `plugins/crew/hooks/text.ts`.
- **Behavior** the colleagues follow goes in the skills, under `plugins/crew/skills/`.
- **Your own project** stays out: `/project/` and `/.claude/` are ignored.

## Release

1. Add the changes on top of [CHANGELOG.md](CHANGELOG.md).
2. Raise the version in `.claude-plugin/marketplace.json` and `plugins/crew/.claude-plugin/plugin.json`.
3. Commit, tag and push: `git tag -a vX.Y.Z -m vX.Y.Z`, `git push --follow-tags`.
