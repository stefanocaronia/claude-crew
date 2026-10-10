// Runs the conversation hook as Claude Code does: a JSON input on stdin, the project in CLAUDE_PROJECT_DIR, the answer on stdout.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./conversation.mjs", import.meta.url));
let sandbox;
let project;

before(() => {
    sandbox = mkdtempSync(join(tmpdir(), "colleagues-test-"));
    project = join(sandbox, "project");
    writeColleague("matteo-conti", "Matteo Conti, code reviewer", "Matteo remembers the parser bug.", "- [ ] retest the parser");
    writeColleague("giulia-ferri", "Giulia Ferri, game master", "Giulia remembers the playtest.", "- [ ] read the transcript");
    writeAgent("helper-bot", "Helper Bot, a plain agent");
});

after(() => rmSync(sandbox, { recursive: true, force: true }));

describe("conversation hook", () => {
    it("hands the chat to one colleague, with their file, memory and todo, without the round-only sections", () => {
        const context = prompt("one", "voglio parlare con Matteo del parser");
        assert.match(context, /From here on Matteo speaks/);
        assert.match(context, /Matteo remembers the parser bug/);
        assert.match(context, /retest the parser/);
        assert.match(context, /How you work/);
        assert.doesNotMatch(context, /REPORT FORMAT|MEMORY RULES/);
    });

    it("reminds who is speaking on the next prompts", () => {
        assert.match(prompt("one", "e il lexer?"), /Matteo is still speaking: the message starts with \[Matteo\]/);
    });

    it("adds a colleague with 'anche', introducing only the newcomer", () => {
        const context = prompt("one", "fammi parlare anche con Giulia");
        assert.match(context, /Meeting with Matteo and Giulia/);
        assert.match(context, /Giulia remembers the playtest/);
        assert.doesNotMatch(context, /Matteo remembers/);
    });

    it("ends the meeting: each updates memory and todo, then Claude is back", () => {
        const context = prompt("one", "ok, riunione finita");
        assert.match(context, /Matteo and Giulia leave/);
        assert.match(context, /Claude is back/);
        assert.equal(prompt("one", "grazie"), "");
    });

    it("understands English calls and endings", () => {
        assert.match(prompt("two", "I'd like to talk to Giulia and Matteo about the log"), /Meeting with Giulia and Matteo/);
        assert.match(prompt("two", "back to Claude"), /Giulia and Matteo leave/);
        assert.match(prompt("three", "Let's talk with Matteo"), /From here on Matteo speaks/);
        assert.match(prompt("three", "the meeting is over"), /Matteo leaves/);
    });

    it("brings in whoever must be present", () => {
        assert.match(prompt("four", "voglio parlare con Matteo, con Giulia presente"), /Meeting with Matteo and Giulia/);
    });

    it("ignores agents without a todo and words that are not names", () => {
        assert.equal(prompt("five", "parliamo con Helper"), "");
        assert.equal(prompt("five", "voglio parlare con te di Matteo"), "");
        assert.equal(prompt("five", "torna Claude"), "");
    });

    it("gives the colleagues back after a compaction, and forgets them after /clear", () => {
        prompt("six", "voglio parlare con Giulia");
        const restored = run({ hook_event_name: "SessionStart", source: "compact", session_id: "six" });
        assert.match(restored, /The context was compacted/);
        assert.match(restored, /Giulia remembers the playtest/);
        assert.equal(run({ hook_event_name: "SessionStart", source: "clear", session_id: "six" }), "");
        assert.equal(prompt("six", "ciao"), "");
    });

    it("names what does not fit, to be read, keeping memories and todos first", () => {
        writeColleague("sara-lombardi", "Sara Lombardi, game designer", "x".repeat(6000), "- [ ] y");
        writeAgent("sara-lombardi", "Sara Lombardi, game designer", "z".repeat(6000));
        const context = prompt("seven", "voglio parlare con Sara");
        assert.match(context, /Not everything fits: before answering, read in full, with Read, \.claude\/agents\/sara-lombardi\.md/);
        assert.match(context, /x{6000}/);
        assert.ok(context.length < 10000);
    });
});

function prompt(sessionId, text)
{
    return run({ hook_event_name: "UserPromptSubmit", session_id: sessionId, prompt: text });
}

function run(input)
{
    const temp = join(sandbox, "temp");
    mkdirSync(temp, { recursive: true });
    const result = spawnSync(process.execPath, [script], {
        input: JSON.stringify(input),
        encoding: "utf8",
        env: { ...process.env, CLAUDE_PROJECT_DIR: project, TMPDIR: temp, TEMP: temp, TMP: temp },
    });
    assert.equal(result.stderr, "");
    return result.stdout ? JSON.parse(result.stdout).hookSpecificOutput.additionalContext : "";
}

function writeColleague(id, heading, memory, todo)
{
    writeAgent(id, heading);
    const folder = join(project, ".claude", "agent-memory", id);
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, "MEMORY.md"), `# ${heading.split(" ")[0]}: memory\n\n${memory}\n`);
    writeFileSync(join(folder, "todo.md"), `# ${heading.split(" ")[0]}: todo\n\n${todo}\n`);
}

function writeAgent(id, heading, body = "")
{
    const folder = join(project, ".claude", "agents");
    mkdirSync(folder, { recursive: true });
    const file = [
        "---", `name: ${id}`, `description: "${heading}."`, "tools: Read, Grep, Glob", "memory: project", "---", "",
        `# ${heading}`, "", "**Who you are.** Someone.", body, "", "## How you work", "", "- Carefully.", "",
        "## What you return", "", "REPORT FORMAT", "", "## Your memory", "", "MEMORY RULES", "",
    ];
    writeFileSync(join(folder, `${id}.md`), file.join("\r\n"));
}
