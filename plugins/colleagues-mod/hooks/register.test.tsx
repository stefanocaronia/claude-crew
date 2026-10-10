// The mod's drawings and controls on the terminal and the desktop, over a small project of fake files:
// claude plugin test plugins/colleagues-mod
import type { On } from "claude-code";
import { expect, mock, test } from "claude-code/testing";

const plugin = "colleagues-mod";
const surfaces = ["terminal", "desktop"] as const;
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

// The world beneath the mod: the project's files, the session, the hook's state file naming who is in the conversation.
function world(on: On, members: string[], hasCommands = true): string[]
{
    const sent: string[] = [];
    const files: Record<string, string> = { ...project, ...(members.length ? { "/tmp/claude-colleagues/s1.json": JSON.stringify({ active: members }) } : {}) };
    mock.env(on, { OS: "Linux", TMPDIR: "/tmp" });
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
    on("ui.render", ($, e) => {
        const { Text } = $.ui.resolve(e);
        return <Text key="engine">engine</Text>;
    });
    on("ui.open", () => ({ value: {} }) as never);
    on("command.list", () => ({ value: hasCommands ? [{ name: "colleagues:talk", description: "", source: "plugin", plugin: "colleagues", isFullscreen: false }] : [] }) as never);
    on("agent.spawn", () => ({ model: "claude-opus-5-5", agentId: "a1" }) as never);
    on("command.run", (_, e) => {
        sent.push(`/${e.command}${e.args ? ` ${e.args}` : ""}`);
        return { text: "" } as never;
    });
    return sent;
}

test("the meeting's controls let one go, invite another and close it, through the colleagues' commands", async ($, on) => {
    const sent = world(on, ["matteo-conti", "giulia-ferri"]);
    await $.session.start({ cwd: "/p", surface: null, isInteractive: true } as never);

    for (const surface of surfaces) {
        sent.length = 0;
        await $.session.start({ cwd: "/p", surface: null, isInteractive: true } as never);
        const ui = await $.ui.mount({ plugin, surface, component: "AbovePrompt", props: band });
        expect((await ui.find({ key: "leave-matteo-conti" }))?.props.label).toBe("✕ Matteo");
        await ui.press({ key: "leave-matteo-conti" });
        await ui.select({ key: "invite", value: "sara-lombardi" });
        expect(sent).toEqual(["/colleagues:leave Matteo", "/colleagues:invite Sara"]);
        await ui.unmount();
    }

    const ui = await $.ui.mount({ plugin, surface: "desktop", component: "AbovePrompt", props: band });
    await ui.press({ key: "close" });
    expect(sent.at(-1)).toBe("/colleagues:end");
    expect(await ui.find({ key: "close" })).toBeUndefined();
});

test("without the colleagues plugin's commands, the panel says how to install them", async ($, on) => {
    world(on, [], false);
    await $.session.start({ cwd: "/p", surface: null, isInteractive: true } as never);
    const ui = await $.ui.mount({ plugin, surface: "terminal", component: "Pane", requestId: "colleagues", props: { title: "Colleagues", isFocused: false, bodyColumns: 50, placement: "dock" } as never });
    expect(await ui.find({ type: "Text", text: /plugin install colleagues@colleagues/ })).toBeDefined();
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
        expect(await ui.find({ type: "Text", text: "Matteo Conti" })).toBeDefined();
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
        const ui = await $.ui.mount({ plugin, surface, component: "Pane", requestId: "colleagues", props: { title: "Colleagues", isFocused: false, bodyColumns: 50, placement: "dock" } as never });
        expect(await ui.find({ key: "close" })).toBeUndefined();

        if (surface === "terminal") {
            expect(await ui.find({ type: "Text", text: /in the meeting · 1 to do/ })).toBeDefined();
        }

        await ui.unmount();
    }
});

test("under the team: the latest news, the open tasks by colleague, and phrases to start from", async ($, on) => {
    world(on, []);
    const filled: string[] = [];
    on("prompt.fill", (_, e) => {
        filled.push(e.text);
        return { isFilled: true } as never;
    });
    await $.session.start({ cwd: "/p", surface: null, isInteractive: true } as never);

    for (const surface of surfaces) {
        const ui = await $.ui.mount({ plugin, surface, component: "Pane", requestId: "colleagues", props: { title: "Colleagues", isFocused: false, bodyColumns: 50, placement: "dock" } as never });
        expect(await ui.find({ type: "Text", text: "9 October" })).toBeDefined();
        expect(await ui.find({ type: "Text", text: /62% ↻ 1d 20h/ })).toBeDefined();
        expect(await ui.find({ type: "Text", text: "Open tasks · 2" })).toBeDefined();
        expect(await ui.find({ type: "Markdown", text: /retest the parser/ })).toBeUndefined();
        await ui.press({ key: "toggle-matteo-conti" });
        expect(await ui.find({ type: "Markdown", text: /retest the parser/ })).toBeDefined();
        await ui.press({ key: "toggle-matteo-conti" });
        await ui.press({ key: "act-meeting" });
        expect(filled.at(-1)).toBe("I want to talk to Giulia, Matteo and Sara ");
        await ui.unmount();
    }
});

test("the panel shows who is at work and the team, and a colleague's card", async ($, on) => {
    world(on, []);
    await $.session.start({ cwd: "/p", surface: null, isInteractive: true } as never);
    await $.agent.spawn({ prompt: "Review the parser.", description: "review the parser", subagentType: "matteo-conti" } as never);

    for (const surface of surfaces) {
        const ui = await $.ui.mount({ plugin, surface, component: "Pane", requestId: "colleagues", props: { title: "Colleagues", isFocused: false, bodyColumns: 50, placement: "dock" } as never });
        expect(await ui.find({ type: "Text", text: /review the parser/ })).toBeDefined();
        expect(Boolean(await ui.find({ type: "Svg", props: { alt: "Matteo Conti" } } as never))).toBe(surface === "desktop");
        await ui.press({ key: "open-matteo-conti" });
        expect(await ui.find({ type: "Markdown", text: /retest the parser/ })).toBeDefined();
        await ui.press({ key: "back" });
        expect((await ui.find({ key: "open-giulia-ferri" }))?.props.label).toBe("Giulia Ferri");
        await ui.unmount();
    }
});
