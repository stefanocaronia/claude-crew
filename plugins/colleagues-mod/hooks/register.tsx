// The colleagues' panel and their meetings: a card for each colleague, their runs with the steps they report, the week's budget,
// a meeting drawn as a group chat with its controls above the prompt. The meeting itself is the colleagues plugin's hook: the
// controls send it the phrases it understands, and its state file says who is in the conversation.
import { atom, read, update } from "claude-code";
import type { EngineInterface, Register } from "claude-code";

import type { Colleague, Run } from "../types";

import { headerHeight, headerSvg, idleHeight, idleSvg, meetingHeight, meetingSvg, runHeight, runSvg, speakerHeight, speakerSvg, contextShare, progressOf } from "./draw.ts";
import type { Words } from "./draw.ts";
import { isEnding, isNarration, segmentsOf, speakersOf } from "./meeting.ts";
import { cardFrom, colleagueFrom, colleagueOf } from "./team.ts";
import { contextWindowOf, formatTime, formatTokens, formatUntil, languageOf, modelName, words } from "./text.ts";
import type { Language } from "./text.ts";

const pane = "colleagues";
const stepTool = "mcp__colleagues-mod__step";
const team = atom({ plugin: "colleagues-mod", key: "team" } as const, []);
const runs = atom({ plugin: "colleagues-mod", key: "runs" } as const, []);
const meeting = atom({ plugin: "colleagues-mod", key: "meeting" } as const, { members: [] });
const budget = atom({ plugin: "colleagues-mod", key: "budget" } as const, []);
const view = atom({ plugin: "colleagues-mod", key: "view" } as const, { isFinishedCollapsed: false, autoOpened: false });
const card = atom({ plugin: "colleagues-mod", key: "card" } as const, null);
const now = atom({ plugin: "colleagues-mod", key: "now" } as const, 0);

// Module scope, set again by session.start at every load: the portraits as data URIs, and the panel's language.
let portraits = new Map<string, string>();
let language: Language = "en";
const say = (): Words => words[language];

export const register: Register = (on, options) => {
    on("session.start", async ($, e, next) => {
        const started = await next(e);
        language = languageOf(options.language, await settingsLanguage($), await $.env.get("LANG"));
        await $.tool.register({
            name: "step",
            description: "For a colleague in a review round: report your progress to the colleagues panel. Right after reading the brief, call it with "
                + "`total` (your plan in 3 to 8 steps) and `done: 0`; then call it again as each step finishes, with `note` naming the step now in "
                + "progress. Silent and cheap: it only draws a bar.",
            inputSchema: {
                type: "object",
                properties: {
                    done: { type: "integer", minimum: 0, description: "Steps finished so far." },
                    total: { type: "integer", minimum: 1, description: "Steps planned; it may change with the plan." },
                    note: { type: "string", description: "The step in progress, in a few words." },
                },
                required: ["done"],
            },
            isDeferred: false,
        });
        await $.command.register({ name: "colleagues-panel", description: "Show or hide the colleagues panel: the team, who is at work, the meeting, the week's budget" });
        await refresh($);

        // The team is there to be seen from the start: the panel opens once, where the surface docks it beside the chat.
        if ((await read($, team)).length) {
            await openOnce($);
        }

        // The clocks of the colleagues at work; quiet when nobody works.
        $.clock.every(2000, () => {
            void (async () => {
                if ((await read($, runs)).some(run => run.status === "running")) {
                    const at = await $.clock.now();
                    await update($, now, () => at);
                }
            })();
        });
        return started;
    });

    on("command.run", { command: "colleagues-panel" }, async $ => {
        const isOpen = (await $.ui.panes()).some(open => open.id === pane);

        if (isOpen) {
            await $.ui.close({ id: pane });
            return { text: say().closed };
        }

        await refresh($);
        await $.ui.open({ id: pane, title: say().pane });
        return { text: say().opened };
    });

    // A colleague's own progress: the call runs in their loop, so agentId names the run.
    on("tool.call", { tool: stepTool }, async ($, e) => {
        const input = e as unknown as { done?: number; total?: number; note?: string };

        if (!e.agentId) {
            return { result: say().stepIgnored };
        }

        await update($, runs, list => list.map(run => {
            if (run.agentId !== e.agentId) {
                return run;
            }

            const total = Math.max(0, Math.round(input.total ?? run.stepTotal ?? 0));
            const done = Math.max(0, Math.round(input.done ?? run.stepDone ?? 0));
            return { ...run, stepTotal: total || undefined, stepDone: total ? Math.min(total, done) : done, stepNote: input.note?.trim() || undefined };
        }));
        return { result: say().stepDone };
    });

    on("agent.spawn", async ($, e, next) => {
        const started = await next(e);
        const colleague = colleagueOf(await read($, team), e.subagentType);

        if (started.deny !== undefined || !colleague || !started.agentId) {
            return started;
        }

        const at = await $.clock.now();
        const run: Run = {
            agentId: started.agentId,
            colleague: colleague.id,
            task: e.description,
            model: started.model,
            status: "running",
            startedAt: at,
            contextTokens: 0,
            contextMax: contextWindowOf(started.model),
            tokens: 0,
        };
        await update($, runs, list => [...list.filter(other => other.agentId !== run.agentId), run].slice(-100));
        await update($, now, () => at);
        await openOnce($);
        return started;
    });

    // Each model request of a colleague at work: how full their context is, the tokens, the effort.
    on("turn.step", async function* ($, e, next) {
        const result = yield* next(e);
        const usage = result.usage;

        if (!e.agentId || !usage) {
            return result;
        }

        const spent = (usage.input_tokens || 0) + (usage.cache_read_input_tokens || 0) + (usage.cache_creation_input_tokens || 0) + (usage.output_tokens || 0);
        await update($, runs, list => list.map(run => (run.agentId !== e.agentId ? run : {
            ...run,
            model: usage.model || e.model,
            effort: typeof e.effort === "string" ? e.effort : run.effort,
            contextTokens: spent,
            contextMax: contextWindowOf(usage.model || e.model),
            tokens: run.tokens + spent,
        })));
        return result;
    });

    // The main loop has read the prompt, and the colleagues plugin's hook has run: who is in the conversation now.
    on("turn.start", async ($, e, next) => {
        const started = await next(e);
        await refreshMeeting($);
        return started;
    });

    on("turn.complete", async ($, e, next) => {
        const at = await $.clock.now();

        if (e.agentId) {
            await update($, runs, list => list.map(run => (run.agentId !== e.agentId ? run : { ...run, status: e.reason === "answer" ? "done" : "failed", endedAt: at })));
            await update($, now, () => at);
        } else {
            await refresh($);
        }

        return next(e);
    });

    // Who spoke last, from the reply as it is stored; a reply with no colleague in it means Claude is back.
    on("session.append", async ($, e, next) => {
        const stored = await next(e);

        if (e.agentId || e.door !== "response" || e.message.role !== "assistant") {
            return stored;
        }

        const text = e.message.content.flatMap(block => (block.type === "text" && typeof block.text === "string" ? [block.text] : [])).join("\n\n");

        if (!text.trim()) {
            return stored;
        }

        const speakers = speakersOf(text, await read($, team));

        if (speakers.length) {
            await update($, meeting, current => ({ members: [...new Set([...current.members, ...speakers.map(speaker => speaker.id)])], last: speakers.at(-1)?.id }));
        } else if (!isNarration(text)) {
            await update($, meeting, current => ({ members: current.members, last: undefined }));
        }

        return stored;
    });

    on("prompt.submit", async ($, e, next) => {
        if (isEnding(e.text)) {
            await update($, meeting, () => ({ members: [] }));
        }

        return next(e);
    });

    on("ui.render", { component: "Pane", requestId: pane }, async ($, e) => {
        const ui = $.ui.resolve(e);
        const { Box, Text, Button, Markdown } = ui;
        const words = say();
        const colleagues = await read($, team);
        const list = await read($, runs);
        const talk = await read($, meeting);
        const windows = await read($, budget);
        const panel = await read($, view);
        const at = Math.max(await read($, now), ...list.map(run => run.startedAt), 0);
        const width = Math.max(240, Math.min(900, (e.props.bodyColumns || 40) * 8 - 8));
        const byId = new Map(colleagues.map(colleague => [colleague.id, colleague]));
        const running = list.filter(run => run.status === "running").reverse();
        const finished = list.filter(run => run.status !== "running").reverse();
        const busy = new Set(running.map(run => run.colleague));
        const idle = colleagues.filter(colleague => !busy.has(colleague.id));
        const selected = panel.selected ? byId.get(panel.selected) : undefined;
        // The meeting itself lives in the main chat and above the prompt: here it is only a ring on who is in it.
        const presence = (colleague: Colleague) => (talk.last === colleague.id ? "speaking" : talk.members.includes(colleague.id) ? "member" : undefined);
        const isDesktop = e.surface === "desktop" && "Svg" in ui;

        if (!colleagues.length) {
            return <Text dimColor>{words.empty}</Text>;
        }

        if (selected) {
            const details = await read($, card);
            return (
                <Box flexDirection="column" gap={1}>
                    <Button key="back" label={`← ${words.team}`} plain onPress={() => update($, view, current => ({ ...current, selected: undefined }))} />
                    {isDesktop && "Svg" in ui
                        ? <ui.Svg source={idleSvg(width, selected, portraits, words)} alt={`${selected.fullName}, ${selected.role}`} width={width} height={idleHeight} />
                        : <Text bold color={selected.color}>{selected.fullName} <Text dimColor>· {selected.role}</Text></Text>}
                    {details?.id === selected.id && details.description ? <Text dimColor>{details.description}</Text> : null}
                    {details?.id === selected.id ? <Markdown key="todo" text={details.openTasks.length ? details.openTasks.map(task => `- ${task}`).join("\n") : `*${words.toDo(0)}*`} /> : null}
                    {details?.id === selected.id && details.memory ? <Markdown key="memory" text={clip(details.memory, 1600)} dimColor /> : null}
                    <Button key="talk" label={`${words.talk} ${selected.name}`} onPress={() => void $.prompt.fill({ text: words.talkPrompt(selected.name), mode: "replace" })} />
                </Box>
            );
        }

        const open = (colleague: Colleague) => async () => {
            await update($, view, current => ({ ...current, selected: colleague.id }));
            await readCard($, colleague.id);
        };
        const chips = (
            <Box key="chips" flexDirection="row" flexWrap="wrap" gap={1}>
                {colleagues.map(colleague => <Button key={`open-${colleague.id}`} label={colleague.name} plain onPress={open(colleague)} />)}
            </Box>
        );
        const toggleFinished = (
            <Button
                key="finished"
                label={`${panel.isFinishedCollapsed ? "▸" : "▾"} ${words.finished} · ${finished.length}`}
                plain
                onPress={() => update($, view, current => ({ ...current, isFinishedCollapsed: !current.isFinishedCollapsed }))}
            />
        );

        if (isDesktop && "Svg" in ui) {
            const { Svg } = ui;
            const runCard = (run: Run) => {
                const colleague = byId.get(run.colleague);
                return colleague ? <Svg key={run.agentId} source={runSvg(width, run, colleague, portraits, at, words)} alt={`${colleague.fullName}: ${run.task}`} width={width} height={runHeight} /> : null;
            };
            return (
                <Box flexDirection="column">
                    <Svg key="header" source={headerSvg(width, windows, list, at, words)} alt={words.week} width={width} height={headerHeight} />
                    {running.length ? <Text key="h-working" dimColor>{words.working} · {running.length}</Text> : null}
                    {running.map(runCard)}
                    {finished.length ? toggleFinished : null}
                    {panel.isFinishedCollapsed ? null : finished.map(runCard)}
                    <Text key="h-team" dimColor>{words.team} · {idle.length}</Text>
                    {idle.map(colleague => <Svg key={`idle-${colleague.id}-${colleague.avatarStamp}`} source={idleSvg(width, colleague, portraits, words, presence(colleague))} alt={`${colleague.fullName}, ${colleague.role}`} width={width} height={idleHeight} />)}
                    <Text key="h-cards" dimColor>{words.cards}</Text>
                    {chips}
                </Box>
            );
        }

        // The terminal: the same in rows of text.
        const columns = Math.max(24, e.props.bodyColumns || 40);
        const barWidth = Math.max(6, Math.min(20, columns - 34));
        const row = (run: Run) => {
            const colleague = byId.get(run.colleague);
            const share = progressOf(run) ?? contextShare(run);
            const steps = run.stepTotal ? `${run.stepDone ?? 0}/${run.stepTotal}${run.stepNote ? ` ${run.stepNote}` : ""} · ` : "";
            return colleague
                ? (
                    <Box key={run.agentId} flexDirection="column" marginBottom={1}>
                        <Text wrap="truncate-end"><Text color={colleague.color} bold>● {colleague.fullName}</Text> <Text dimColor>{run.task}</Text></Text>
                        <Text dimColor wrap="truncate-end">  {modelName(run.model)}{run.effort ? ` · ${run.effort}` : ""}</Text>
                        <Text wrap="truncate-end">  <Text color={colleague.color}>{bar(share, barWidth)}</Text><Text dimColor> {steps}{formatTokens(run.tokens)} · {formatTime((run.endedAt ?? at) - run.startedAt)}</Text></Text>
                    </Box>
                )
                : null;
        };
        const week = windows.find(window => window.kind === "seven_day");
        return (
            <Box flexDirection="column">
                {week ? <Text dimColor>{words.week} {Math.round(week.percentUsed)}%{week.resetsAt ? ` · ↻ ${formatUntil(week.resetsAt, at)}` : ""}</Text> : null}
                {running.length ? <Text dimColor>{words.working} · {running.length}</Text> : null}
                {running.map(row)}
                {finished.length ? toggleFinished : null}
                {panel.isFinishedCollapsed ? null : finished.map(row)}
                <Text dimColor>{words.team} · {idle.length}</Text>
                {idle.map(colleague => <Text key={`idle-${colleague.id}`} wrap="truncate-end"><Text color={colleague.color}>{presence(colleague) ? "◉ " : "● "}</Text>{colleague.fullName} <Text dimColor>· {colleague.role} · {words.toDo(colleague.openTasks)}{presence(colleague) ? ` · ${presence(colleague) === "speaking" ? words.speaking : words.inMeeting}` : ""}</Text></Text>)}
                <Text dimColor>{words.cards}</Text>
                {chips}
            </Box>
        );
    });

    // During a meeting, above the prompt: who is in it, who speaks, and the controls.
    on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
        const talk = await read($, meeting);
        const colleagues = await read($, team);
        const byId = new Map(colleagues.map(colleague => [colleague.id, colleague]));
        const members = talk.members.flatMap(id => byId.get(id) ?? []);

        if (!members.length || e.props.hasSurvey) {
            return next(e);
        }

        const ui = $.ui.resolve(e);
        const { Box, Text } = ui;
        const words = say();

        if (e.surface !== "terminal" && "Svg" in ui) {
            const width = Math.max(240, Math.min(900, (e.props.bodyColumns || 100) * 8 - 96));
            return (
                <Box flexDirection="column">
                    <ui.Svg source={meetingSvg(width, members, byId.get(talk.last ?? ""), portraits, words)} alt={`${words.meeting}: ${members.map(member => member.name).join(", ")}`} width={width} height={meetingHeight} />
                    {meetingControls($, ui, members, colleagues, words)}
                </Box>
            );
        }

        return (
            <Box flexDirection="column">
                <Text>
                    <Text bold>{words.meeting}: </Text>
                    {members.map((member, index) => <Text key={member.id} color={member.color} bold={member.id === talk.last}>{index ? ", " : ""}{member.name}</Text>)}
                    {talk.last ? <Text dimColor> · {words.speaking}: {byId.get(talk.last)?.name}</Text> : null}
                </Text>
                {meetingControls($, ui, members, colleagues, words)}
            </Box>
        );
    });

    // A reply with colleagues speaking, drawn as a group chat: each turn under its speaker's portrait and name.
    on("ui.render", { component: "AssistantMessage" }, async ($, e, next) => {
        if (e.props.isSummary) {
            return next(e);
        }

        const segments = segmentsOf(e.props.text, await read($, team));

        if (!segments) {
            return next(e);
        }

        const ui = $.ui.resolve(e);
        const { Box, Text, Markdown } = ui;
        const width = Math.max(240, Math.min(560, (e.viewport?.columns ?? 70) * 8 - 32));
        // Every surface hands out the whole table, an element it lacks drawing nothing: the terminal draws no Svg.
        const drawsSvg = e.surface !== "terminal";
        return (
            <Box flexDirection="column" gap={1}>
                {segments.map((segment, index) => {
                    const speaker = segment.speaker;

                    if (!speaker) {
                        return <Markdown key={`n${index}`} text={segment.text} dimColor />;
                    }

                    const head = segment.isContinued ? null
                        : drawsSvg && "Svg" in ui
                        ? <ui.Svg source={speakerSvg(width, speaker, portraits)} alt={`${speaker.fullName}, ${speaker.role}`} width={width} height={speakerHeight} />
                        : <Text><Text color={speaker.color} bold>● {speaker.fullName}</Text> <Text dimColor>{speaker.role}</Text></Text>;
                    return (
                        <Box key={`s${index}`} flexDirection="column">
                            {head}
                            <Box paddingLeft={drawsSvg ? 4 : 2}><Markdown text={segment.text} /></Box>
                        </Box>
                    );
                })}
            </Box>
        );
    });
};

// The meeting's controls: a ✕ to let each one go, a menu to invite the others, a button to close it. Each sends the phrase the
// colleagues plugin's hook understands, as if the user typed it.
function meetingControls($: EngineInterface, ui: ReturnType<EngineInterface["ui"]["resolve"]>, members: Colleague[], colleagues: Colleague[], words: Words)
{
    const { Box, Button } = ui;
    const others = colleagues.filter(colleague => !members.includes(colleague));
    // The meeting changes at once on screen; the hook's state file confirms it when the turn starts.
    const send = (text: string, change: (ids: string[]) => string[]) => async () => {
        await update($, meeting, current => ({ members: change(current.members), last: current.last }));
        await $.prompt.submit({ text, asUser: true });
    };
    const phrases = language === "it"
        ? { invite: (name: string) => `voglio parlare anche con ${name}`, leave: (name: string) => `${name} può andare`, close: "riunione finita", inviteLabel: "Invita…", closeLabel: "Chiudi riunione" }
        : { invite: (name: string) => `I also want to talk to ${name}`, leave: (name: string) => `${name} can go`, close: "the meeting is over", inviteLabel: "Invite…", closeLabel: "Close meeting" };
    return (
        <Box key="meeting-controls" flexDirection="row" flexWrap="wrap" gap={1}>
            {members.map(member => <Button key={`leave-${member.id}`} label={`✕ ${member.name}`} plain onPress={send(phrases.leave(member.name), ids => ids.filter(id => id !== member.id))} />)}
            {others.length && "Select" in ui
                ? (
                    <ui.Select
                        key="invite"
                        label={phrases.inviteLabel}
                        options={others.map(colleague => ({ value: colleague.id, label: `${colleague.name} · ${colleague.role}` }))}
                        onSelect={value => send(phrases.invite(others.find(colleague => colleague.id === value)?.name ?? value), ids => [...ids, value])()}
                    />
                )
                : null}
            <Button key="close" label={phrases.closeLabel} onPress={send(phrases.close, () => [])} />
        </Box>
    );
}

// The team from their files, the budget's windows, and who is in the conversation.
async function refresh($: EngineInterface): Promise<void>
{
    const root = await projectRoot($);
    const agents = `${root}/.claude/agents`;
    const loaded: Colleague[] = [];
    const found = new Map<string, string>();

    for (const entry of (await $.fs.exists(agents)) ? await $.fs.list(agents) : []) {
        const id = entry.name.endsWith(".md") ? entry.name.slice(0, -".md".length) : "";
        const folder = `${root}/.claude/agent-memory/${id}`;

        if (!id || !(await $.fs.exists(`${folder}/todo.md`))) {
            continue;
        }

        const portrait = await readPortrait($, folder);

        if (portrait) {
            found.set(id, portrait.uri);
        }

        loaded.push(colleagueFrom(id, await $.fs.read(`${agents}/${entry.name}`), await $.fs.read(`${folder}/todo.md`), portrait?.stamp ?? 0));
    }

    portraits = found;
    const sorted = loaded.sort((first, second) => first.name.localeCompare(second.name));

    // Every message in the chat draws from the team: it is written only when it changed.
    if (JSON.stringify(sorted) !== JSON.stringify(await read($, team))) {
        await update($, team, () => sorted);
    }

    const usage = await $.session.usage();
    const windows = usage.rateLimits.map(window => ({ kind: window.kind, percentUsed: window.percentUsed, resetsAt: window.resetsAt }));

    if (JSON.stringify(windows) !== JSON.stringify(await read($, budget))) {
        await update($, budget, () => windows);
    }

    await refreshMeeting($);
}

// The portrait as a data URI, avatar.png or avatar.svg, with the file's time so a new one is drawn again.
async function readPortrait($: EngineInterface, folder: string): Promise<{ uri: string; stamp: number } | undefined>
{
    for (const [file, type] of [["avatar.png", "image/png"], ["avatar.svg", "image/svg+xml"]] as const) {
        const path = `${folder}/${file}`;

        if (await $.fs.exists(path)) {
            const { base64 } = await $.fs.read(path, { as: "bytes" });
            return { uri: `data:${type};base64,${base64}`, stamp: (await $.fs.stat(path)).mtimeMs };
        }
    }

    return undefined;
}

async function readCard($: EngineInterface, id: string): Promise<void>
{
    const root = await projectRoot($);
    const text = async (path: string) => ((await $.fs.exists(path)) ? await $.fs.read(path) : "");
    const loaded = cardFrom(id, await text(`${root}/.claude/agents/${id}.md`), await text(`${root}/.claude/agent-memory/${id}/todo.md`), await text(`${root}/.claude/agent-memory/${id}/MEMORY.md`));
    await update($, card, () => loaded);
}

async function projectRoot($: EngineInterface): Promise<string>
{
    return (await $.session.root()).replace(/\\/g, "/");
}

// The colleagues plugin's hook keeps who is in the conversation in the system's temp folder, by session.
async function refreshMeeting($: EngineInterface): Promise<void>
{
    const path = `${await tempFolder($)}/claude-colleagues/${(await $.session.id()).replace(/[^\w-]/g, "_")}.json`;

    if (!(await $.fs.exists(path))) {
        if ((await read($, meeting)).members.length) {
            await update($, meeting, () => ({ members: [] }));
        }

        return;
    }

    try {
        const active = (JSON.parse(await $.fs.read(path)) as { active?: string[] }).active ?? [];
        const current = await read($, meeting);

        if (JSON.stringify(active) !== JSON.stringify(current.members)) {
            await update($, meeting, () => ({ members: active, last: current.last && active.includes(current.last) ? current.last : undefined }));
        }
    } catch {
        // A file being written right now: the next turn reads it again.
    }
}

// Where Node's os.tmpdir() points, which is where the hook writes.
async function tempFolder($: EngineInterface): Promise<string>
{
    const isWindows = (await $.env.get("OS")) === "Windows_NT";
    const temp = await $.env.get("TEMP");
    const tmp = await $.env.get("TMP");
    const found = isWindows ? temp || tmp : (await $.env.get("TMPDIR")) || tmp || temp;

    if (found) {
        return found.replace(/\\/g, "/").replace(/\/+$/, "");
    }

    return isWindows ? `${((await $.env.get("SystemRoot")) ?? "C:/Windows").replace(/\\/g, "/")}/temp` : "/tmp";
}

async function openOnce($: EngineInterface): Promise<void>
{
    if ((await read($, view)).autoOpened) {
        return;
    }

    await update($, view, current => ({ ...current, autoOpened: true }));
    void $.ui.open({ id: pane, title: say().pane });
}

async function settingsLanguage($: EngineInterface): Promise<string | undefined>
{
    try {
        const settings = (await $.settings.read()) as Record<string, unknown>;
        return typeof settings.language === "string" ? settings.language : undefined;
    } catch {
        return undefined;
    }
}

function bar(share: number, width: number): string
{
    const filled = Math.round(width * Math.max(0, Math.min(1, share)));
    return "█".repeat(filled) + "░".repeat(Math.max(0, width - filled));
}

function clip(text: string, length: number): string
{
    return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}
