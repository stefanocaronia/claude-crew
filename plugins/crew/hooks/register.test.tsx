// The mod's drawings and controls on the terminal and the desktop, over a small project of fake files:
// claude plugin test plugins/crew
import type { On } from "claude-code";
import { expect, mock, test } from "claude-code/testing";
import type { MockClock } from "claude-code/testing";

const plugin = "crew";
const surfaces = ["terminal", "desktop"] as const;
// How many times the mod asked to open its panel.
let opens = 0;
const band = { hasSurvey: false, isWorking: false, maxRows: 8, bodyColumns: 100 } as never;
const profile = (id: string, heading: string, color: string) => `---\nname: ${id}\ndescription: "${heading}."\ntools: Read\nmemory: project\ncolor: ${color}\n---\n\n# ${heading}\n`;
const project: Record<string, string> = {
    "/p/.claude/agents/matteo-conti.md": profile("matteo-conti", "Matteo Conti, code review", "red"),
    "/p/.claude/agents/giulia-ferri.md": profile("giulia-ferri", "Giulia Ferri, game master", "purple"),
    "/p/.claude/agents/sara-lombardi.md": profile("sara-lombardi", "Sara Lombardi, game design", "green"),
    "/p/.claude/agent-memory/matteo-conti/todo.md": "- [ ] retest the parser\n",
    "/p/.claude/agent-memory/giulia-ferri/todo.md": "",
    "/p/.claude/agent-memory/sara-lombardi/todo.md": "- [ ] modes\n",
    "/p/.claude/agent-memory/matteo-conti/MEMORY.md": "# Matteo: memory\n\n## 9 October\n- the parser holds\n",
};

// The engine resolves "/p" against the drive on Windows: the fake files are named without it.
function posix(path: string): string
{
    return path.replace(/\\/g, "/").replace(/^[A-Za-z]:/, "");
}

function listed(files: Record<string, string>, folder: string): never[]
{
    return Object.keys(files)
        .filter(path => path.startsWith(`${folder}/`) && !path.slice(folder.length + 1).includes("/"))
        .map(path => ({ name: path.slice(folder.length + 1), kind: "file", size: files[path]?.length ?? 0, mtimeMs: 0, isLink: false }) as never);
}

// The crew plugin's script: talk, invite, leave and end change who is in the conversation, in its state file.
function keepMeeting(files: Record<string, string>, command: string, args: string): void
{
    if (!["crew:talk", "crew:invite", "crew:leave", "crew:end"].includes(command)) {
        return;
    }

    const state = "/tmp/claude-crew/s1.json";
    const active = files[state] ? (JSON.parse(files[state]) as { active: string[] }).active : [];
    const ids = args.split(" ").filter(Boolean).flatMap(first => Object.keys(project).filter(path => path.startsWith(`/p/.claude/agents/${first.toLowerCase()}-`)).map(path => path.slice("/p/.claude/agents/".length, -".md".length)));
    const next = command === "crew:end" ? [] : command === "crew:leave" ? active.filter(id => !ids.includes(id)) : command === "crew:talk" ? ids : [...new Set([...active, ...ids])];

    if (next.length) {
        files[state] = JSON.stringify({ active: next });
    } else {
        delete files[state];
    }
}

// The world beneath the mod: the project's files, the session, the hook's state file naming who is in the conversation. It keeps
// the files read and the state's keys written, in order.
function world(on: On, members: string[], hasCommands = true): string[] & { files: Record<string, string>; clock: MockClock; reads: string[]; writes: string[] }
{
    const sent: string[] = [];
    const reads: string[] = [];
    const writes: string[] = [];
    const files: Record<string, string> = { ...project, ...(members.length ? { "/tmp/claude-crew/s1.json": JSON.stringify({ active: members }) } : {}) };
    mock.env(on, { OS: "Linux", TMPDIR: "/tmp", LANG: "en_US.UTF-8" });
    const clock = mock.clock(on, { now: Date.UTC(2026, 9, 10, 9, 0) });
    on("session.start", () => ({ cwd: "/p" }) as never);
    on("settings.read", () => ({ value: {} }) as never);
    on("tool.register", () => ({ value: {} }) as never);
    on("command.register", () => ({ value: {} }) as never);
    on("session.root", () => ({ value: "/p" }));
    on("session.id", () => ({ value: "s1" }));
    on("session.usage", () => ({ value: { startedAt: 0, context: {}, rateLimits: [{ kind: "seven_day", percentUsed: 62, resetsAt: "2026-10-12T05:00:00Z" }] } }) as never);
    on("fs.exists", (_, e) => ({ value: Object.keys(files).some(path => path === posix(e.path) || path.startsWith(`${posix(e.path)}/`)) }));
    on("fs.list", (_, e) => ({ value: listed(files, posix(e.path)) }));
    on("fs.read", (_, e) => {
        reads.push(posix(e.path));
        return { value: e.as === "bytes" ? { base64: btoa(files[posix(e.path)] ?? "") } : files[posix(e.path)] ?? "" } as never;
    });
    on("state.set", (_, e, next) => {
        writes.push((e as { key: string }).key);
        return next(e);
    });
    on("fs.stat", (_, e) => ({ value: { kind: posix(e.path) in files ? "file" : "other", size: files[posix(e.path)]?.length ?? 0, mtimeMs: 1, isLink: false } }) as never);
    mock.store(on);
    on("fs.write", (_, e) => {
        files[posix(e.path)] = e.text;
        return { value: undefined } as never;
    });
    on("ui.render", ($, e) => {
        const { Text } = $.ui.resolve(e);
        return <Text key="engine">engine</Text>;
    });
    on("ui.toast", () => ({ value: {} }) as never);
    on("ui.open", () => {
        opens++;
        return { value: {} } as never;
    });
    on("command.list", () => ({ value: hasCommands ? [{ name: "crew:talk", description: "", source: "plugin", plugin: "crew", isFullscreen: false }] : [] }) as never);
    let spawned = 0;
    on("agent.spawn", () => ({ model: "claude-opus-5-5", agentId: `a${++spawned}` }) as never);
    on("command.run", (_, e) => {
        sent.push(`/${e.command}${e.args ? ` ${e.args}` : ""}`);
        keepMeeting(files, e.command, e.args ?? "");
        return { text: "" } as never;
    });
    on("turn.start", (_, e) => ({ turnId: e.turnId }) as never);
    return Object.assign(sent, { files, clock, reads, writes });
}

test("the meeting's controls let one go, invite another and close it, through the colleagues' commands", async ($, on) => {
    const sent = world(on, ["matteo-conti", "giulia-ferri"]);
    await $.session.start({ cwd: "/p", surface: null, isInteractive: true } as never);

    for (const surface of surfaces) {
        sent.length = 0;
        sent.files["/tmp/claude-crew/s1.json"] = JSON.stringify({ active: ["matteo-conti", "giulia-ferri"] });
        await $.turn.start({ text: "", turnId: `before-${surface}` } as never);
        const ui = await $.ui.mount({ plugin, surface, component: "AbovePrompt", props: band });
        expect((await ui.find({ key: "leave-matteo-conti" }))?.props.label).toBe("✕");
        await ui.press({ key: "leave-matteo-conti" });
        await ui.select({ key: "invite", value: "sara-lombardi" });
        expect(sent).toEqual(["/crew:leave Matteo", "/crew:invite Sara"]);
        await $.turn.start({ text: "/crew:invite Sara", turnId: `after-${surface}` } as never);
        expect(await ui.find({ key: "leave-sara-lombardi" })).toBeDefined();
        await ui.unmount();
    }

    sent.files["/tmp/claude-crew/s1.json"] = JSON.stringify({ active: ["matteo-conti", "giulia-ferri"] });
    await $.turn.start({ text: "", turnId: "before-close" } as never);

    const ui = await $.ui.mount({ plugin, surface: "desktop", component: "AbovePrompt", props: band });
    await ui.press({ key: "close" });
    expect(sent.at(-1)).toBe("/crew:end");
    expect(await ui.find({ key: "close" })).toBeUndefined();
});

test("without the crew plugin's commands, the panel says how to install them", async ($, on) => {
    world(on, [], false);
    await $.session.start({ cwd: "/p", surface: null, isInteractive: true } as never);
    const ui = await $.ui.mount({ plugin, surface: "terminal", component: "Pane", requestId: "crew", props: { title: "Crew", isFocused: false, bodyColumns: 50, placement: "dock" } as never });
    expect(await ui.find({ type: "Text", text: /plugin install crew@claude-crew/ })).toBeDefined();
});

test("Claude opens the panel through its tool when the user asks in words", async ($, on) => {
    world(on, []);
    await $.session.start({ cwd: "/p", surface: null, isInteractive: true } as never);
    const before = opens;
    await $.tool.call({ tool: "mcp__crew__panel", tool_use_id: "t1" } as never);
    expect(opens).toBe(before + 1);
});

test("no meeting, no band above the prompt", async ($, on) => {
    world(on, []);
    await $.session.start({ cwd: "/p", surface: null, isInteractive: true } as never);

    for (const surface of surfaces) {
        const ui = await $.ui.mount({ plugin, surface, component: "AbovePrompt", props: band });
        expect(await ui.find({ key: "close" })).toBeUndefined();
        await ui.unmount();
    }
});

test("a reply with colleagues speaking is drawn as a group chat, the narrator apart", async ($, on) => {
    world(on, []);
    await $.session.start({ cwd: "/p", surface: null, isInteractive: true } as never);
    const text = "[Matteo] Il parser regge.\n\n*Claude apre il file.*\n\n[Giulia] Io partirei dalla prova di ieri.";

    for (const surface of surfaces) {
        const ui = await $.ui.mount({ plugin, surface, component: "AssistantMessage", props: { text, isFirstOfReply: true } });
        expect(surface === "desktop" ? (await ui.find({ type: "Svg", props: { alt: "Matteo Conti" } } as never)) : (await ui.find({ type: "Text", text: "Matteo Conti" }))).toBeDefined();
        expect(surface === "desktop" ? (await ui.find({ type: "Svg", props: { alt: "Code review" } } as never)) : (await ui.find({ type: "Text", text: "Code review" }))).toBeDefined();
        expect(Boolean(await ui.find({ type: "Svg" }))).toBe(surface === "desktop");
        expect((await ui.find({ type: "Markdown", text: /parser regge/ }))?.props.dimColor).toBeUndefined();
        expect((await ui.find({ type: "Markdown", text: /apre il file/ }))?.props.dimColor).toBe(true);
        expect(await ui.find({ type: "Markdown", text: /prova di ieri/ })).toBeDefined();
        await ui.unmount();
    }
});

test("the panel marks who is in the meeting, whose controls stay above the prompt", async ($, on) => {
    world(on, ["matteo-conti", "giulia-ferri"]);
    await $.session.start({ cwd: "/p", surface: null, isInteractive: true } as never);

    for (const surface of surfaces) {
        const ui = await $.ui.mount({ plugin, surface, component: "Pane", requestId: "crew", props: { title: "Crew", isFocused: false, bodyColumns: 50, placement: "dock" } as never });
        expect(await ui.find({ key: "close" })).toBeUndefined();
        expect((await ui.find({ key: "meeting-toggle" }))?.props.label).toBe("▾ ☰ In the meeting · 2");
        expect((await ui.find({ key: "team-toggle" }))?.props.label).toBe("▾ ☕\uFE0E On a coffee break · 1");
        expect(await ui.find({ key: "pick-matteo-conti" })).toBeUndefined();
        expect(await ui.find({ key: "pick-sara-lombardi" })).toBeDefined();

        if (surface === "terminal") {
            expect(await ui.find({ type: "Text", text: /^1 to do/ })).toBeDefined();
        }

        await ui.unmount();
    }
});

test("under the team: the backlog, each task with who holds it and its effort; the actions are commands, with the colleagues picked or for everyone", async ($, on) => {
    const sent = world(on, []);
    await $.session.start({ cwd: "/p", surface: null, isInteractive: true } as never);

    for (const surface of surfaces) {
        const ui = await $.ui.mount({ plugin, surface, component: "Pane", requestId: "crew", props: { title: "Crew", isFocused: false, bodyColumns: 50, placement: "dock" } as never });
        expect(await ui.find({ type: "Text", text: /62% used · resets in 1d 20h/ })).toBeDefined();
        expect((await ui.find({ key: "backlog-toggle" }))?.props.label).toBe("▸ Backlog");
        expect(await ui.find({ type: "Text", text: "retest the parser" })).toBeUndefined();
        await ui.press({ key: "backlog-toggle" });
        expect(await ui.find({ type: "Text", text: "retest the parser" })).toBeDefined();
        expect(await ui.find({ type: "Text", text: "modes" })).toBeDefined();
        await ui.press({ key: "backlog-toggle" });
        expect(await ui.find({ type: "Text", text: "modes" })).toBeUndefined();
        await ui.press({ key: "pick-sara-lombardi" });
        await ui.press({ key: "pick-matteo-conti" });
        expect((await ui.find({ key: "act-meeting" }))?.props.label).toBe("☰ Meeting with Sara and Matteo");
        expect(await ui.find({ key: "act-hire" })).toBeUndefined();
        expect(await ui.find({ type: "Text", text: "✕ Fire Sara and Matteo" })).toBeDefined();
        // Each action is a command, which asks in the chat what it needs; the picks are used up.
        for (const [key, command] of [["act-round", "/crew:review Sara Matteo"], ["act-fire", "/crew:fire Sara Matteo"], ["act-portraits", "/crew:portraits Sara Matteo"], ["act-meeting", "/crew:meeting Sara Matteo"]] as const) {
            await ui.press({ key });
            expect(sent.at(-1)).toBe(command);
            expect((await ui.find({ key: "pick-sara-lombardi" }))?.props.label).toBe("☐");
            await ui.press({ key: "pick-sara-lombardi" });
            await ui.press({ key: "pick-matteo-conti" });
        }

        await ui.press({ key: "pick-sara-lombardi" });
        await ui.press({ key: "pick-matteo-conti" });
        expect(await ui.find({ key: "act-fire" })).toBeUndefined();

        for (const [key, command] of [["act-round", "/crew:review"], ["act-portraits", "/crew:portraits"], ["act-hire", "/crew:hire"], ["act-meeting", "/crew:meeting Giulia Matteo Sara"]] as const) {
            await ui.press({ key });
            expect(sent.at(-1)).toBe(command);
        }

        await ui.unmount();
    }
});

test("the panel shows who is at work and the team, and a colleague's card with its actions", async ($, on) => {
    const sent = world(on, []);
    await $.session.start({ cwd: "/p", surface: null, isInteractive: true } as never);
    await $.agent.spawn({ prompt: "Review the parser.", description: "Matteo: review the parser", subagentType: "matteo-conti" } as never);

    for (const surface of surfaces) {
        const ui = await $.ui.mount({ plugin, surface, component: "Pane", requestId: "crew", props: { title: "Crew", isFocused: false, bodyColumns: 50, placement: "dock" } as never });
        expect(await ui.find({ type: "Text", text: "Review the parser" })).toBeDefined();
        expect(await ui.find({ type: "Text", text: "Code review" })).toBeDefined();
        expect(Boolean(await ui.find({ type: "Svg", props: { alt: "Matteo Conti" } } as never))).toBe(surface === "desktop");
        await ui.press({ key: "open-matteo-conti" });
        expect(await ui.find({ type: "Markdown", text: /retest the parser/ })).toBeDefined();
        expect((await ui.find({ key: "card-effort" }))?.props.label).toBe("as the session");

        for (const level of ["low", "medium", "high", "extra", "max", "as the session"]) {
            await ui.press({ key: "card-effort" });
            expect((await ui.find({ key: "card-effort" }))?.props.label).toBe(level);
        }

        const labels = async () => Promise.all(["read", "write", "test"].map(async kind => (await ui.find({ key: `permission-${kind}` }))?.props.label));
        expect(await labels()).toEqual(["☐ Read", "☐ Write", "☐ Testing"]);
        // Testing brings Read and Write; Read off takes both away.
        await ui.press({ key: "permission-test" });
        expect(await labels()).toEqual(["☑︎ Read", "☑︎ Write", "☑︎ Testing"]);
        await ui.press({ key: "permission-read" });
        expect(await labels()).toEqual(["☐ Read", "☐ Write", "☐ Testing"]);
        // Write brings Read.
        await ui.press({ key: "permission-write" });
        expect(await labels()).toEqual(["☑︎ Read", "☑︎ Write", "☐ Testing"]);
        await ui.press({ key: "back" });
        // Only Matteo may now change files: one pencil on the cards.
        expect(Boolean(surface === "desktop" ? await ui.find({ type: "Svg", props: { alt: "can change the project's files" } } as never) : await ui.find({ type: "Text", text: "✎" }))).toBe(true);
        await ui.press({ key: "open-matteo-conti" });
        // Write off takes Testing away, and leaves Read.
        await ui.press({ key: "permission-test" });
        await ui.press({ key: "permission-write" });
        expect(await labels()).toEqual(["☑︎ Read", "☐ Write", "☐ Testing"]);
        await ui.press({ key: "permission-read" });
        await ui.press({ key: "card-portrait" });
        expect(sent.at(-1)).toBe("/crew:portraits Matteo");
        await ui.press({ key: "card-fire" });
        expect(sent.at(-1)).toBe("/crew:fire Matteo");
        await ui.press({ key: "back" });
        expect((await ui.find({ key: "open-giulia-ferri" }))?.props.label).toBe("❯");
        await ui.unmount();
    }
});

test("a colleague is in one section: at work, then finished until sent back, then in the team", async ($, on) => {
    world(on, []);
    on("turn.complete", () => ({ text: "" }) as never);
    await $.session.start({ cwd: "/p", surface: null, isInteractive: true } as never);
    await $.agent.spawn({ prompt: "Review the parser.", description: "review the parser", subagentType: "matteo-conti" } as never);
    const ui = await $.ui.mount({ plugin, surface: "desktop", component: "Pane", requestId: "crew", props: { title: "Crew", isFocused: false, bodyColumns: 50, placement: "dock" } as never });
    expect((await ui.find({ key: "working-toggle" }))?.props.label).toBe("▾ ⚒\uFE0E Working · 1");
    expect((await ui.find({ key: "team-toggle" }))?.props.label).toBe("▾ ☕\uFE0E On a coffee break · 2");
    await $.turn.complete({ agentId: "a1", reason: "answer", answer: "done", durationMs: 1000, isAborted: false, turnId: "t1" } as never);
    expect(await ui.find({ key: "working-toggle" })).toBeUndefined();
    expect((await ui.find({ key: "finished" }))?.props.label).toBe("▾ ✓ Finished · 1");
    expect((await ui.find({ key: "team-toggle" }))?.props.label).toBe("▾ ☕\uFE0E On a coffee break · 2");
    await ui.press({ key: "back-a1" });
    expect(await ui.find({ key: "finished" })).toBeUndefined();
    expect((await ui.find({ key: "team-toggle" }))?.props.label).toBe("▾ ☕\uFE0E On a coffee break · 3");
});

test("a new task for one colleague sends those who had finished back to the coffee break", async ($, on) => {
    world(on, []);
    on("turn.complete", () => ({ text: "" }) as never);
    await $.session.start({ cwd: "/p", surface: null, isInteractive: true } as never);
    await $.agent.spawn({ prompt: "Review the parser.", description: "review the parser", subagentType: "matteo-conti" } as never);
    await $.turn.complete({ agentId: "a1", reason: "answer", answer: "done", durationMs: 1000, isAborted: false, turnId: "t1" } as never);
    const ui = await $.ui.mount({ plugin, surface: "desktop", component: "Pane", requestId: "crew", props: { title: "Crew", isFocused: false, bodyColumns: 50, placement: "dock" } as never });
    expect((await ui.find({ key: "finished" }))?.props.label).toBe("▾ ✓ Finished · 1");
    await $.agent.spawn({ prompt: "Think about modes.", description: "modes", subagentType: "sara-lombardi" } as never);
    expect(await ui.find({ key: "finished" })).toBeUndefined();
    expect((await ui.find({ key: "working-toggle" }))?.props.label).toBe("▾ ⚒\uFE0E Working · 1");
});

test("a colleague at work or in the meeting takes no other task, and Claude is told why and how to free them", async ($, on) => {
    world(on, ["giulia-ferri"]);
    await $.session.start({ cwd: "/p", surface: null, isInteractive: true } as never);
    const first = await $.agent.spawn({ prompt: "Review the parser.", description: "review the parser", subagentType: "matteo-conti" } as never);
    expect((first as { agentId?: string }).agentId).toBe("a1");
    const again = await $.agent.spawn({ prompt: "Review the map.", description: "review the map", subagentType: "matteo-conti" } as never);
    expect((again as { deny?: string }).deny).toMatch(/Matteo is already at work on "review the parser", and a colleague takes one task at a time\. Give this one to them when that task's result comes back, to another colleague of the field, or do it yourself; ask the user if it matters which\./);
    const met = await $.agent.spawn({ prompt: "Read the playtest.", description: "read the playtest", subagentType: "giulia-ferri" } as never);
    expect((met as { deny?: string }).deny).toMatch(/Giulia is in the meeting.*\/crew:leave Giulia.*\/crew:end/);
    const free = await $.agent.spawn({ prompt: "Think about modes.", description: "modes", subagentType: "sara-lombardi" } as never);
    expect((free as { agentId?: string }).agentId).toBe("a2");
});

test("a meeting closed from the band stays closed while its command runs, and the state file is in charge again after", async ($, on) => {
    const sent = world(on, ["matteo-conti", "giulia-ferri"]);
    on("turn.complete", () => ({ text: "" }) as never);
    await $.session.start({ cwd: "/p", surface: null, isInteractive: true } as never);
    const ui = await $.ui.mount({ plugin, surface: "desktop", component: "AbovePrompt", props: band });
    await ui.press({ key: "close" });
    expect(sent.at(-1)).toBe("/crew:end");
    sent.files["/tmp/claude-crew/s1.json"] = JSON.stringify({ active: ["matteo-conti", "giulia-ferri"] });
    // The command's turn starts before its script removes the state file: the band stays closed.
    await $.turn.start({ text: "/crew:end", turnId: "t1" } as never);
    expect(await ui.find({ key: "close" })).toBeUndefined();
    delete sent.files["/tmp/claude-crew/s1.json"];
    await $.turn.complete({ reason: "answer", answer: "", durationMs: 1000, isAborted: false, turnId: "t1" } as never);
    expect(await ui.find({ key: "close" })).toBeUndefined();
    // A new meeting shows again.
    sent.files["/tmp/claude-crew/s1.json"] = JSON.stringify({ active: ["sara-lombardi"] });
    await $.turn.start({ text: "/crew:talk Sara", turnId: "t2" } as never);
    expect(await ui.find({ key: "leave-sara-lombardi" })).toBeDefined();
    await ui.unmount();
});


test("a meeting that starts sends whoever had finished to the coffee break", async ($, on) => {
    const sent = world(on, []);
    on("turn.complete", () => ({ text: "" }) as never);
    await $.session.start({ cwd: "/p", surface: null, isInteractive: true } as never);
    await $.agent.spawn({ prompt: "Review the parser.", description: "review the parser", subagentType: "matteo-conti" } as never);
    await $.turn.complete({ agentId: "a1", reason: "answer", answer: "done", durationMs: 1000, isAborted: false, turnId: "t1" } as never);
    const ui = await $.ui.mount({ plugin, surface: "desktop", component: "Pane", requestId: "crew", props: { title: "Crew", isFocused: false, bodyColumns: 50, placement: "dock" } as never });
    expect((await ui.find({ key: "finished" }))?.props.label).toBe("▾ ✓ Finished · 1");
    sent.files["/tmp/claude-crew/s1.json"] = JSON.stringify({ active: ["giulia-ferri"] });
    await $.turn.start({ text: "/crew:talk Giulia", turnId: "t2" } as never);
    expect(await ui.find({ key: "finished" })).toBeUndefined();
    expect((await ui.find({ key: "meeting-toggle" }))?.props.label).toBe("▾ ☰ In the meeting · 1");
    expect((await ui.find({ key: "team-toggle" }))?.props.label).toBe("▾ ☕︎ On a coffee break · 2");
});

test("a colleague without reading or writing works only in their own memory folder", async ($, on) => {
    world(on, []);
    on("tool.call", () => ({ result: "ran" }) as never);
    await $.session.start({ cwd: "/p", surface: null, isInteractive: true } as never);
    await $.agent.spawn({ prompt: "Think about modes.", description: "modes", subagentType: "sara-lombardi" } as never);
    const outside = await $.tool.call({ tool: "Read", file_path: "/p/src/index.ts", agentId: "a1" } as never);
    expect((outside as { deny?: string }).deny).toMatch(/Sara reads only their own memory and todo/);
    const own = await $.tool.call({ tool: "Read", file_path: "/p/.claude/agent-memory/sara-lombardi/todo.md", agentId: "a1" } as never);
    expect((own as { deny?: string }).deny).toBeUndefined();
    const search = await $.tool.call({ tool: "Grep", pattern: "mode", agentId: "a1" } as never);
    expect((search as { deny?: string }).deny).toMatch(/reads only/);
    const change = await $.tool.call({ tool: "Edit", file_path: "src/index.ts", old_string: "a", new_string: "b", agentId: "a1" } as never);
    expect((change as { deny?: string }).deny).toMatch(/Propose the change in your answer/);
    const note = await $.tool.call({ tool: "Edit", file_path: ".claude/agent-memory/sara-lombardi/MEMORY.md", old_string: "a", new_string: "b", agentId: "a1" } as never);
    expect((note as { deny?: string }).deny).toBeUndefined();
    const claude = await $.tool.call({ tool: "Read", file_path: "/p/src/index.ts" } as never);
    expect((claude as { deny?: string }).deny).toBeUndefined();
});

test("a colleague at work on a task is kept out of a meeting, with why", async ($, on) => {
    world(on, []);
    on("tool.call", () => ({ result: "ran" }) as never);
    await $.session.start({ cwd: "/p", surface: null, isInteractive: true } as never);
    await $.agent.spawn({ prompt: "Review the parser.", description: "review the parser", subagentType: "matteo-conti" } as never);
    const talk = await $.tool.call({ tool: "Bash", command: "node \"/x/conversation.mjs\" talk Matteo Giulia -- the parser" } as never);
    expect((talk as { deny?: string }).deny).toMatch(/Matteo \(at work on "review the parser"\)/);
    const free = await $.tool.call({ tool: "Bash", command: "node /x/conversation.mjs talk Giulia Sara" } as never);
    expect((free as { deny?: string }).deny).toBeUndefined();
});

const pane = { title: "Crew", isFocused: false, bodyColumns: 50, placement: "dock" } as never;

test("the memory fence resolves .. and backslashes, ignores case, keeps a link's target and refuses outside the project", async ($, on) => {
    world(on, []);
    on("tool.call", () => ({ result: "ran" }) as never);
    await $.session.start({ cwd: "/p", surface: null, isInteractive: true } as never);
    await $.agent.spawn({ prompt: "Think about modes.", description: "modes", subagentType: "sara-lombardi" } as never);
    const denied = async (args: Record<string, string>) => ((await $.tool.call({ ...args, agentId: "a1" } as never)) as { deny?: string }).deny;
    expect(await denied({ tool: "Read", file_path: "/p/.claude/agent-memory/sara-lombardi/../../../src/x.ts" })).toMatch(/reads only/);
    expect(await denied({ tool: "Edit", file_path: "/p/.claude/agent-memory/sara-lombardi/../../agents/sara-lombardi.md", old_string: "a", new_string: "b" })).toMatch(/Propose the change/);
    expect(await denied({ tool: "Read", file_path: ".claude\\agent-memory\\sara-lombardi\\..\\..\\..\\src\\x.ts" })).toMatch(/reads only/);
    expect(await denied({ tool: "Read", file_path: "\\p\\.claude\\agent-memory\\sara-lombardi\\todo.md" })).toBeUndefined();
    expect(await denied({ tool: "Read", file_path: "/q/.claude/agent-memory/sara-lombardi/todo.md" })).toMatch(/reads only/);
    expect(await denied({ tool: "Write", file_path: "/p/private/.claude/agent-memory/sara-lombardi/notes/x.md", content: "x" })).toBeUndefined();
    expect(await denied({ tool: "Read", file_path: "/P/.Claude/Agent-Memory/SARA-LOMBARDI/todo.md" })).toBeUndefined();
    expect(await denied({ tool: "Glob", pattern: "**/*.md", path: ".claude/agent-memory/sara-lombardi" })).toBeUndefined();
    expect(await denied({ tool: "Glob", pattern: "../../**/*.ts", path: ".claude/agent-memory/sara-lombardi" })).toMatch(/reads only/);
    expect(await denied({ tool: "Glob", pattern: ".claude/agent-memory/sara-lombardi/**/../../../src/*.ts" })).toMatch(/reads only/);
    expect(await denied({ tool: "NotebookEdit", notebook_path: "/p/.claude/agent-memory/sara-lombardi/./../sara-lombardi/n.ipynb", new_source: "" })).toBeUndefined();
});

test("two tasks for one colleague at the same moment: one starts, the other is refused", async ($, on) => {
    world(on, []);
    await $.session.start({ cwd: "/p", surface: null, isInteractive: true } as never);
    const both = await Promise.all([
        $.agent.spawn({ prompt: "Review the parser.", description: "review the parser", subagentType: "matteo-conti" } as never),
        $.agent.spawn({ prompt: "Review the map.", description: "review the map", subagentType: "matteo-conti" } as never),
    ]) as { agentId?: string; deny?: string }[];
    expect(both.filter(result => result.agentId).length).toBe(1);
    expect(both.find(result => result.deny)?.deny).toMatch(/^Matteo is already at work on "review the (parser|map)"/);
    // Once one has started, the mark is gone and the run itself keeps the next one out.
    const third = await $.agent.spawn({ prompt: "Review the rest.", description: "review the rest", subagentType: "matteo-conti" } as never);
    expect((third as { deny?: string }).deny).toMatch(/already at work/);
});

test("a meeting command of any shell names a colleague at work as the script reads names", async ($, on) => {
    world(on, []);
    on("tool.call", () => ({ result: "ran" }) as never);
    await $.session.start({ cwd: "/p", surface: null, isInteractive: true } as never);
    await $.agent.spawn({ prompt: "Review the parser.", description: "review the parser", subagentType: "matteo-conti" } as never);
    const denied = async (tool: string, command: string) => ((await $.tool.call({ tool, command } as never)) as { deny?: string }).deny;
    expect(await denied("PowerShell", "node \"F:\\x\\conversation.mjs\" talk Matteo")).toMatch(/Matteo \(at work on "review the parser"\)/);
    expect(await denied("Bash", "node /x/conversation.mjs talk \"Giulia e Matteo\"")).toMatch(/Matteo \(at work/);
    expect(await denied("Bash", "node /x/conversation.mjs invite Giulia. Matteo")).toMatch(/Matteo \(at work/);
    expect(await denied("Bash", "node /x/conversation.mjs talk Giulia -- the parser of Matteo")).toBeUndefined();
});

test("a colleague left at work by a lost event is freed from their card, which hides talking and reviews while they work", async ($, on) => {
    world(on, []);
    await $.session.start({ cwd: "/p", surface: null, isInteractive: true } as never);
    await $.agent.spawn({ prompt: "Review the parser.", description: "review the parser", subagentType: "matteo-conti" } as never);
    const ui = await $.ui.mount({ plugin, surface: "desktop", component: "Pane", requestId: "crew", props: pane });
    await ui.press({ key: "open-matteo-conti" });
    expect(await ui.find({ key: "talk" })).toBeUndefined();
    expect(await ui.find({ key: "card-round" })).toBeUndefined();
    expect((await ui.find({ key: "card-free" }))?.props.label).toBe("Mark as free");
    await ui.press({ key: "card-free" });
    expect(await ui.find({ key: "card-free" })).toBeUndefined();
    expect(await ui.find({ key: "talk" })).toBeDefined();
    await ui.press({ key: "back" });
    expect((await ui.find({ key: "finished" }))?.props.label).toBe("▾ ✓ Finished · 1");
    expect(await ui.find({ type: "Text", text: "Review the parser · stopped" })).toBeDefined();
});

test("a finished card says how long the task took, not its last step", async ($, on) => {
    const { clock } = world(on, []);
    on("turn.complete", () => ({ text: "" }) as never);
    await $.session.start({ cwd: "/p", surface: null, isInteractive: true } as never);
    await $.agent.spawn({ prompt: "Review the parser.", description: "review the parser", subagentType: "matteo-conti" } as never);
    await $.tool.call({ tool: "mcp__crew__step", done: 4, total: 4, note: "writing the report", agentId: "a1" } as never);
    const ui = await $.ui.mount({ plugin, surface: "terminal", component: "Pane", requestId: "crew", props: pane });
    expect(await ui.find({ type: "Text", text: "Review the parser · step 4 of 4: writing the report" })).toBeDefined();
    await clock.advance(3 * 60_000);
    await $.turn.complete({ agentId: "a1", reason: "answer", answer: "", durationMs: 1000, isAborted: false, turnId: "t1" } as never);
    expect(await ui.find({ type: "Text", text: "Review the parser · done in 3 min 0 s" })).toBeDefined();
});

test("a colleague's answer is kept in their notes, never over another, and their card names the latest", async ($, on) => {
    const { files } = world(on, []);
    on("turn.complete", () => ({ text: "" }) as never);
    await $.session.start({ cwd: "/p", surface: null, isInteractive: true } as never);

    for (const agentId of ["a1", "a2"]) {
        await $.agent.spawn({ prompt: "Review the parser.", description: "Matteo: review the parser!", subagentType: "matteo-conti" } as never);
        await $.turn.complete({ agentId, reason: "answer", answer: `The parser holds (${agentId}).`, durationMs: 1000, isAborted: false, turnId: agentId } as never);
    }

    expect(files["/p/.claude/agent-memory/matteo-conti/notes/2026-10-10-review-the-parser.md"]).toBe("# Review the parser! (2026-10-10)\n\nThe parser holds (a1).\n");
    expect(files["/p/.claude/agent-memory/matteo-conti/notes/2026-10-10-review-the-parser-2.md"]).toMatch(/holds \(a2\)/);
    const ui = await $.ui.mount({ plugin, surface: "terminal", component: "Pane", requestId: "crew", props: pane });
    // The finished row's opener shows what they answered, and the name's opener their card.
    await ui.press({ key: "open-run-a2" });
    expect((await ui.find({ key: "report-text" }))?.text).toMatch(/Review the parser! \(2026-10-10\)[\s\S]*The parser holds \(a2\)/);
    expect(await ui.find({ type: "Text", text: "notes/2026-10-10-review-the-parser-2.md" })).toBeDefined();
    await ui.press({ key: "report-back" });
    expect(await ui.find({ key: "report-text" })).toBeUndefined();
    await ui.press({ key: "open-run-a2" });
    await ui.press({ key: "report-open-matteo-conti" });
    expect((await ui.find({ key: "card-report" }))?.props.label).toBe("Latest report: notes/2026-10-10-review-the-parser-2.md ❯");
    // From the card, back from the report leads to the card again.
    await ui.press({ key: "card-report" });
    expect((await ui.find({ key: "report-text" }))?.text).toMatch(/holds \(a2\)/);
    await ui.press({ key: "report-back" });
    expect(await ui.find({ key: "card-report" })).toBeDefined();
    // A report gone from the notes says so.
    delete files["/p/.claude/agent-memory/matteo-conti/notes/2026-10-10-review-the-parser-2.md"];
    await ui.press({ key: "card-report" });
    expect(await ui.find({ type: "Text", text: "The report is no longer in their notes." })).toBeDefined();
});

test("open retests in a colleague's todo give their card a button that hands them over", async ($, on) => {
    world(on, []);
    const submitted: string[] = [];
    on("prompt.submit", (_, e) => {
        submitted.push(e.text);
        return { drop: "kept by the test" } as never;
    });
    await $.session.start({ cwd: "/p", surface: null, isInteractive: true } as never);
    const ui = await $.ui.mount({ plugin, surface: "desktop", component: "Pane", requestId: "crew", props: pane });
    await ui.press({ key: "open-matteo-conti" });
    expect((await ui.find({ key: "card-retest" }))?.props.label).toBe("↻ Retry (1)");
    await ui.press({ key: "card-retest" });
    expect(submitted.at(-1)).toBe("give Matteo the retests waiting in their todo");
    await ui.press({ key: "back" });
    await ui.press({ key: "open-sara-lombardi" });
    expect(await ui.find({ key: "card-retest" })).toBeUndefined();
});

test("the week's tasks and refusals of a colleague show on their card", async ($, on) => {
    world(on, []);
    await $.session.start({ cwd: "/p", surface: null, isInteractive: true } as never);
    await $.agent.spawn({ prompt: "Review the parser.", description: "review the parser", subagentType: "matteo-conti" } as never);
    await $.agent.spawn({ prompt: "Review the map.", description: "review the map", subagentType: "matteo-conti" } as never);
    await $.agent.spawn({ prompt: "Think about modes.", description: "modes", subagentType: "sara-lombardi" } as never);
    await $.tool.call({ tool: "Read", file_path: "/p/src/x.ts", agentId: "a2" } as never);
    await $.tool.call({ tool: "Read", file_path: "/p/src/y.ts", agentId: "a2" } as never);
    const ui = await $.ui.mount({ plugin, surface: "terminal", component: "Pane", requestId: "crew", props: pane });
    await ui.press({ key: "open-matteo-conti" });
    expect(await ui.find({ type: "Text", text: "This week: 1 task, 1 refusal" })).toBeDefined();
    await ui.press({ key: "back" });
    await ui.press({ key: "open-sara-lombardi" });
    expect(await ui.find({ type: "Text", text: "This week: 1 task, 2 refusals" })).toBeDefined();
});

test("two colleagues never change the same file at once: the second waits until the first one's task ends", async ($, on) => {
    const { files } = world(on, []);
    on("tool.call", () => ({ result: "ran" }) as never);
    on("turn.complete", () => ({ text: "" }) as never);
    files["/p/.claude/agents/matteo-conti.md"] = (files["/p/.claude/agents/matteo-conti.md"] ?? "").replace("tools: Read", "tools: Read, Edit, Write");
    files["/p/.claude/agents/sara-lombardi.md"] = (files["/p/.claude/agents/sara-lombardi.md"] ?? "").replace("tools: Read", "tools:\n  - Read\n  - Edit");
    await $.session.start({ cwd: "/p", surface: null, isInteractive: true } as never);
    await $.agent.spawn({ prompt: "Fix the parser.", description: "fix the parser", subagentType: "matteo-conti" } as never);
    await $.agent.spawn({ prompt: "Fix the modes.", description: "fix the modes", subagentType: "sara-lombardi" } as never);
    const denied = async (agentId: string, path: string) => ((await $.tool.call({ tool: "Edit", file_path: path, old_string: "a", new_string: "b", agentId } as never)) as { deny?: string }).deny;
    expect(await denied("a1", "src/x.ts")).toBeUndefined();
    expect(await denied("a2", "/p/src/./x.ts")).toBe("/p/src/./x.ts is being changed by Matteo, at work on \"fix the parser\": wait until their task ends, then go on.");
    expect(await denied("a1", "/p/src/x.ts")).toBeUndefined();
    expect(await denied("a2", "/p/src/y.ts")).toBeUndefined();
    expect(await denied("a2", ".claude/agent-memory/sara-lombardi/MEMORY.md")).toBeUndefined();
    await $.turn.complete({ agentId: "a1", reason: "answer", answer: "", durationMs: 1000, isAborted: false, turnId: "t1" } as never);
    expect(await denied("a2", "/p/src/x.ts")).toBeUndefined();
});

test("a colleague's turn in the chat shows the light pictures it names as thumbnails, two at most, and the path of the others", async ($, on) => {
    const { files } = world(on, []);
    files["/p/shots/a.png"] = "small picture";
    files["/p/shots/b.jpg"] = "small picture";
    files["/p/shots/c.webp"] = "small picture";
    files["/p/shots/big.png"] = "x".repeat(70_000);
    await $.session.start({ cwd: "/p", surface: null, isInteractive: true } as never);
    const text = "[Matteo] Look at shots/a.png, `/p/shots/big.png`, shots/b.jpg and shots/c.webp; not /q/x.png.";

    for (const surface of surfaces) {
        const ui = await $.ui.mount({ plugin, surface, component: "AssistantMessage", props: { text, isFirstOfReply: true } });
        const thumbnails = (await ui.findAll({ type: "Svg" })).map(element => (element.props as { alt: string }).alt).filter(alt => /\.(png|jpg|webp)$/.test(alt));
        expect(thumbnails).toEqual(surface === "desktop" ? ["shots/a.png", "shots/b.jpg"] : []);
        expect(Boolean(await ui.find({ type: "Text", text: "/p/shots/big.png" }))).toBe(surface === "desktop");
        expect(Boolean(await ui.find({ type: "Text", text: "shots/c.webp" }))).toBe(surface === "desktop");
        expect(await ui.find({ type: "Text", text: "/q/x.png" })).toBeUndefined();
        await ui.unmount();
    }
});

test("a session that starts again keeps at work a colleague whose agent still runs, and finishes one whose agent is gone", async ($, on) => {
    world(on, []);
    let status = "running";
    on("agent.list", () => ({ value: [{ id: "a1", description: "review the parser", type: "matteo-conti", status }] }) as never);
    await $.session.start({ cwd: "/p", surface: null, isInteractive: true } as never);
    await $.agent.spawn({ prompt: "Review the parser.", description: "review the parser", subagentType: "matteo-conti" } as never);
    const ui = await $.ui.mount({ plugin, surface: "desktop", component: "Pane", requestId: "crew", props: pane });
    // /reload-plugins starts the session again while Matteo works.
    await $.session.start({ cwd: "/p", surface: null, isInteractive: true } as never);
    expect((await ui.find({ key: "working-toggle" }))?.props.label).toBe("▾ ⚒︎ Working · 1");
    status = "killed";
    await $.session.start({ cwd: "/p", surface: null, isInteractive: true } as never);
    expect(await ui.find({ key: "working-toggle" })).toBeUndefined();
    expect((await ui.find({ key: "finished" }))?.props.label).toBe("▾ ✓ Finished · 1");
});

test("at a turn's end the team's files are read again only when they changed", async ($, on) => {
    const { files, reads } = world(on, []);
    on("turn.complete", () => ({ text: "" }) as never);
    files["/p/.claude/agent-memory/matteo-conti/avatar.png"] = "portrait";
    await $.session.start({ cwd: "/p", surface: null, isInteractive: true } as never);
    const teamReads = () => reads.filter(path => path.includes("/.claude/"));
    reads.length = 0;
    await $.turn.complete({ reason: "answer", answer: "", durationMs: 1000, isAborted: false, turnId: "t1" } as never);
    expect(teamReads()).toEqual([]);
    files["/p/.claude/agent-memory/sara-lombardi/todo.md"] = "- [ ] modes\n- [ ] options\n";
    await $.turn.complete({ reason: "answer", answer: "", durationMs: 1000, isAborted: false, turnId: "t2" } as never);
    expect(teamReads()).toEqual(["/p/.claude/agent-memory/sara-lombardi/todo.md"]);
});

test("a change of tasks rewrites the team, never the speakers every message of the chat draws", async ($, on) => {
    const { files, writes } = world(on, []);
    on("turn.complete", () => ({ text: "" }) as never);
    await $.session.start({ cwd: "/p", surface: null, isInteractive: true } as never);
    expect(writes).toContain("speakers");
    writes.length = 0;
    files["/p/.claude/agent-memory/sara-lombardi/todo.md"] = "- [ ] modes\n- [ ] options\n";
    await $.turn.complete({ reason: "answer", answer: "", durationMs: 1000, isAborted: false, turnId: "t1" } as never);
    expect(writes).toContain("team");
    expect(writes).not.toContain("speakers");
});

test("the conversation script Claude runs changes the band at once; other commands read no meeting", async ($, on) => {
    const { files, reads } = world(on, []);
    on("tool.call", () => ({ result: "ran" }) as never);
    await $.session.start({ cwd: "/p", surface: null, isInteractive: true } as never);
    const ui = await $.ui.mount({ plugin, surface: "desktop", component: "AbovePrompt", props: band });
    expect(await ui.find({ key: "close" })).toBeUndefined();
    reads.length = 0;
    files["/tmp/claude-crew/s1.json"] = JSON.stringify({ active: ["sara-lombardi"] });
    await $.tool.call({ tool: "Bash", command: "ls" } as never);
    expect(reads).toEqual([]);
    await $.tool.call({ tool: "Bash", command: "node /x/conversation.mjs talk Sara" } as never);
    expect(await ui.find({ key: "leave-sara-lombardi" })).toBeDefined();
});

test("a task's start and its end each write the runs once, so the panel is redrawn once", async ($, on) => {
    const { writes } = world(on, []);
    on("turn.complete", () => ({ text: "" }) as never);
    await $.session.start({ cwd: "/p", surface: null, isInteractive: true } as never);
    writes.length = 0;
    await $.agent.spawn({ prompt: "Review the parser.", description: "review the parser", subagentType: "matteo-conti" } as never);
    expect(writes).toEqual(["runs"]);
    writes.length = 0;
    await $.turn.complete({ agentId: "a1", reason: "answer", answer: "", durationMs: 1000, isAborted: false, turnId: "t1" } as never);
    expect(writes).toEqual(["runs"]);
});

test("a message carries its speakers' portraits first, and the thumbnails only with the weight left", async ($, on) => {
    const { files } = world(on, []);

    for (const id of ["matteo-conti", "giulia-ferri", "sara-lombardi"]) {
        files[`/p/.claude/agent-memory/${id}/avatar.png`] = "p".repeat(15_000);
    }

    files["/p/shots/a.png"] = "x".repeat(45_000);
    await $.session.start({ cwd: "/p", surface: null, isInteractive: true } as never);
    const thumbnails = async (text: string) => {
        const ui = await $.ui.mount({ plugin, surface: "desktop", component: "AssistantMessage", props: { text, isFirstOfReply: true } });
        const drawn = (await ui.findAll({ type: "Svg" })).map(element => (element.props as { alt: string }).alt).filter(alt => alt.endsWith(".png"));
        await ui.unmount();
        return drawn;
    };
    expect(await thumbnails("[Matteo] Look at shots/a.png.")).toEqual(["shots/a.png"]);
    expect(await thumbnails("[Matteo] Look at shots/a.png.\n\n[Giulia] Yes.\n\n[Sara] Agreed.")).toEqual([]);
});

test("the backlog's small portraits take only the weight the team's portraits leave", async ($, on) => {
    const { files } = world(on, []);

    for (const id of ["matteo-conti", "giulia-ferri", "sara-lombardi"]) {
        files[`/p/.claude/agent-memory/${id}/avatar.png`] = "p".repeat(17_000);
        files[`/p/.claude/agent-memory/${id}/avatar-small.jpg`] = "s".repeat(2_000);
    }

    files["/p/.claude/agent-memory/matteo-conti/todo.md"] = Array.from({ length: 13 }, (_, index) => `- [ ] task ${index}`).join("\n");
    await $.session.start({ cwd: "/p", surface: null, isInteractive: true } as never);
    const ui = await $.ui.mount({ plugin, surface: "desktop", component: "Pane", requestId: "crew", props: pane });
    await ui.press({ key: "backlog-toggle" });
    const small = (await ui.findAll({ type: "Svg" })).filter(element => (element.props as { width?: number }).width === 24);
    expect(small).toHaveLength(14);
    expect(small.some(element => (element.props as { source: string }).source.includes("<image"))).toBe(false);
});

test("a project without colleagues: the panel offers to set the team up, with the crew's init command", async ($, on) => {
    const sent = world(on, []);

    for (const path of Object.keys(sent.files).filter(path => path.startsWith("/p/.claude/"))) {
        delete sent.files[path];
    }

    await $.session.start({ cwd: "/p", surface: null, isInteractive: true } as never);

    for (const surface of surfaces) {
        const ui = await $.ui.mount({ plugin, surface, component: "Pane", requestId: "crew", props: { title: "Crew", isFocused: false, bodyColumns: 50, placement: "dock" } as never });
        expect(await ui.find({ type: "Text", text: "No colleagues in this project yet." })).toBeDefined();
        await ui.press({ key: "act-init" });
        expect(sent.at(-1)).toBe("/crew:init");
        await ui.unmount();
    }
});

test("from a colleague's card, a review asks Claude what to review, and a talk starts at once", async ($, on) => {
    const sent = world(on, []);
    const submitted: string[] = [];
    on("prompt.submit", (_, e) => {
        submitted.push(e.text);
        return { drop: "kept by the test" } as never;
    });
    await $.session.start({ cwd: "/p", surface: null, isInteractive: true } as never);
    const ui = await $.ui.mount({ plugin, surface: "desktop", component: "Pane", requestId: "crew", props: { title: "Crew", isFocused: false, bodyColumns: 50, placement: "dock" } as never });
    await ui.press({ key: "open-giulia-ferri" });
    await ui.press({ key: "card-round" });
    expect(sent.at(-1)).toBe("/crew:review Giulia");
    await ui.press({ key: "talk" });
    expect(sent.at(-1)).toBe("/crew:talk Giulia");
    await ui.unmount();
});

test("a meeting takes whoever is free, and none starts from the panel while one goes on", async ($, on) => {
    const sent = world(on, []);
    await $.session.start({ cwd: "/p", surface: null, isInteractive: true } as never);

    for (const colleague of ["matteo-conti", "giulia-ferri", "sara-lombardi"]) {
        await $.agent.spawn({ prompt: "Review.", description: "review", subagentType: colleague } as never);
    }

    const ui = await $.ui.mount({ plugin, surface: "desktop", component: "Pane", requestId: "crew", props: { title: "Crew", isFocused: false, bodyColumns: 50, placement: "dock" } as never });
    expect(await ui.find({ key: "act-meeting" })).toBeUndefined();
    await ui.unmount();
    expect(sent.filter(line => line.startsWith("/crew:meeting"))).toEqual([]);
});

test("while a meeting goes on, the panel's meeting button gives way to the band's invite", async ($, on) => {
    world(on, ["giulia-ferri"]);
    await $.session.start({ cwd: "/p", surface: null, isInteractive: true } as never);
    const ui = await $.ui.mount({ plugin, surface: "desktop", component: "Pane", requestId: "crew", props: { title: "Crew", isFocused: false, bodyColumns: 50, placement: "dock" } as never });
    expect(await ui.find({ key: "act-meeting" })).toBeUndefined();
    expect(await ui.find({ key: "act-round" })).toBeDefined();
    await ui.unmount();
});

test("without the crew plugin's commands, the empty panel says to install it instead of offering to set the team up", async ($, on) => {
    const sent = world(on, [], false);

    for (const path of Object.keys(sent.files).filter(path => path.startsWith("/p/.claude/"))) {
        delete sent.files[path];
    }

    await $.session.start({ cwd: "/p", surface: null, isInteractive: true } as never);
    const ui = await $.ui.mount({ plugin, surface: "terminal", component: "Pane", requestId: "crew", props: { title: "Crew", isFocused: false, bodyColumns: 50, placement: "dock" } as never });
    expect(await ui.find({ key: "act-init" })).toBeUndefined();
    expect(await ui.find({ type: "Text", text: /need the crew plugin/ })).toBeDefined();
    await ui.unmount();
});

test("the panel's settings: its language and whether it opens at the start, kept across sessions", async ($, on) => {
    world(on, []);
    await $.session.start({ cwd: "/p", surface: null, isInteractive: true } as never);

    for (const surface of surfaces) {
        const ui = await $.ui.mount({ plugin, surface, component: "Pane", requestId: "crew", props: { title: "Crew", isFocused: false, bodyColumns: 50, placement: "dock" } as never });
        await ui.press({ key: "open-settings" });
        expect(await ui.find({ type: "Text", text: "Panel settings" })).toBeDefined();
        await ui.select({ key: "settings-language", value: "it" });
        expect(await ui.find({ type: "Text", text: "Impostazioni del pannello" })).toBeDefined();
        expect((await ui.find({ key: "settings-auto-open" }))?.props.label).toBe("☑︎ Apri il pannello a inizio sessione");
        await ui.press({ key: "settings-auto-open" });
        // A new session reads them again from the store: still Italian, still closed at the start.
        await $.session.start({ cwd: "/p", surface: null, isInteractive: true } as never);
        expect((await ui.find({ key: "settings-auto-open" }))?.props.label).toBe("☐ Apri il pannello a inizio sessione");
        expect((await ui.find({ key: "settings-back" }))?.props.label).toBe("← Indietro");
        // Back to automatic and opening at the start, for the next surface.
        await ui.press({ key: "settings-auto-open" });
        await ui.select({ key: "settings-language", value: "auto" });
        expect((await ui.find({ key: "settings-back" }))?.props.label).toBe("← Back");
        await ui.press({ key: "settings-back" });
        expect(await ui.find({ key: "open-settings" })).toBeDefined();
        await ui.unmount();
    }
});

test("a colleague at work shows what they are doing now, on their row and in their card with their bar; finished, their report is one press away", async ($, on) => {
    world(on, []);
    on("turn.complete", () => ({ text: "" }) as never);
    // The tool itself, beneath the panel.
    on("tool.call", { tool: "Read" }, () => ({ result: "" }) as never);
    await $.session.start({ cwd: "/p", surface: null, isInteractive: true } as never);
    await $.agent.spawn({ prompt: "Review the parser.", description: "review the parser", subagentType: "matteo-conti" } as never);
    await $.tool.call({ tool: "Read", file_path: "/p/.claude/agent-memory/matteo-conti/MEMORY.md", agentId: "a1", tool_use_id: "r1" } as never);
    await $.tool.call({ tool: "mcp__crew__step", done: 1, total: 3, note: "reading my notes", agentId: "a1", tool_use_id: "s1" } as never);
    const ui = await $.ui.mount({ plugin, surface: "desktop", component: "Pane", requestId: "crew", props: { title: "Crew", isFocused: false, bodyColumns: 50, placement: "dock" } as never });
    expect(await ui.find({ type: "Text", text: "📄 MEMORY.md" })).toBeDefined();
    await ui.press({ key: "open-matteo-conti" });
    expect(await ui.find({ type: "Text", text: "Working" })).toBeDefined();
    expect(await ui.find({ type: "Text", text: /Review the parser · step 1 of 3: reading my notes/ })).toBeDefined();
    expect(await ui.find({ type: "Text", text: "📄 MEMORY.md" })).toBeDefined();
    await ui.press({ key: "back" });
    await $.turn.complete({ agentId: "a1", reason: "answer", answer: "The parser holds.", durationMs: 1000, isAborted: false, turnId: "t1" } as never);
    expect(await ui.find({ type: "Text", text: "📄 MEMORY.md" })).toBeUndefined();
    await ui.press({ key: "report-a1" });
    expect((await ui.find({ key: "report-text" }))?.text).toMatch(/The parser holds\./);
    await ui.unmount();
});

test("a colleague who had finished and is resumed by a message is at work again, and gives a new report at the end", async ($, on) => {
    const { files } = world(on, []);
    on("turn.complete", () => ({ text: "" }) as never);
    on("tool.call", { tool: "Read" }, () => ({ result: "" }) as never);
    await $.session.start({ cwd: "/p", surface: null, isInteractive: true } as never);
    await $.agent.spawn({ prompt: "Review the setup.", description: "review the setup", subagentType: "matteo-conti" } as never);
    await $.turn.complete({ agentId: "a1", reason: "answer", answer: "First look.", durationMs: 1000, isAborted: false, turnId: "t1" } as never);
    const ui = await $.ui.mount({ plugin, surface: "desktop", component: "Pane", requestId: "crew", props: { title: "Crew", isFocused: false, bodyColumns: 50, placement: "dock" } as never });
    expect((await ui.find({ key: "finished" }))?.props.label).toBe("▾ ✓ Finished · 1");
    // SendMessage resumes the same agent: its next call shows them at work again.
    await $.tool.call({ tool: "Read", file_path: "/p/.claude/agent-memory/matteo-conti/MEMORY.md", agentId: "a1", tool_use_id: "r1" } as never);
    expect((await ui.find({ key: "working-toggle" }))?.props.label).toBe("▾ ⚒︎ Working · 1");
    expect(await ui.find({ key: "finished" })).toBeUndefined();
    await $.turn.complete({ agentId: "a1", reason: "answer", answer: "Second look.", durationMs: 1000, isAborted: false, turnId: "t2" } as never);
    expect((await ui.find({ key: "finished" }))?.props.label).toBe("▾ ✓ Finished · 1");
    expect(Object.keys(files).filter(path => path.includes("/matteo-conti/notes/")).length).toBe(2);
    await ui.unmount();
});
