// The mod's drawings and controls on the terminal and the desktop, over a small project of fake files:
// claude plugin test plugins/crew-mod
import type { On } from "claude-code";
import { expect, mock, test } from "claude-code/testing";

const plugin = "crew-mod";
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
        .map(path => ({ name: path.slice(folder.length + 1), kind: "file", size: 1, mtimeMs: 0, isLink: false }) as never);
}

// The crew plugin's script: talk, invite, leave and end change who is in the conversation, in its state file.
function keepMeeting(files: Record<string, string>, command: string, args: string): void
{
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

// The world beneath the mod: the project's files, the session, the hook's state file naming who is in the conversation.
function world(on: On, members: string[], hasCommands = true): string[] & { files: Record<string, string> }
{
    const sent: string[] = [];
    const files: Record<string, string> = { ...project, ...(members.length ? { "/tmp/claude-crew/s1.json": JSON.stringify({ active: members }) } : {}) };
    mock.env(on, { OS: "Linux", TMPDIR: "/tmp", LANG: "en_US.UTF-8" });
    mock.clock(on, { now: Date.UTC(2026, 9, 10, 9, 0) });
    on("session.start", () => ({ cwd: "/p" }) as never);
    on("settings.read", () => ({ value: {} }) as never);
    on("tool.register", () => ({ value: {} }) as never);
    on("command.register", () => ({ value: {} }) as never);
    on("session.root", () => ({ value: "/p" }));
    on("session.id", () => ({ value: "s1" }));
    on("session.usage", () => ({ value: { startedAt: 0, context: {}, rateLimits: [{ kind: "seven_day", percentUsed: 62, resetsAt: "2026-10-12T05:00:00Z" }] } }) as never);
    on("fs.exists", (_, e) => ({ value: Object.keys(files).some(path => path === posix(e.path) || path.startsWith(`${posix(e.path)}/`)) }));
    on("fs.list", (_, e) => ({ value: listed(files, posix(e.path)) }));
    on("fs.read", (_, e) => ({ value: files[posix(e.path)] ?? "" }));
    on("fs.stat", () => ({ value: { mtimeMs: 1 } }) as never);
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
    return Object.assign(sent, { files });
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
    await $.tool.call({ tool: "mcp__crew-mod__panel", tool_use_id: "t1" } as never);
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

test("under the team: the backlog, each task with who holds it and its effort; a meeting with the colleagues picked, or with everyone", async ($, on) => {
    const sent = world(on, []);
    const submitted: string[] = [];
    on("prompt.submit", (_, e) => {
        submitted.push(e.text);
        return { drop: "kept by the test" } as never;
    });
    const filled: string[] = [];
    on("prompt.fill", (_, e) => {
        filled.push(e.text);
        return { isFilled: true } as never;
    });
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
        await ui.press({ key: "act-round" });
        expect(filled.at(-1)).toBe("run a review round with Sara and Matteo on ");
        expect(await ui.find({ type: "Text", text: "✕ Fire Sara and Matteo" })).toBeDefined();
        await ui.press({ key: "act-fire" });
        expect(submitted.at(-1)).toBe("fire Sara and Matteo");
        await ui.press({ key: "act-portraits-style" });
        await ui.press({ key: "act-portraits" });
        expect(submitted.at(-1)).toBe("draw the portraits of Sara and Matteo again, in 80s-90s anime style");
        await ui.press({ key: "act-meeting" });
        expect(sent.at(-1)).toBe("/crew:talk Sara Matteo");
        expect((await ui.find({ key: "pick-sara-lombardi" }))?.props.label).toBe("☐");
        await ui.press({ key: "act-meeting" });
        expect(sent.at(-1)).toBe("/crew:talk Giulia Matteo Sara");
        expect(await ui.find({ key: "act-fire" })).toBeUndefined();
        await ui.press({ key: "act-portraits-style" });
        await ui.press({ key: "act-portraits-style" });
        await ui.press({ key: "act-portraits" });
        expect(submitted.at(-1)).toBe("draw the portraits of the whole team again, in vector cartoon style");
        await ui.press({ key: "act-portraits-style" });
        await ui.press({ key: "act-hire" });
        expect(submitted.at(-1)).toBe("hire a colleague");
        await ui.unmount();
    }
});

test("the panel shows who is at work and the team, and a colleague's card with its actions", async ($, on) => {
    world(on, []);
    const submitted: string[] = [];
    on("prompt.submit", (_, e) => {
        submitted.push(e.text);
        return { drop: "kept by the test" } as never;
    });
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

        for (const level of ["low", "medium", "high", "extra high", "max", "as the session"]) {
            await ui.press({ key: "card-effort" });
            expect((await ui.find({ key: "card-effort" }))?.props.label).toBe(level);
        }

        expect((await ui.find({ key: "permission-read" }))?.props.label).toBe("☐ Read");
        await ui.press({ key: "permission-test" });
        expect((await ui.find({ key: "permission-test" }))?.props.label).toBe("☑︎ Testing");
        expect((await ui.find({ key: "permission-read" }))?.props.label).toBe("☑︎ Read");
        await ui.press({ key: "permission-read" });
        expect((await ui.find({ key: "permission-test" }))?.props.label).toBe("☐ Testing");
        expect((await ui.find({ key: "permission-read" }))?.props.label).toBe("☐ Read");
        await ui.press({ key: "permission-write" });
        await ui.press({ key: "back" });
        // Only Matteo may now change files: one pencil on the cards.
        expect(Boolean(surface === "desktop" ? await ui.find({ type: "Svg", props: { alt: "can change the project's files" } } as never) : await ui.find({ type: "Text", text: "✎" }))).toBe(true);
        await ui.press({ key: "open-matteo-conti" });
        await ui.press({ key: "permission-write" });
        await ui.press({ key: "card-portrait-style" });
        await ui.press({ key: "card-portrait" });
        expect(submitted.at(-1)).toBe("draw the portraits of Matteo again, in 80s-90s anime style");
        await ui.press({ key: "card-portrait-style" });
        await ui.press({ key: "card-portrait-style" });
        await ui.press({ key: "card-portrait-style" });
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
    expect((again as { deny?: string }).deny).toMatch(/Matteo is already at work on "review the parser"/);
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
