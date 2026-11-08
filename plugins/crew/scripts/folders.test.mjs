// The colleagues' folders among the docs: node --test plugins/crew/scripts/folders.test.mjs
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";

import { link, move, placesOf } from "./folders.mjs";

const made = [];
const git = (folder, ...args) => execFileSync("git", ["-C", folder, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();

// A project with its code in a repo and, unless told otherwise, its docs in a repo of their own, ignored by the code's.
function project({ docs = "project", isDocsRepo = true, ignoresClaude = false, config = `docs: ${docs}\n` } = {})
{
    const root = mkdtempSync(join(tmpdir(), "crew-folders-"));
    made.push(root);
    git(root, "init", "-q");
    writeFileSync(join(root, ".gitignore"), `/${docs}/\n${ignoresClaude ? "/.claude/\n" : ""}`);
    mkdirSync(join(root, ".claude"), { recursive: true });

    if (config !== null) {
        writeFileSync(join(root, ".claude", "project.yaml"), config);
    }

    mkdirSync(join(root, docs), { recursive: true });

    if (isDocsRepo) {
        git(join(root, docs), "init", "-q");
    }

    return root;
}

function write(path, text)
{
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, text);
}

afterEach(() => {
    for (const root of made.splice(0)) {
        rmSync(root, { recursive: true, force: true });
    }
});

describe("where the colleagues' files are", () => {
    it("stay in .claude without Project, or with the docs in the code's repo", () => {
        assert.deepEqual(placesOf(project({ config: null })), { mode: "local", reason: "no-project" });
        const together = project({ isDocsRepo: false });
        assert.equal(placesOf(together).mode, "local");
        assert.equal(placesOf(together).reason, "same-repo");
        assert.deepEqual(link(together, { create: true }).made, []);
        assert.ok(!existsSync(join(together, ".claude", "agents")));
    });

    it("go among the docs when they are a repo of their own: created at the first hire, then linked from .claude and kept out of the code's repo", () => {
        const root = project();
        assert.equal(placesOf(root).due, "create");
        // Without --create nothing is made: a project that has no team yet gets no folders.
        assert.deepEqual(link(root).made, []);
        const result = link(root, { create: true });
        assert.equal(result.due, "none");
        assert.equal(result.made.length, 2);
        assert.ok(lstatSync(join(root, ".claude", "agents")).isSymbolicLink());
        write(join(root, ".claude", "agent-memory", "matteo-conti", "todo.md"), "- [ ] one\n");
        assert.equal(readFileSync(join(root, "project", "crew", "memory", "matteo-conti", "todo.md"), "utf8"), "- [ ] one\n");
        assert.deepEqual(result.visible, []);
        assert.equal(git(root, "status", "--porcelain", "-uall", "--", ".claude"), "?? .claude/project.yaml");
        const exclude = readFileSync(join(root, ".git", "info", "exclude"), "utf8");
        assert.match(exclude, /^\/\.claude\/agents$/m);
        assert.match(exclude, /^\/\.claude\/agent-memory$/m);
        // Once is enough: the lines are not written twice.
        link(root, { create: true });
        assert.equal(readFileSync(join(root, ".git", "info", "exclude"), "utf8"), exclude);
    });

    it("a second machine links to the docs' folders already there, and writes nothing where git ignores .claude", () => {
        const root = project({ ignoresClaude: true });
        write(join(root, "project", "crew", "agents", "matteo-conti.md"), "# Matteo Conti, code review\n");
        mkdirSync(join(root, "project", "crew", "memory"), { recursive: true });
        assert.equal(placesOf(root).due, "link");
        assert.equal(link(root).made.length, 2);
        assert.ok(existsSync(join(root, ".claude", "agents", "matteo-conti.md")));
        assert.doesNotMatch(readFileSync(join(root, ".git", "info", "exclude"), "utf8"), /\.claude\/agents/);
    });

    it("moves the team already in .claude among the docs only when asked, and refuses where both places hold files", () => {
        const root = project({ ignoresClaude: true, docs: "private", config: "name: x\ndocs: \"private\"  # the docs\n" });
        write(join(root, ".claude", "agents", "matteo-conti.md"), "# Matteo Conti, code review\n");
        write(join(root, ".claude", "agent-memory", "matteo-conti", "todo.md"), "- [ ] one\n");
        assert.equal(placesOf(root).due, "move");
        assert.deepEqual(link(root).made, []);
        const result = move(root);
        assert.equal(result.moved.length, 2);
        assert.equal(result.due, "none");
        assert.ok(existsSync(join(root, "private", "crew", "agents", "matteo-conti.md")));
        assert.ok(existsSync(join(root, ".claude", "agent-memory", "matteo-conti", "todo.md")));

        const other = project({ ignoresClaude: true });
        write(join(other, ".claude", "agents", "a.md"), "a");
        write(join(other, "project", "crew", "agents", "b.md"), "b");
        assert.equal(placesOf(other).due, "conflict");
        assert.throws(() => move(other), /holds files already/);
    });

    it("refuses to move what the code's repo tracks", () => {
        const root = project();
        write(join(root, ".claude", "agents", "a.md"), "a");
        git(root, "add", ".claude/agents/a.md");
        assert.throws(() => move(root), /tracks/);
        assert.ok(existsSync(join(root, ".claude", "agents", "a.md")));
        // Gone from the working tree but still tracked, it is never replaced by a link: git would show its files deleted.
        rmSync(join(root, ".claude", "agents"), { recursive: true });
        write(join(root, "project", "crew", "agents", "b.md"), "b");
        assert.deepEqual(link(root).made, []);
        assert.equal(existsSync(join(root, ".claude", "agents")), false);
    });
});
