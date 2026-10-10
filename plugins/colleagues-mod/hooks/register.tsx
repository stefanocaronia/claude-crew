// The colleagues' panel and their meetings: the team with their portraits, who is at work and the steps they report, a colleague's
// card, and a meeting drawn as a group chat with its controls above the prompt. The meeting itself is the colleagues plugin's
// hook: the controls send it the phrases it understands, and its state file says who is in the conversation.
import { atom, read, update } from "claude-code";
import type { EngineInterface, Register } from "claude-code";

import type { Colleague, Run } from "../types";

import { avatarSvg, barSvg } from "./draw.ts";
import { isNarration, segmentsOf, speakersOf } from "./meeting.ts";
import { contextShare, progressOf, totalTime } from "./progress.ts";
import { cardFrom, colleagueFrom, colleagueOf, latestHeading, openTasks } from "./team.ts";
import { contextWindowOf, formatAgo, formatTime, formatTokens, formatUntil, languageOf, listNames, modelName, words } from "./text.ts";
import type { Language, Words } from "./text.ts";

const pane = "colleagues";
const stepTool = "mcp__colleagues-mod__step";
const team = atom({ plugin: "colleagues-mod", key: "team" } as const, []);
const runs = atom({ plugin: "colleagues-mod", key: "runs" } as const, []);
const meeting = atom({ plugin: "colleagues-mod", key: "meeting" } as const, { members: [] });
const budget = atom({ plugin: "colleagues-mod", key: "budget" } as const, []);
const view = atom({ plugin: "colleagues-mod", key: "view" } as const, { isFinishedCollapsed: false, autoOpened: false });
const card = atom({ plugin: "colleagues-mod", key: "card" } as const, null);
const gallery = atom({ plugin: "colleagues-mod", key: "gallery" } as const, 0);
const board = atom({ plugin: "colleagues-mod", key: "board" } as const, { news: [], tasks: [], checkedAt: 0 });
const now = atom({ plugin: "colleagues-mod", key: "now" } as const, 0);

// Module scope, set again at every load: the portraits as data URIs (too large for the state, whose `gallery` says when they
// changed), and the panel's language.
let portraits = new Map<string, string>();
let portraitsRead = "";
let language: Language = "en";
const say = (): Words => words[language];

type Table = ReturnType<EngineInterface["ui"]["resolve"]>;

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
        await $.command.register({ name: "colleagues-panel", description: "Show or hide the colleagues panel: the team with their cards, who is at work, the steps they report" });
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


    // The panel: the team, each with portrait, name (which opens their card), role and open tasks; who is at work above them.
    on("ui.render", { component: "Pane", requestId: pane }, async ($, e) => {
        const ui = $.ui.resolve(e);
        const { Box, Text, Button, Markdown } = ui;
        const say = words[language];
        const colleagues = await read($, team);
        const list = await read($, runs);
        const talk = await read($, meeting);
        const windows = await read($, budget);
        const panel = await read($, view);
        const stamp = await read($, gallery);
        const latest = await read($, board);
        const at = Math.max(await read($, now), latest.checkedAt, ...list.map(run => run.startedAt), 0);
        const byId = new Map(colleagues.map(colleague => [colleague.id, colleague]));
        const running = list.filter(run => run.status === "running").reverse();
        const finished = list.filter(run => run.status !== "running").reverse();
        const busy = new Set(running.map(run => run.colleague));
        const idle = colleagues.filter(colleague => !busy.has(colleague.id));
        const selected = panel.selected ? byId.get(panel.selected) : undefined;
        // The meeting itself is in the main chat and above the prompt: here only a ring says who is in it.
        const presence = (colleague: Colleague) => (talk.last === colleague.id ? say.speaking : talk.members.includes(colleague.id) ? say.inMeeting : "");
        const face = (colleague: Colleague, size: number, isRinged = false, isWorking = false) => faceOf(ui, e.surface, colleague, size, stamp, isRinged, isWorking);
        const open = (colleague: Colleague) => async () => {
            await update($, view, current => ({ ...current, selected: colleague.id }));
            await readCard($, colleague.id);
        };
        const name = (colleague: Colleague) => <Button key={`open-${colleague.id}`} label={colleague.fullName} plain onPress={open(colleague)} />;
        const heading = (colleague: Colleague) => (
            <Box key={`name-${colleague.id}`} flexDirection="row" flexWrap="wrap" columnGap={1} alignItems="center">
                {name(colleague)}
                <Text color={colleague.color}>{colleague.role}</Text>
            </Box>
        );

        if (!colleagues.length) {
            return <Text dimColor>{say.empty}</Text>;
        }

        if (selected) {
            const details = (await read($, card))?.id === selected.id ? await read($, card) : null;
            return (
                <Box flexDirection="column" gap={1}>
                    <Button key="back" label={`← ${say.team}`} plain onPress={() => update($, view, current => ({ ...current, selected: undefined }))} />
                    <Box key="who" flexDirection="row" flexWrap="nowrap" gap={2} alignItems="center">
                        {face(selected, 72, Boolean(presence(selected)))}
                        <Box flexDirection="column" flexShrink={1}>
                            <Text bold color={selected.color}>{selected.fullName}</Text>
                            <Text>{selected.role}</Text>
                            <Text dimColor>{[presence(selected), say.toDo(selected.openTasks), selected.model ? modelName(selected.model) : "", selected.effort ?? ""].filter(Boolean).join(" · ")}</Text>
                        </Box>
                    </Box>
                    {details?.description ? <Text key="description" dimColor>{details.description}</Text> : null}
                    <Text key="h-tasks" bold>{say.tasks}</Text>
                    {details ? <Markdown key="tasks" text={details.openTasks.length ? details.openTasks.map(task => `- ${task}`).join("\n") : `*${say.toDo(0)}*`} /> : null}
                    {details?.memory ? <Text key="h-memory" bold>{say.memory}</Text> : null}
                    {details?.memory ? <Markdown key="memory" text={clip(details.memory, 1600)} dimColor /> : null}
                    <Button key="talk" label={`${say.talk} ${selected.name}`} onPress={() => void $.prompt.fill({ text: say.talkPrompt(selected.name), mode: "replace" })} />
                </Box>
            );
        }

        const runRow = (run: Run) => {
            const colleague = byId.get(run.colleague);

            if (!colleague) {
                return null;
            }

            const progress = progressOf(run);
            const steps = run.stepTotal ? `${run.stepDone ?? 0}/${run.stepTotal}${run.stepNote ? ` · ${run.stepNote}` : ""}` : "";
            const stats = `ctx ${Math.round(contextShare(run) * 100)}% · ${formatTokens(run.tokens)} · ${formatTime((run.endedAt ?? at) - run.startedAt)}`;
            const mark = run.status === "running" ? "●" : run.status === "done" ? "✓" : "✗";
            return (
                <Box key={run.agentId} flexDirection="row" flexWrap="nowrap" gap={1} alignItems="center">
                    {face(colleague, 44, true, run.status === "running")}
                    <Box flexDirection="column" flexGrow={1} flexShrink={1}>
                        {heading(colleague)}
                        <Text dimColor wrap="truncate-end">{[run.task, `${modelName(run.model)}${run.effort ? ` · ${run.effort}` : ""}`, run.status === "failed" ? say.failed : ""].filter(Boolean).join(" · ")}</Text>
                        <Box flexDirection="row" flexWrap="wrap" columnGap={1} alignItems="center">
                            {bar(ui, e.surface, progress ?? contextShare(run), progress === undefined ? undefined : colleague.color)}
                            {steps ? <Text>{steps}</Text> : null}
                            <Text dimColor>{stats}</Text>
                        </Box>
                    </Box>
                    <Text color={run.status === "failed" ? "#D0453F" : run.status === "done" ? "#3B9C5F" : colleague.color}>{mark}</Text>
                </Box>
            );
        };
        const idleRow = (colleague: Colleague) => (
            <Box key={`idle-${colleague.id}`} flexDirection="row" flexWrap="nowrap" gap={1} alignItems="center">
                {face(colleague, 40, Boolean(presence(colleague)))}
                <Box flexDirection="column" flexGrow={1} flexShrink={1}>
                    {heading(colleague)}
                    <Text dimColor wrap="truncate-end">{[presence(colleague), say.toDo(colleague.openTasks), colleague.model ? modelName(colleague.model) : "", colleague.effort ?? ""].filter(Boolean).join(" · ")}</Text>
                </Box>
            </Box>
        );
        const toggleFinished = (
            <Button
                key="finished"
                label={`${panel.isFinishedCollapsed ? "▸" : "▾"} ${say.finished} · ${finished.length}`}
                plain
                onPress={() => update($, view, current => ({ ...current, isFinishedCollapsed: !current.isFinishedCollapsed }))}
            />
        );
        // Only what the engine knows: the plan's windows when it has a reading, the colleagues' work once there is some.
        const tiles = [
            ...windows.filter(window => window.kind === "seven_day" || window.kind === "five_hour").map(window => ({
                label: window.kind === "seven_day" ? say.week : say.hours,
                value: `${Math.round(window.percentUsed)}%`,
                note: window.resetsAt ? `↻ ${formatUntil(window.resetsAt, at)}` : "",
            })),
            ...(list.length ? [{ label: `${say.tokens} · ${say.time}`, value: `${formatTokens(list.reduce((sum, run) => sum + run.tokens, 0))} · ${formatTime(totalTime(list, at))}`, note: "" }] : []),
        ];
        // Under the team: the latest line of each memory, every open task by colleague, and a few phrases to start from.
        const newsRows = latest.news.slice(0, 5).flatMap(item => {
            const colleague = byId.get(item.colleague);
            return colleague
                ? [(
                    <Box key={`news-${colleague.id}`} flexDirection="row" flexWrap="nowrap" gap={1} alignItems="flex-start">
                        {face(colleague, 24)}
                        <Box flexDirection="column" flexGrow={1} flexShrink={1}>
                            <Box flexDirection="row" flexWrap="wrap" columnGap={1} alignItems="center">
                                <Button key={`news-open-${colleague.id}`} label={colleague.name} plain onPress={open(colleague)} />
                                <Text dimColor>{formatAgo(item.at, latest.checkedAt, say)}</Text>
                            </Box>
                            <Text wrap="truncate-end">{item.heading}</Text>
                        </Box>
                    </Box>
                )]
                : [];
        });
        const expanded = panel.expanded ?? [];
        const taskGroups = latest.tasks.flatMap(group => {
            const colleague = byId.get(group.colleague);
            const isOpen = colleague ? expanded.includes(colleague.id) : false;
            return colleague
                ? [(
                    <Box key={`tasks-${colleague.id}`} flexDirection="column">
                        <Button
                            key={`toggle-${colleague.id}`}
                            label={`${isOpen ? "▾" : "▸"} ${colleague.name} · ${group.lines.length}`}
                            plain
                            onPress={() => update($, view, current => ({ ...current, expanded: isOpen ? (current.expanded ?? []).filter(id => id !== colleague.id) : [...(current.expanded ?? []), colleague.id] }))}
                        />
                        {isOpen ? <Markdown key={`list-${colleague.id}`} text={group.lines.map(line => `- ${clip(line, 240)}`).join("\n")} /> : null}
                    </Box>
                )]
                : [];
        });
        const openCount = latest.tasks.reduce((sum, group) => sum + group.lines.length, 0);
        const actions = (
            <Box key="actions" flexDirection="row" flexWrap="wrap" gap={1}>
                <Button key="act-round" label={say.startRound} onPress={() => void $.prompt.fill({ text: say.roundPrompt, mode: "replace" })} />
                <Button key="act-meeting" label={say.meetAll} onPress={() => void $.prompt.fill({ text: say.talkPrompt(listNames(colleagues.map(colleague => colleague.name), say.and)), mode: "replace" })} />
                <Button key="act-hire" label={say.hire} onPress={() => void $.prompt.fill({ text: say.hirePrompt, mode: "replace" })} />
            </Box>
        );
        return (
            <Box flexDirection="column" gap={1}>
                {tiles.length
                    ? (
                        <Box key="tiles" flexDirection="row" flexWrap="wrap" columnGap={3}>
                            {tiles.map(tile => (
                                <Box key={`tile-${tile.label}`} flexDirection="column">
                                    <Text dimColor>{tile.label}</Text>
                                    <Text bold>{tile.value}{tile.note ? <Text dimColor> {tile.note}</Text> : null}</Text>
                                </Box>
                            ))}
                        </Box>
                    )
                    : null}
                {running.length ? <Text key="h-working" dimColor>{say.working} · {running.length}</Text> : null}
                {running.map(runRow)}
                {finished.length ? toggleFinished : null}
                {panel.isFinishedCollapsed ? null : finished.map(runRow)}
                <Text key="h-team" dimColor>{say.team} · {idle.length}</Text>
                {idle.map(idleRow)}
                {newsRows.length ? <Text key="h-news" dimColor>{say.news}</Text> : null}
                {newsRows}
                {taskGroups.length ? <Text key="h-tasks" dimColor>{say.openTasks} · {openCount}</Text> : null}
                {taskGroups}
                {actions}
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
        const say = words[language];
        const stamp = await read($, gallery);
        const last = talk.last ? byId.get(talk.last) : undefined;
        return (
            <Box flexDirection="column">
                <Box key="who" flexDirection="row" flexWrap="wrap" columnGap={1} alignItems="center">
                    <Text bold>{say.meeting}</Text>
                    {members.map(member => faceOf(ui, e.surface, member, 26, stamp, member === last))}
                    <Text key="members">{members.map((member, index) => <Text key={`member-${member.id}`} color={member.color} bold={member === last}>{index ? `, ${member.name}` : member.name}</Text>)}</Text>
                    {last ? <Text key="speaking" dimColor>· {say.speaking}: {last.name}</Text> : null}
                </Box>
                {meetingControls($, ui, members, colleagues)}
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
        const stamp = await read($, gallery);
        return (
            <Box flexDirection="column" gap={1}>
                {segments.map((segment, index) => {
                    const speaker = segment.speaker;

                    if (!speaker) {
                        return <Markdown key={`n${index}`} text={segment.text} dimColor />;
                    }

                    return (
                        <Box key={`s${index}`} flexDirection="column">
                            {segment.isContinued
                                ? null
                                : (
                                    <Box flexDirection="row" flexWrap="nowrap" gap={1} alignItems="center">
                                        {faceOf(ui, e.surface, speaker, 28, stamp)}
                                        <Text bold color={speaker.color}>{speaker.fullName}</Text>
                                        <Text dimColor>{speaker.role}</Text>
                                    </Box>
                                )}
                            <Box paddingLeft={e.surface === "terminal" ? 2 : 4}><Markdown text={segment.text} /></Box>
                        </Box>
                    );
                })}
            </Box>
        );
    });
};

// A colleague's portrait at a fixed size; the terminal draws no pictures, so a dot in their color stands for it there.
function faceOf(ui: Table, surface: string, colleague: Colleague, size: number, stamp: number, isRinged = false, isWorking = false)
{
    const { Text } = ui;

    if (surface === "terminal" || !("Svg" in ui)) {
        return <Text key={`face-${colleague.id}`} color={colleague.color}>{isWorking ? "◉" : isRinged ? "◎" : "●"}</Text>;
    }

    return <ui.Svg key={`face-${colleague.id}-${stamp}`} source={avatarSvg(colleague, portraits.get(colleague.id), size, isRinged, isWorking)} alt={colleague.fullName} width={size} height={size} />;
}

function bar(ui: Table, surface: string, share: number, color: string | undefined)
{
    const { Text } = ui;

    if (surface === "terminal" || !("Svg" in ui)) {
        const filled = Math.round(12 * Math.max(0, Math.min(1, share)));
        return <Text key="bar" color={color} dimColor={!color}>{"█".repeat(filled) + "░".repeat(12 - filled)}</Text>;
    }

    return <ui.Svg key="bar" source={barSvg(share, color, 120)} alt={`${Math.round(share * 100)}%`} width={120} height={6} />;
}

// The meeting's controls: a ✕ to let each one go, a menu to invite the others, a button to close it. Each sends the colleagues
// plugin's command, as the user would type it.
function meetingControls($: EngineInterface, ui: Table, members: Colleague[], colleagues: Colleague[])
{
    const { Box, Button } = ui;
    const others = colleagues.filter(colleague => !members.includes(colleague));
    // The meeting changes at once on screen; the command's state file confirms it at the next turn.
    const send = (command: string, args: string, change: (ids: string[]) => string[]) => async () => {
        await update($, meeting, current => ({ members: change(current.members), last: current.last }));
        await $.command.run({ command, args });
    };
    const labels = language === "it" ? { invite: "Invita…", close: "Chiudi riunione" } : { invite: "Invite…", close: "Close meeting" };
    return (
        <Box key="meeting-controls" flexDirection="row" flexWrap="wrap" gap={1}>
            {members.map(member => <Button key={`leave-${member.id}`} label={`✕ ${member.name}`} plain onPress={send("colleagues:leave", member.name, ids => ids.filter(id => id !== member.id))} />)}
            {others.length && "Select" in ui
                ? (
                    <ui.Select
                        key="invite"
                        label={labels.invite}
                        options={others.map(colleague => ({ value: colleague.id, label: `${colleague.name} · ${colleague.role}` }))}
                        onSelect={value => send("colleagues:invite", others.find(colleague => colleague.id === value)?.name ?? value, ids => [...ids, value])()}
                    />
                )
                : null}
            <Button key="close" label={labels.close} onPress={send("colleagues:end", "", () => [])} />
        </Box>
    );
}

// The team from their files, their news and open tasks, the budget's windows, and who is in the conversation.
async function refresh($: EngineInterface): Promise<void>
{
    const root = await projectRoot($);
    const agents = `${root}/.claude/agents`;
    const loaded: Colleague[] = [];
    const found = new Map<string, string>();
    const news: { colleague: string; heading: string; at: number }[] = [];
    const tasks: { colleague: string; lines: string[] }[] = [];

    for (const entry of (await $.fs.exists(agents)) ? await $.fs.list(agents) : []) {
        const id = entry.name.endsWith(".md") ? entry.name.slice(0, -".md".length) : "";
        const folder = `${root}/.claude/agent-memory/${id}`;

        if (!id || !(await $.fs.exists(`${folder}/todo.md`))) {
            continue;
        }

        const portrait = await readPortrait($, folder);
        const todo = await $.fs.read(`${folder}/todo.md`);
        const lines = openTasks(todo);

        if (portrait) {
            found.set(id, portrait.uri);
        }

        if (await $.fs.exists(`${folder}/MEMORY.md`)) {
            const heading = latestHeading(await $.fs.read(`${folder}/MEMORY.md`));

            if (heading) {
                news.push({ colleague: id, heading, at: (await $.fs.stat(`${folder}/MEMORY.md`)).mtimeMs });
            }
        }

        if (lines.length) {
            tasks.push({ colleague: id, lines });
        }

        loaded.push(colleagueFrom(id, await $.fs.read(`${agents}/${entry.name}`), todo, portrait?.stamp ?? 0));
    }

    const checkedAt = await $.clock.now();
    await update($, board, () => ({
        news: news.sort((first, second) => second.at - first.at || first.colleague.localeCompare(second.colleague)),
        tasks: tasks.sort((first, second) => second.lines.length - first.lines.length || first.colleague.localeCompare(second.colleague)),
        checkedAt,
    }));

    // The drawings read the portraits from the module, which a reload empties: `gallery` tells them to draw again.
    const signature = [...found].map(([id, uri]) => `${id}:${uri.length}`).join("|");
    portraits = found;

    if (signature !== portraitsRead) {
        portraitsRead = signature;
        const at = await $.clock.now();
        await update($, gallery, () => at);
    }

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
    // A session with nowhere to draw (headless) has no pane to open.
    void $.ui.open({ id: pane, title: say().pane }).catch(() => undefined);
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

function clip(text: string, length: number): string
{
    return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}
