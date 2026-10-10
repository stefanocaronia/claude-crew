// The colleagues' panel and their meetings: the team with their portraits, who is at work and the steps they report, a colleague's
// card, and a meeting drawn as a group chat with its controls above the prompt. The meeting itself is the crew plugin's
// commands: the controls send them, and its state file says who is in the conversation.
import { atom, read, update } from "claude-code";
import type { EngineInterface, Register } from "claude-code";

import type { Colleague, Meeting, Run } from "../types";

import { avatarSvg, barSvg, effortSvg, iconSvg, nameSvg, wideBarSvg } from "./draw.ts";
import { isNarration, segmentsOf, speakersOf } from "./meeting.ts";
import { contextShare, progressOf, totalTime } from "./progress.ts";
import { backlogOf, cardFrom, colleagueFrom, colleagueOf, openTasks, withEffort } from "./team.ts";
import { contextWindowOf, formatTime, formatTokens, formatUntil, languageOf, listNames, modelName, words } from "./text.ts";
import type { Language, Words } from "./text.ts";

const pane = "crew";
const stepTool = "mcp__crew-mod__step";
const panelTool = "mcp__crew-mod__panel";
const team = atom({ plugin: "crew-mod", key: "team" } as const, []);
const runs = atom({ plugin: "crew-mod", key: "runs" } as const, []);
const meeting = atom({ plugin: "crew-mod", key: "meeting" } as const, { members: [] });
const budget = atom({ plugin: "crew-mod", key: "budget" } as const, []);
const view = atom({ plugin: "crew-mod", key: "view" } as const, { isFinishedCollapsed: false, autoOpened: false });
const card = atom({ plugin: "crew-mod", key: "card" } as const, null);
const gallery = atom({ plugin: "crew-mod", key: "gallery" } as const, 0);
const board = atom({ plugin: "crew-mod", key: "board" } as const, { tasks: [], checkedAt: 0, hasCommands: true });
const now = atom({ plugin: "crew-mod", key: "now" } as const, 0);

// Module scope, set again at every load: the portraits as data URIs (too large for the state, whose `gallery` says when they
// changed), and the panel's language.
let portraits = new Map<string, string>();
// The 32 px portraits of the backlog's rows, light enough for one on every row.
let smallPortraits = new Map<string, string>();
let portraitsRead = "";
let language: Language = "en";
// The desktop drops a drawing that carries too much: a portrait's characters as a data URI, and all of them together.
const portraitLimit = 24_000;
const portraitBudget = 100_000;
const smallLimit = 3_000;
// How long a colleague who finished stays among the finished before the coffee break.
const restAfter = 5 * 60_000;
const backlogPortraitBudget = 40_000;
// Material's outline and hover state layer, in grays that read on light and dark themes.
// The sections' icons, drawn as text (U+FE0E) so they stay monochrome like the buttons' symbols.
const sectionIcons = { meeting: "☰", working: "⚒\uFE0E", finished: "✓", resting: "☕\uFE0E" };
const outline = "#8080803d";
const stateLayer = "#80808014";
// The name 2 px larger than the panel's text (13 px), and larger still in a colleague's own card.
const nameSize = 15;
const cardNameSize = 18;
// The efforts a colleague can work at; "inherit" takes the line out of the profile, and the session's effort holds.
const effortLevels = ["inherit", "low", "medium", "high", "xhigh", "max"] as const;
// The styles the portraits can be drawn again in.
const portraitStyles = ["realistic", "anime", "pixel", "vector"] as const;
type PortraitStyle = typeof portraitStyles[number];
// How many open tasks the backlog shows; its effort column and a colleague's card at its narrowest, in cells.
const backlogSize = 20;
const effortWidth = 4;
const cardWidth = 30;
// A tooltip in Material's inverse colors, which read on both themes.
const tooltipBackground = "#2b2b29";
const tooltipText = "#f4f4f1";
const say = (): Words => words[language];

type Table = ReturnType<EngineInterface["ui"]["resolve"]>;

export const register: Register = (on, options) => {
    // The option alone, at once: after /reload-plugins the session does not start again.
    language = languageOf(options.language);
    on("session.start", async ($, e, next) => {
        const started = await next(e);
        // A new session has no colleague still at work from the one before: what was left running stopped with it.
        if ((await read($, runs)).some(run => run.status === "running")) {
            await update($, runs, list => list.map(run => (run.status === "running" ? { ...run, status: "failed" as const, endedAt: run.steppedAt ?? run.startedAt } : run)));
        }

        language = languageOf(options.language, await settingsLanguage($), await $.env.get("LANG"));
        await $.tool.register({
            name: "step",
            description: "For a colleague in a review round: report your progress to the Crew panel. Right after reading the brief, call it with "
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
        await $.tool.register({
            name: "panel",
            description: "Open the Crew panel beside the chat: the team with portraits, roles and open tasks, who is at work, the meeting. Call it when the user asks to see the colleagues, the team or their panel, in any words.",
            inputSchema: { type: "object", properties: {} },
        });
        await $.command.register({ name: "crew-panel", description: "Show or hide the Crew panel: the team with their cards, who is at work, the steps they report" });
        await safeRefresh($);

        // Five minutes after finishing, a colleague goes back to the coffee break. Checked once a minute, and the panel is redrawn only
        // when someone goes: a redraw loses the click that lands on the drawing it replaces.
        $.clock.every(60_000, () => {
            void (async () => {
                const at = await $.clock.now();
                const isRested = (run: Run) => run.status !== "running" && !run.isBack && (run.endedAt ?? run.startedAt) + restAfter <= at;

                if ((await read($, runs)).some(isRested)) {
                    await update($, runs, list => list.map(run => (isRested(run) ? { ...run, isBack: true } : run)));
                }
            })();
        });

        // The team is there to be seen from the start: the panel opens once, where the surface docks it beside the chat.
        if ((await read($, team)).length) {
            await openOnce($);
        }

        return started;
    });

    on("command.run", { command: "crew-panel" }, async $ => {
        const isOpen = (await $.ui.panes()).some(open => open.id === pane);

        if (isOpen) {
            await $.ui.close({ id: pane });
            return { text: say().closed };
        }

        // The panel opens first: what it could not read, it says inside.
        await $.ui.open({ id: pane, title: say().pane });
        await safeRefresh($);
        return { text: say().opened };
    });

    // Claude opens the panel when the user asks for it in words: a way that does not depend on the surface knowing slash commands.
    on("tool.call", { tool: panelTool }, async $ => {
        await $.ui.open({ id: pane, title: say().pane });
        await safeRefresh($);
        return { result: say().opened };
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
        const colleague = colleagueOf(await read($, team), e.subagentType);
        // One thing at a time: a colleague at work or in the meeting takes no other task.
        const reason = colleague ? await busyReason($, colleague) : undefined;

        if (reason) {
            return { deny: reason };
        }

        const started = await next(e);

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
        // A new task sends whoever had finished back to the coffee break: the panel shows the work now going on.
        await update($, runs, list => [...list.filter(other => other.agentId !== run.agentId).map(other => (other.status !== "running" ? { ...other, isBack: true } : other)), run].slice(-100));
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
        // The time moves with the steps: a timer would redraw the panel every second, and a click on a replaced drawing is lost.
        const at = await $.clock.now();
        await update($, runs, list => list.map(run => (run.agentId !== e.agentId ? run : {
            ...run,
            model: usage.model || e.model,
            effort: typeof e.effort === "string" ? e.effort : run.effort,
            contextTokens: spent,
            contextMax: contextWindowOf(usage.model || e.model),
            tokens: run.tokens + spent,
            steppedAt: at,
        })));
        return result;
    });

    // The main loop has read the prompt, and the crew plugin's hook has run: who is in the conversation now.
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
            await safeRefresh($);
        }

        return next(e);
    });

    // Who spoke last, from the reply as it is stored; a reply with no colleague in it means Claude is back.
    on("session.append", async ($, e, next) => {
        const stored = await next(e);

        if (e.agentId || e.door !== "response" || e.message.role !== "assistant") {
            return stored;
        }

        // A command run in this reply (talk, invite, leave, end) changes the meeting now, not at the next prompt.
        await refreshMeeting($);
        const text = e.message.content.flatMap(block => (block.type === "text" && typeof block.text === "string" ? [block.text] : [])).join("\n\n");

        if (!text.trim()) {
            return stored;
        }

        const speakers = speakersOf(text, await read($, team));

        if (speakers.length) {
            const current = await read($, meeting);
            await setMeeting($, [...new Set([...current.members, ...speakers.map(speaker => speaker.id)])], speakers.at(-1)?.id, current.pending);
        } else if (!isNarration(text) && (await read($, meeting)).last !== undefined) {
            await update($, meeting, current => ({ ...current, last: undefined }));
        }

        return stored;
    });


    // The panel: the team, each with portrait, name (a link to their card), role and open tasks, those at work first; the backlog; the actions.
    on("ui.render", { component: "Pane", requestId: pane }, async ($, e) => {
        const draw = async () => {
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
            // Each colleague in one section: in the meeting; at work while a task runs; finished, with their latest task, until the user
            // sends them back or something new starts; on a coffee break otherwise.
            const running = list.filter(run => run.status === "running").reverse();
            const busy = new Set(running.map(run => run.colleague));
            const meetingMembers = talk.members.flatMap(id => (busy.has(id) ? [] : byId.get(id) ?? []));
            const inMeeting = new Set(meetingMembers.map(colleague => colleague.id));
            const finished = [...new Map(list.filter(run => run.status !== "running" && !run.isBack && !busy.has(run.colleague) && !inMeeting.has(run.colleague)).map(run => [run.colleague, run])).values()].reverse();
            const done = new Set(finished.map(run => run.colleague));
            const idle = colleagues.filter(colleague => !busy.has(colleague.id) && !inMeeting.has(colleague.id) && !done.has(colleague.id));
            const sendBack = (ids: string[]) => update($, runs, all => all.map(run => (ids.includes(run.colleague) && run.status !== "running" ? { ...run, isBack: true } : run)));
            const selected = panel.selected ? byId.get(panel.selected) : undefined;
            // The meeting itself is in the main chat and above the prompt: here only a ring says who is in it.
            const presence = (colleague: Colleague) => (talk.last === colleague.id ? say.speaking : talk.members.includes(colleague.id) ? say.inMeeting : "");
            const face = (colleague: Colleague, size: number, isRinged = false, isWorking = false) => faceOf(ui, e.surface, colleague, size, stamp, isRinged, isWorking);
            const open = (colleague: Colleague) => async () => {
                await update($, view, current => ({ ...current, selected: colleague.id }));
                await readCard($, colleague.id);
            };
            const isDesktop = e.surface !== "terminal" && "Svg" in ui;
            const border = isDesktop ? { borderColor: outline } : { borderDimColor: true };
            // Material's outlined card, with the state layer under the pointer.
            const outlined = (key: string, children: (JSX.Element | null)[]) => (
                <Box key={key} flexDirection="column" borderStyle="round" {...border} paddingX={1}>
                    {children}
                </Box>
            );
            // The colleagues picked for a meeting, on their cards; the meeting button starts it with them.
            // Only who is free can be picked: a colleague at work or in the meeting takes no other task.
            const picked = (panel.picked ?? []).filter(id => byId.has(id) && !busy.has(id) && !inMeeting.has(id));
            // A small square box in the text's color: an outline, checked when picked; a background only under the pointer.
            const pick = (colleague: Colleague) => (
                <Button
                    key={`pick-${colleague.id}`}
                    label={picked.includes(colleague.id) ? "☑\uFE0E" : "☐"}
                    plain
                    onPress={() => update($, view, current => ({ ...current, picked: (current.picked ?? []).includes(colleague.id) ? (current.picked ?? []).filter(id => id !== colleague.id) : [...(current.picked ?? []), colleague.id] }))}
                />
            );

            const pickedTeam = picked.flatMap(id => byId.get(id) ?? []);
            const pickedNames = pickedTeam.length ? listNames(pickedTeam.map(colleague => colleague.name), say.and) : "";
            // A review needs its subject, so it is written in the prompt for the user to finish; hiring, firing and new portraits go to
            // Claude at once, who asks in the chat what it needs.
            const ask = (text: string) => {
                void $.prompt.fill({ text, mode: "replace" });
            };
            const send = (text: string) => {
                void $.prompt.submit({ text, asUser: true });
            };
            // A click on a colleague's effort moves it to the next level, round to the session's own.
            const effortButton = (key: string, colleague: Colleague) => {
                const index = effortLevels.indexOf((colleague.effort ?? "inherit") as typeof effortLevels[number]);
                const next = effortLevels[(index + 1) % effortLevels.length] ?? "inherit";
                return <Button key={key} label={colleague.effort ? say.effort(colleague.effort) : say.sessionEffort} plain dimColor onPress={() => setEffort($, colleague.id, next === "inherit" ? undefined : next)} />;
            };
            // New portraits: a click on the style moves to the next one, the button sends the request to Claude.
            const style = (portraitStyles as readonly string[]).includes(panel.style ?? "") ? panel.style as PortraitStyle : portraitStyles[0];
            const portraitButtons = (key: string, label: string, names: string) => [
                <Button key={key} label={`◐ ${label}`} onPress={() => send(say.portraitsPrompt(names, say.styles[style]))} />,
                <Button
                    key={`${key}-style`}
                    label={`${say.styleLabel}: ${say.styles[style]}`}
                    plain
                    dimColor
                    onPress={() => update($, view, current => ({ ...current, style: portraitStyles[(portraitStyles.indexOf(style) + 1) % portraitStyles.length] }))}
                />,
            ];
            // A colleague's name, and at its right what belongs to the whole card: a mark of their work, the box that picks them.
            const nameRow = (key: string, colleague: Colleague, extras: (JSX.Element | null)[]) => (
                <Box key={`row-${key}`} flexDirection="row" flexWrap="nowrap" alignItems="center" columnGap={1} minWidth={0}>
                    <Box flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden">
                        {name(`name-${key}`, colleague)}
                    </Box>
                    {extras}
                </Box>
            );
            // Firing goes to Claude at once, who asks for a yes in the chat before anything.
            const fireButtons = (key: string, members: Colleague[]) => {
                const names = listNames(members.map(member => member.name), say.and);
                return <Button key={key} label={`✕ ${say.fire(names)}`} onPress={() => send(say.firePrompt(names))} />;
            };
            const meet = async (members: Colleague[]) => {
                await update($, view, current => ({ ...current, picked: [] }));
                await $.command.run({ command: "crew:talk", args: members.map(member => member.name).join(" ") });
            };
            // The name opens the colleague's card. A button, not a link: on the desktop most clicks on a Markdown link never reach the panel.
            // The name drawn in the colleague's color, larger than the text around it; on the terminal, bold text.
            const name = (key: string, colleague: Colleague, size = nameSize) => {
                if (!isDesktop) {
                    return <Text key={key} bold color={colleague.color} wrap="truncate-end">{colleague.fullName}</Text>;
                }

                const drawn = nameSvg(colleague.fullName, colleague.color, size);
                return <ui.Svg key={key} source={drawn.source} alt={colleague.fullName} width={drawn.width} height={drawn.height} />;
            };
            // The button that opens a colleague's card.
            const opener = (key: string, colleague: Colleague) => <Button key={key} label="❯" plain onPress={open(colleague)} />;
            const about = (colleague: Colleague) => [talk.last === colleague.id ? say.speaking : "", say.toDo(colleague.openTasks)].filter(Boolean).join(" · ");
            // Each colleague in an outlined card, the portrait at its top left; the cards make a grid that takes a second column when the
            // pane is wide.
            const colleagueCard = (key: string, children: (JSX.Element | null)[]) => (
                <Box key={key} flexDirection="row" flexWrap="nowrap" gap={1} alignItems="flex-start" flexGrow={1} flexShrink={1} width={cardWidth} overflow="hidden" borderStyle="round" {...border} paddingX={1} {...(isDesktop ? { hover: { backgroundColor: stateLayer } } : {})}>
                    {children}
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
                                {name("card-name", selected, cardNameSize)}
                                <Text dimColor>{roleOf(selected)}</Text>
                                <Box flexDirection="row" flexWrap="wrap" alignItems="center">
                                    <Text dimColor>{[presence(selected), say.toDo(selected.openTasks), selected.model ? modelName(selected.model) : ""].filter(Boolean).join(" · ")}</Text>
                                    {effortButton("card-effort", selected)}
                                </Box>
                            </Box>
                        </Box>
                        <Box key="card-actions" flexDirection="row" flexWrap="wrap" gap={1}>
                            <Button key="talk" variant="primary" label={`☰ ${say.talk} ${selected.name}`} onPress={() => meet([selected])} />
                            <Button key="card-round" label={`↻ ${say.roundWith(selected.name)}`} onPress={() => ask(say.roundPromptWith(selected.name))} />
                            {portraitButtons("card-portrait", say.portrait, selected.name)}
                            {fireButtons("card-fire", [selected])}
                        </Box>
                        {details?.description ? <Text key="description" dimColor>{details.description}</Text> : null}
                        {details
                            ? (
                                <Box key="card-tasks" flexDirection="column">
                                    <Text bold>{say.tasks}</Text>
                                    {outlined("card-tasks-list", [<Markdown key="tasks" text={details.openTasks.length ? details.openTasks.map(task => `- ${task}`).join("\n") : `*${say.toDo(0)}*`} />])}
                                </Box>
                            )
                            : null}
                        {details?.memory
                            ? (
                                <Box key="card-memory" flexDirection="column">
                                    <Text bold>{say.memory}</Text>
                                    {outlined("card-memory-text", [<Markdown key="memory" text={clip(details.memory, 1600)} dimColor />])}
                                </Box>
                            )
                            : null}
                    </Box>
                );
            }

            const runRow = (run: Run) => {
                const colleague = byId.get(run.colleague);

                if (!colleague) {
                    return null;
                }

                const progress = progressOf(run);
                const steps = run.stepTotal ? say.step(run.stepDone ?? 0, run.stepTotal, run.stepNote) : "";
                const stats = [say.memoryUsed(Math.round(contextShare(run) * 100)), say.tokens(formatTokens(run.tokens, say.units)), formatTime((run.endedAt ?? run.steppedAt ?? at) - run.startedAt)].join(" · ");
                const mark = run.status === "running" ? "●" : run.status === "done" ? "✓" : "✗";
                const isRunning = run.status === "running";
                return colleagueCard(run.agentId, [
                    face(colleague, 40, true, isRunning),
                    <Box key={`lines-${run.agentId}`} flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden">
                        {nameRow(isRunning ? `open-${colleague.id}` : `open-run-${run.agentId}`, colleague, [
                            isRunning
                                ? <Text key={`mark-${run.agentId}`} color={colleague.color}>{mark}</Text>
                                : <Button key={`back-${run.agentId}`} label={mark} plain onPress={() => sendBack([colleague.id])} />,
                            opener(isRunning ? `open-${colleague.id}` : `open-run-${run.agentId}`, colleague),
                        ])}
                        <Text key={`role-${run.agentId}`} dimColor wrap="truncate-end">{roleOf(colleague)}</Text>
                        <Text key={`task-${run.agentId}`} wrap="truncate-end">{[taskOf(run.task, colleague), steps, run.status === "failed" ? say.failed : ""].filter(Boolean).join(" · ")}</Text>
                        <Box key={`model-${run.agentId}`} flexDirection="row" flexWrap="nowrap" alignItems="center" minWidth={0} overflow="hidden">
                            <Box flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden">
                                <Text dimColor wrap="truncate-end">{[modelName(run.model), run.effort ? say.effort(run.effort) : "", stats].filter(Boolean).join(" · ")}</Text>
                            </Box>
                        </Box>
                        <Box key={`progress-${run.agentId}`} marginTop={1}>
                            {wideBar(ui, e.surface, progress ?? contextShare(run), progress === undefined ? undefined : colleague.color)}
                        </Box>
                    </Box>,
                ]);
            };
            const teamRow = (colleague: Colleague, canPick = true) => colleagueCard(`idle-${colleague.id}`, [
                face(colleague, 40, true),
                <Box key={`lines-${colleague.id}`} flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden">
                    {nameRow(`open-${colleague.id}`, colleague, [opener(`open-${colleague.id}`, colleague)])}
                    <Text key={`role-${colleague.id}`} dimColor wrap="truncate-end">{roleOf(colleague)}</Text>
                    <Box key={`about-${colleague.id}`} flexDirection="row" flexWrap="nowrap" alignItems="center" minWidth={0} overflow="hidden">
                        <Box flexShrink={1} minWidth={0} overflow="hidden">
                            <Text dimColor wrap="truncate-end">{`${about(colleague)} · `}</Text>
                        </Box>
                        {effortButton(`effort-${colleague.id}`, colleague)}
                        <Box flexGrow={1} />
                        {canPick ? pick(colleague) : null}
                    </Box>
                </Box>,
            ]);
            // A section that folds: who is at work, who has finished, the rest of the team; each opens and closes by its title.
            const fold = (key: string, icon: string, title: string, items: (JSX.Element | null)[], isClosed: boolean, toggle: (current: typeof panel) => typeof panel, extra: JSX.Element | null = null) => (items.length
                ? (
                    <Box key={key} flexDirection="column" gap={1}>
                        <Box flexDirection="row" flexWrap="wrap" columnGap={2} alignItems="center">
                            <Button key={key === "finished-section" ? "finished" : `${key}-toggle`} label={`${isClosed ? "▸" : "▾"} ${icon} ${title} · ${items.length}`} plain onPress={() => update($, view, toggle)} />
                            {extra}
                        </Box>
                        {isClosed ? null : <Box key={`${key}-grid`} flexDirection="row" flexWrap="wrap" gap={1}>{items}</Box>}
                    </Box>
                )
                : null);
            // Only what the engine knows: the plan's windows when it has a reading, the colleagues' work once there is some.
            const tiles = [
                ...windows.filter(window => window.kind === "seven_day" || window.kind === "five_hour").map(window => ({
                    label: window.kind === "seven_day" ? say.week : say.hours,
                    icon: window.kind === "seven_day" ? "calendar" as const : "clock" as const,
                    value: say.used(Math.round(window.percentUsed)),
                    note: window.resetsAt ? say.resetsIn(formatUntil(window.resetsAt, at, say.units)) : "",
                    share: window.percentUsed / 100,
                })),
                ...(list.length ? [{ label: say.teamWork, value: `${formatTime(totalTime(list, at))} · ${say.tokens(formatTokens(list.reduce((sum, run) => sum + run.tokens, 0), say.units))}`, note: "", icon: "bolt" as const, share: undefined }] : []),
            ];
            // The backlog: a low card for each task, with who holds it, the task on one line cut at the edge (whole in a tooltip) and a
            // meter of the effort it needs.
            const effortCell = (key: string, level: string) => (
                <Box key={key} width={effortWidth} flexShrink={0} justifyContent="flex-end" alignItems="center">
                    {isDesktop && effortSvg(level) ? <ui.Svg source={effortSvg(level) ?? ""} alt={say.effort(level)} width={16} height={12} /> : <Text dimColor>{meterOf(level)}</Text>}
                </Box>
            );
            const backlog = backlogOf(latest.tasks, backlogSize);
            // One portrait a row while they weigh little all together; past that, initials.
            const isBacklogLight = backlog.reduce((sum, task) => sum + (smallPortraits.get(task.colleague)?.length ?? 0), 0) <= backlogPortraitBudget;
            const backlogRows = backlog.map((task, index) => {
                const colleague = byId.get(task.colleague);
                const text = plainText(task.text);
                const effort = colleague ? task.effort ?? colleague.effort ?? "" : "";
                return colleague
                    ? (
                        <Box key={`backlog-${index}`} flexDirection="row" flexWrap="nowrap" gap={1} alignItems="center" borderStyle="round" {...border} paddingX={1} {...(isDesktop ? { hover: { backgroundColor: stateLayer } } : {})}>
                            {faceOf(ui, e.surface, colleague, 24, stamp, false, false, isBacklogLight ? "small" : "initials")}
                            <Box flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden">
                                <Text wrap="truncate-end">{text}</Text>
                            </Box>
                            {effortCell(`backlog-effort-${index}`, effort)}
                            {isDesktop
                                ? (
                                    <Box position="absolute" bottom={1} left={4} right={0} display="none" hover={{ display: "flex" }} backgroundColor={tooltipBackground} borderStyle="round" borderColor={outline} paddingX={1}>
                                        <Text color={tooltipText}>{`${colleague.name}: ${text}${effort ? ` · ${say.effort(effort)}` : ""}`}</Text>
                                    </Box>
                                )
                                : null}
                        </Box>
                    )
                    : null;
            });
            const openCount = latest.tasks.reduce((sum, group) => sum + group.lines.length, 0);
            const heavy = (latest.heavy ?? []).map(id => byId.get(id)?.name ?? id);
            return (
                <Box flexDirection="column" gap={1}>
                    {latest.error ? <Text key="error" dimColor>{say.readError(latest.error)}</Text> : null}
                    {heavy.length ? <Text key="heavy" dimColor>{say.heavyPortraits(listNames(heavy, say.and))}</Text> : null}
                    {latest.hasCommands ? null : <Text key="install" dimColor>{say.installSkill}</Text>}
                    {tiles.length
                        ? (
                            <Box key="tiles" flexDirection="row" flexWrap="wrap" gap={1}>
                                {tiles.map(tile => (
                                    <Box key={`tile-${tile.label}`} flexDirection="column" flexGrow={1} minWidth={0} overflow="hidden" borderStyle="round" {...border} paddingX={1}>
                                        <Box flexDirection="row" columnGap={1} alignItems="center">
                                            {isDesktop ? <ui.Svg source={iconSvg(tile.icon, 16)} alt={tile.label} width={16} height={16} /> : null}
                                            <Text dimColor wrap="truncate-end">{tile.label}</Text>
                                        </Box>
                                        <Text bold wrap="truncate-end">{tile.value}{tile.note ? <Text dimColor>{` · ${tile.note}`}</Text> : null}</Text>
                                        {tile.share === undefined ? null : bar(ui, e.surface, tile.share, tile.share > 0.85 ? "#D0453F" : tile.share > 0.6 ? "#D9932B" : "#3B9C5F")}
                                    </Box>
                                ))}
                            </Box>
                        )
                        : null}
                    {fold("meeting", sectionIcons.meeting, say.inMeetingSection, meetingMembers.map(colleague => teamRow(colleague, false)), Boolean(panel.isMeetingCollapsed), current => ({ ...current, isMeetingCollapsed: !current.isMeetingCollapsed }))}
                    {fold("working", sectionIcons.working, say.working, running.map(runRow), Boolean(panel.isWorkingCollapsed), current => ({ ...current, isWorkingCollapsed: !current.isWorkingCollapsed }))}
                    {fold("finished-section", sectionIcons.finished, say.finished, finished.map(runRow), panel.isFinishedCollapsed, current => ({ ...current, isFinishedCollapsed: !current.isFinishedCollapsed }), <Button key="all-back" label={`↩ ${say.allBack}`} plain dimColor onPress={() => sendBack(finished.map(run => run.colleague))} />)}
                    {fold("team", sectionIcons.resting, say.resting, idle.map(colleague => teamRow(colleague)), Boolean(panel.isTeamCollapsed), current => ({ ...current, isTeamCollapsed: !current.isTeamCollapsed }))}
                    <Box key="actions" flexDirection="row" flexWrap="wrap" gap={1}>
                        <Button key="act-round" variant="primary" label={`↻ ${pickedNames ? say.roundWith(pickedNames) : say.startRound}`} onPress={() => ask(pickedNames ? say.roundPromptWith(pickedNames) : say.roundPrompt)} />
                        <Button key="act-meeting" label={`☰ ${pickedNames ? say.meetWith(pickedNames) : say.meetAll}`} onPress={() => meet(pickedTeam.length ? pickedTeam : colleagues.filter(colleague => !busy.has(colleague.id)))} />
                        {pickedNames ? null : <Button key="act-hire" label={`+ ${say.hire}`} onPress={() => send(say.hirePrompt)} />}
                        {pickedNames ? fireButtons("act-fire", pickedTeam) : null}
                        {portraitButtons("act-portraits", say.portraits, pickedNames)}
                    </Box>
                    {backlogRows.length
                        ? (
                            <Box key="backlog" flexDirection="column" gap={1}>
                                <Box flexDirection="row" justifyContent="space-between" alignItems="center">
                                    <Button key="backlog-toggle" label={`${panel.isBacklogOpen ? "▾" : "▸"} ${say.backlog}`} plain onPress={() => update($, view, current => ({ ...current, isBacklogOpen: !current.isBacklogOpen }))} />
                                    <Text dimColor>{`${Math.min(backlogSize, openCount)}/${openCount}`}</Text>
                                </Box>
                                {panel.isBacklogOpen ? backlogRows : null}
                            </Box>
                        )
                        : null}
                </Box>
            );
        };

        try {
            return await draw();
        } catch (error) {
            const { Text } = $.ui.resolve(e);
            return <Text dimColor>{say().drawError(error instanceof Error ? error.message : String(error))}</Text>;
        }
    });

    // During a meeting, above the prompt: who is in it, who speaks, and the controls.
    on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
        const draw = async () => {
            const talk = await read($, meeting);
            const colleagues = await read($, team);
            const byId = new Map(colleagues.map(colleague => [colleague.id, colleague]));
            const members = talk.members.flatMap(id => byId.get(id) ?? []);

            if (!members.length || e.props.hasSurvey) {
                return next(e);
            }

            const ui = $.ui.resolve(e);
            const stamp = await read($, gallery);
            const last = talk.last ? byId.get(talk.last) : undefined;
            const working = new Set((await read($, runs)).filter(run => run.status === "running").map(run => run.colleague));
            return meetingBand($, ui, e.surface, members, colleagues.filter(colleague => !working.has(colleague.id)), last, stamp);
        };

        try {
            return await draw();
        } catch (error) {
            return next(e);
        }
    });

    // A reply with colleagues speaking, drawn as a group chat: each turn under its speaker's portrait and name.
    on("ui.render", { component: "AssistantMessage" }, async ($, e, next) => {
        const draw = async () => {
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
                                            {faceOf(ui, e.surface, speaker, 32, stamp)}
                                            <Box flexDirection="column" minWidth={0}>
                                                {nameOf(ui, e.surface, speaker, speaker.fullName)}
                                                <Text key="role" dimColor wrap="truncate-end">{roleOf(speaker)}</Text>
                                            </Box>
                                        </Box>
                                    )}
                                <Box paddingLeft={e.surface === "terminal" ? 2 : 4}><Markdown text={segment.text} /></Box>
                            </Box>
                        );
                    })}
                </Box>
            );
        };

        try {
            return await draw();
        } catch (error) {
            return next(e);
        }
    });
};

// A colleague's role as the panel and the chat write it, with a capital.
function roleOf(colleague: Colleague): string
{
    return colleague.role.charAt(0).toLocaleUpperCase() + colleague.role.slice(1);
}

// A colleague's name in their color, a little larger than the text around it; on the terminal, bold text.
function nameOf(ui: Table, surface: string, colleague: Colleague, text: string, size = nameSize)
{
    if (surface === "terminal" || !("Svg" in ui)) {
        return <ui.Text key={`name-${colleague.id}`} bold color={colleague.color} wrap="truncate-end">{text}</ui.Text>;
    }

    const drawn = nameSvg(text, colleague.color, size);
    return <ui.Svg key={`name-${colleague.id}`} source={drawn.source} alt={text} width={drawn.width} height={drawn.height} />;
}

// A colleague's portrait at a fixed size; the terminal draws no pictures, so a dot in their color stands for it there.
function faceOf(ui: Table, surface: string, colleague: Colleague, size: number, stamp: number, isRinged = false, isWorking = false, picture: "main" | "small" | "initials" = "main")
{
    const { Text } = ui;

    if (surface === "terminal" || !("Svg" in ui)) {
        return <Text key={`face-${colleague.id}`} color={colleague.color}>{isWorking ? "◉" : isRinged ? "◎" : "●"}</Text>;
    }

    return <ui.Svg key={`face-${colleague.id}-${stamp}`} source={avatarSvg(colleague, picture === "initials" ? undefined : (picture === "small" ? smallPortraits : portraits).get(colleague.id), size, isRinged, isWorking)} alt={colleague.fullName} width={size} height={size} />;
}

// A progress bar as wide as the card: the markup stretches to the room the surface gives it.
function wideBar(ui: Table, surface: string, share: number, color: string | undefined)
{
    const { Text } = ui;

    if (surface === "terminal" || !("Svg" in ui)) {
        const filled = Math.round(24 * Math.max(0, Math.min(1, share)));
        return <Text key="bar" color={color} dimColor={!color}>{"█".repeat(filled) + "░".repeat(24 - filled)}</Text>;
    }

    return <ui.Svg key="bar" source={wideBarSvg(share, color)} alt={`${Math.round(share * 100)}%`} height={6} />;
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

// The meeting above the prompt, on one line: its title, an outlined chip for each one in it (portrait, name, who speaks, a ✕ to let
// them go), a menu to invite whoever is free, and at the right the button that closes it. Each control sends the crew plugin's
// command, as the user would type it.
function meetingBand($: EngineInterface, ui: Table, surface: string, members: Colleague[], free: Colleague[], last: Colleague | undefined, stamp: number)
{
    const { Box, Text, Button } = ui;
    const say = words[language];
    const isDesktop = surface !== "terminal" && "Svg" in ui;
    const others = free.filter(colleague => !members.includes(colleague));
    // The meeting changes at once on screen, and stays so until the command's state file says the same.
    const send = (command: string, args: string, change: (ids: string[]) => string[]) => async () => {
        const current = await read($, meeting);
        const next = change(current.members);
        await setMeeting($, next, current.last && next.includes(current.last) ? current.last : undefined, { members: next, at: await $.clock.now() });
        await $.command.run({ command, args });
    };
    const chip = (member: Colleague) => (
        <Box key={`chip-${member.id}`} flexDirection="row" flexWrap="nowrap" alignItems="center" columnGap={1} {...(isDesktop ? { borderStyle: "round" as const, borderColor: outline, paddingLeft: 1 } : {})}>
            {faceOf(ui, surface, member, 22, stamp, member === last)}
            {nameOf(ui, surface, member, member.name)}
            {member === last ? <Text key={`speaking-${member.id}`} dimColor>{say.speaking}</Text> : null}
            <Button key={`leave-${member.id}`} label="✕" plain dimColor onPress={send("crew:leave", member.name, ids => ids.filter(id => id !== member.id))} />
        </Box>
    );
    return (
        <Box flexDirection="column" gap={1} {...(isDesktop ? { borderStyle: "round" as const, borderColor: outline, paddingX: 1 } : {})}>
            <Box key="header" flexDirection="row" flexWrap="wrap" alignItems="center" columnGap={2}>
                <Text key="title" bold>{`☰ ${say.meeting}`}</Text>
                <Box key="gap" flexGrow={1} />
                {others.length && "Select" in ui
                ? (
                    <ui.Select
                        key="invite"
                        value="-"
                        options={[{ value: "-", label: `+ ${say.invite}` }, ...others.map(colleague => ({ value: colleague.id, label: `${colleague.name} · ${colleague.role}` }))]}
                        onSelect={value => (value === "-" ? undefined : send("crew:invite", others.find(colleague => colleague.id === value)?.name ?? value, ids => [...ids, value])())}
                    />
                )
                : null}
                <Button key="close" label={`✕ ${say.closeMeeting}`} onPress={send("crew:end", "", () => [])} />
            </Box>
            <Box key="members" flexDirection="row" flexWrap="wrap" alignItems="center" columnGap={2} rowGap={1}>
                {members.map(chip)}
            </Box>
        </Box>
    );
}

// A refresh that never stops the panel: what fails is shown in it, and kept in the temp folder for whoever helps.
async function safeRefresh($: EngineInterface): Promise<void>
{
    try {
        await refresh($);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await update($, board, current => ({ ...current, error: message }));
        await $.fs.write(`${await tempFolder($)}/claude-crew/panel-error.txt`, `${new Date().toISOString()} ${message}
`).catch(() => undefined);
    }
}

// The team from their files, their open tasks, the budget's windows, and who is in the conversation.
async function refresh($: EngineInterface): Promise<void>
{
    const root = await projectRoot($);
    const agents = `${root}/.claude/agents`;
    const loaded: Colleague[] = [];
    const found = new Map<string, string>();
    const small = new Map<string, string>();
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

        // A light portrait (a small SVG) serves the backlog as it is.
        const smallUri = portrait?.small ?? portrait?.uri;

        if (smallUri && smallUri.length <= smallLimit) {
            small.set(id, smallUri);
        }

        if (lines.length) {
            tasks.push({ colleague: id, lines });
        }

        loaded.push(colleagueFrom(id, await $.fs.read(`${agents}/${entry.name}`), todo, portrait?.stamp ?? 0));
    }

    const checkedAt = await $.clock.now();
    const hasCommands = (await $.command.list()).some(info => info.plugin === "crew" || info.name.startsWith("crew:"));
    const sortedTasks = tasks.sort((first, second) => second.lines.length - first.lines.length || first.colleague.localeCompare(second.colleague));
    const previous = await read($, board);

    // Every write redraws the panel, and a click that lands on a drawing already replaced is lost: write only what changed.
    if (previous.hasCommands !== hasCommands || previous.error || JSON.stringify(previous.tasks) !== JSON.stringify(sortedTasks)) {
        await update($, board, current => ({ ...current, hasCommands, tasks: sortedTasks, error: undefined, checkedAt }));
    }

    // The drawings read the portraits from the module, which a reload empties: `gallery` tells them to draw again.
    // Past a weight the desktop drops the whole drawing: the heavy portraits give way to initials, and the panel names them.
    const kept = new Map<string, string>();
    const heavy: string[] = [];
    let weight = 0;

    for (const [id, uri] of found) {
        if (uri.length > portraitLimit || weight + uri.length > portraitBudget) {
            heavy.push(id);
        } else {
            kept.set(id, uri);
            weight += uri.length;
        }
    }

    const signature = [...kept, ...small].map(([id, uri]) => `${id}:${uri.length}`).join("|");
    portraits = kept;
    smallPortraits = small;
    if (JSON.stringify((await read($, board)).heavy ?? []) !== JSON.stringify(heavy)) {
        await update($, board, current => ({ ...current, heavy }));
    }

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

// The portrait as a data URI (avatar.jpg, .webp, .png or .svg) with the file's time, so a new one is drawn again, and the 32 px
// avatar-small.jpg when there is one.
async function readPortrait($: EngineInterface, folder: string): Promise<{ uri: string; stamp: number; small?: string } | undefined>
{
    const smallPath = `${folder}/avatar-small.jpg`;
    const small = (await $.fs.exists(smallPath)) ? `data:image/jpeg;base64,${(await $.fs.read(smallPath, { as: "bytes" })).base64}` : undefined;

    for (const [file, type] of [["avatar.jpg", "image/jpeg"], ["avatar.webp", "image/webp"], ["avatar.png", "image/png"], ["avatar.svg", "image/svg+xml"]] as const) {
        const path = `${folder}/${file}`;

        if (await $.fs.exists(path)) {
            const { base64 } = await $.fs.read(path, { as: "bytes" });
            return { uri: `data:${type};base64,${base64}`, stamp: (await $.fs.stat(path)).mtimeMs, small };
        }
    }

    return undefined;
}

// A colleague's effort written in their profile, so their next task runs at it; the panel reads the team again.
async function setEffort($: EngineInterface, id: string, level: string | undefined): Promise<void>
{
    const path = `${await projectRoot($)}/.claude/agents/${id}.md`;
    await $.fs.write(path, withEffort(await $.fs.read(path), level));
    await safeRefresh($);
    await readCard($, id);
}

async function readCard($: EngineInterface, id: string): Promise<void>
{
    const root = await projectRoot($);
    const text = async (path: string) => ((await $.fs.exists(path)) ? await $.fs.read(path) : "");
    const loaded = cardFrom(id, await text(`${root}/.claude/agents/${id}.md`), await text(`${root}/.claude/agent-memory/${id}/todo.md`), await text(`${root}/.claude/agent-memory/${id}/MEMORY.md`));
    await update($, card, () => loaded);
}

// The effort a task needs as four marks, low to max; a level it does not know, as written.
function meterOf(level: string): string
{
    const filled = ({ low: 1, medium: 2, high: 3, xhigh: 4, max: 4 } as Record<string, number>)[level.toLowerCase()];
    return filled ? "▮".repeat(filled) + "▯".repeat(4 - filled) : level;
}

// What a colleague is doing, without their name in front: "Tommaso: naming" is "Naming" on Tommaso's card.
function taskOf(task: string, colleague: Colleague): string
{
    const names = [colleague.fullName, colleague.name].map(name => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const rest = task.replace(new RegExp(`^\\s*(?:${names.join("|")})\\s*[:\\-–—,]?\\s*`, "i"), "").trim() || task;
    return rest.charAt(0).toLocaleUpperCase() + rest.slice(1);
}

// A task as one plain line: markdown marks and line breaks out.
function plainText(markdown: string): string
{
    return markdown.replace(/[`*_]/g, "").replace(/\s+/g, " ").trim();
}

async function projectRoot($: EngineInterface): Promise<string>
{
    return (await $.session.root()).replace(/\\/g, "/");
}

// Who is in the meeting now. Whoever joins it starts something new, so those who had finished go back to the coffee break.
async function setMeeting($: EngineInterface, members: string[], last?: string, pending?: Meeting["pending"]): Promise<void>
{
    const current = await read($, meeting);

    if (members.some(id => !current.members.includes(id)) && (await read($, runs)).some(run => run.status !== "running" && !run.isBack)) {
        await update($, runs, list => list.map(run => (run.status !== "running" ? { ...run, isBack: true } : run)));
    }

    await update($, meeting, () => ({ members, last, pending }));
}

// Why a colleague cannot take a task now, for Claude: who, busy with what, and how to free them.
async function busyReason($: EngineInterface, colleague: Colleague): Promise<string | undefined>
{
    const working = (await read($, runs)).find(run => run.colleague === colleague.id && run.status === "running");

    if (working) {
        return `${colleague.name} is already at work on "${working.task}", and a colleague takes one task at a time. Wait until it ends (the Crew panel shows it), or ask the user what to do.`;
    }

    await refreshMeeting($);

    if ((await read($, meeting)).members.includes(colleague.id)) {
        return `${colleague.name} is in the meeting with the user and takes no other task: what the user asks during the meeting, ${colleague.name} does there, in the chat. `
            + `To give them this task, ask the user whether to let them leave the meeting (/crew:leave ${colleague.name}) or to close it (/crew:end).`;
    }

    return undefined;
}

// The colleagues plugin's hook keeps who is in the conversation in the system's temp folder, by session.
async function refreshMeeting($: EngineInterface): Promise<void>
{
    const path = `${await tempFolder($)}/claude-crew/${(await $.session.id()).replace(/[^\w-]/g, "_")}.json`;

    let active: string[];

    try {
        active = (await $.fs.exists(path)) ? (JSON.parse(await $.fs.read(path)) as { active?: string[] }).active ?? [] : [];
    } catch {
        // A file being written right now: the next reply reads it again.
        return;
    }

    const current = await read($, meeting);

    // A change made in the band waits for its command: the file still says the old meeting until the command runs. A command that
    // never runs leaves the file in charge again after a minute.
    if (current.pending && !sameMembers(active, current.pending.members) && (await $.clock.now()) - current.pending.at < 60_000) {
        return;
    }

    if (current.pending || !sameMembers(active, current.members)) {
        await setMeeting($, active, current.last && active.includes(current.last) ? current.last : undefined);
    }
}

function sameMembers(one: string[], other: string[]): boolean
{
    return one.length === other.length && one.every(id => other.includes(id));
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
