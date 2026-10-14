// The colleagues' panel and their meetings: the team with their portraits, who is at work and the steps they report, a colleague's
// card, and a meeting drawn as a group chat with its controls above the prompt. The meeting itself is the crew plugin's
// commands: the controls send them, and its state file says who is in the conversation.
import { atom, read, update } from "claude-code";
import type { EngineInterface, Register } from "claude-code";

import type { Activity, Colleague, Meeting, Permissions, Preferences, Run, Speaker, WeeklyCounts } from "../types";

import { avatarSvg, barEndSvg, barSvg, blankSvg, checkboxSvg, pickedTint, captionSvg, claudeSvg, effortSvg, iconSvg, nameSvg, thumbnailSvg, wideBarSvg } from "./draw.ts";
import { claudeId, segmentsOf, speakersOf } from "./meeting.ts";
import { imagePathsIn, imageTypeOf, isInside, isOwnMemory, resolvedPath } from "./paths.ts";
import { contextShare, progressOf, totalTime, withCount } from "./progress.ts";
import { agentSpecFrom, backlogOf, cardFrom, colleagueFrom, colleagueOf, openTasks, retestsOf, withEffort, withPermissions } from "./team.ts";
import { contextWindowOf, dateOf, formatTime, formatTokens, formatUntil, isoWeek, languageNames, languageOf, listNames, modelName, slugOf, words } from "./text.ts";
import type { Language, Words } from "./text.ts";

const pane = "crew";
// Claude's name and face in a meeting's chat.
const claudeOrange = "#D97757";
const stepTool = "mcp__crew__step";
// How often a panel shares who works in its chat, and reads who works in the others: who starts, stops or changes step shows at once;
// what they are doing and their tokens, which change at every tool, redraw only as often as a colleague's own steps.
const shareEvery = 5_000;
let sharedDrawnAt = 0;
const panelTool = "mcp__crew__panel";
const team = atom({ plugin: "crew", key: "team" } as const, []);
const speakers = atom({ plugin: "crew", key: "speakers" } as const, []);
const runs = atom({ plugin: "crew", key: "runs" } as const, []);
const elsewhere = atom({ plugin: "crew", key: "elsewhere" } as const, []);
const meeting = atom({ plugin: "crew", key: "meeting" } as const, { members: [] });
const budget = atom({ plugin: "crew", key: "budget" } as const, []);
const view = atom({ plugin: "crew", key: "view" } as const, { isFinishedCollapsed: false, autoOpened: false });
const card = atom({ plugin: "crew", key: "card" } as const, null);
const report = atom({ plugin: "crew", key: "report" } as const, null);
const preferences = atom({ plugin: "crew", key: "preferences" } as const, { language: "auto", autoOpen: true });
const gallery = atom({ plugin: "crew", key: "gallery" } as const, 0);
const board = atom({ plugin: "crew", key: "board" } as const, { tasks: [], checkedAt: 0, hasCommands: true });
const agentsWatched = atom({ plugin: "crew", key: "agentsWatched" } as const, null);

// Module scope, set again at every load: the portraits as data URIs (too large for the state, whose `gallery` says when they
// changed), and the panel's language.
let portraits = new Map<string, string>();
// The 32 px portraits of the backlog's rows, light enough for one on every row.
let smallPortraits = new Map<string, string>();
let portraitsRead = "";
let language: Language = "en";
// The language the options, Claude Code and the system ask for: what "automatic" means in the panel's settings.
let detectedLanguage: Language = "en";
// The files the refresh has read, by path, with the time and size they had: read again only when those change.
const readFiles = new Map<string, { stamp: string; text: string }>();
let temporaryFolder: string | undefined;
// The desktop drops a drawing that carries more than about 110 KB: a portrait's characters as a data URI, and all the pictures of
// one drawing (the panel, a message) together.
const portraitLimit = 24_000;
const drawingBudget = 100_000;
const smallLimit = 3_000;
// How long a colleague who finished stays among the finished before the coffee break.
const restAfter = 5 * 60_000;
// Material's outline and hover state layer, in grays that read on light and dark themes.
// The sections' icons, drawn as text (U+FE0E) so they stay monochrome like the buttons' symbols.
const sectionIcons = { meeting: "☰", working: "⚒\uFE0E", finished: "✓", resting: "☕\uFE0E" };
// The error color, readable on both themes: the firing buttons.
const errorColor = "#D0453F";
const outline = "#8080803d";
const stateLayer = "#80808014";
// The name 2 px larger than the panel's text (13 px), and larger still in a colleague's own card.
const nameSize = 15;
const cardNameSize = 18;
// The portrait beside a colleague's turn in the chat.
const chatFace = 32;
// How often a colleague at work redraws the panel with their latest figures, and what is waiting to be shown, by run.
const stepRedrawEvery = 15_000;
type Steps = { model: string; effort?: string; contextTokens: number; tokens: number; at: number };
const unshown = new Map<string, Steps>();
// What each colleague at work did last, shown with their next steps.
const activities = new Map<string, Activity>();
// The sign in front of what a colleague is doing, by its kind.
const activitySigns: Record<Activity["kind"], string> = { do: "▶", run: "▶", read: "📄", edit: "✎", search: "🔎", web: "🌐", tool: "⚙" };
// The agents at work that are no colleague of the team.
const strangers = new Set<string>();
const shownAt = new Map<string, number>();
// The permissions, in the order the card shows them.
const permissionKinds = ["read", "write", "test", "web"] as const;
// The efforts a colleague can work at; "inherit" takes the line out of the profile, and the session's effort holds.
const effortLevels = ["inherit", "low", "medium", "high", "xhigh", "max"] as const;
// The longest report the panel draws, in characters: what is left of a drawing's 100,000 after the portraits.
const reportLimit = 40_000;
// How many open tasks the backlog shows; its effort column and a colleague's card at its narrowest, in cells.
const backlogSize = 20;
const effortWidth = 4;
const cardWidth = 30;
// A tooltip in Material's inverse colors, which read on both themes.
const tooltipBackground = "#2b2b29";
const tooltipText = "#f4f4f1";
// The colleagues whose task is being started, by id, with the task: two spawns at once both pass the check before either runs.
const starting = new Map<string, string>();
// Two colleagues never change the same file at once: each file a colleague at work has written, by resolved path, holds their run.
const heldFiles = new Map<string, string>();
const writingTools = ["Edit", "Write", "MultiEdit", "NotebookEdit"];
// The week's counts are written one after the other, so two at once both count.
let counting: Promise<void> = Promise.resolve();
const weeksKept = 8;
// The pictures a colleague names in the chat, drawn small under their turn: light enough files only, and few, since the desktop
// drops a drawing that carries too much.
const thumbnailWidth = 320;
const thumbnailHeight = 180;
const thumbnailFileLimit = 60_000;
const thumbnailsPerMessage = 2;
const thumbnails = new Map<string, { mtimeMs: number; uri: string | undefined }>();
// The colleagues whose profile Claude Code did not load, as the panel defines them: their agent type by id, and the profile it was
// defined from. A load of the module defines them again, since an unload takes a plugin's agent types away.
const lateTypes = new Map<string, { type: string; profile: string }>();
const say = (): Words => words[language];

type Table = ReturnType<EngineInterface["ui"]["resolve"]>;

export const register: Register = (on, options) => {
    // The option alone, at once: after /reload-plugins the session does not start again.
    language = languageOf(options.language);
    // A load that reuses the module (a test) reads the files again.
    readFiles.clear();
    lateTypes.clear();
    temporaryFolder = undefined;
    on("session.start", async ($, e, next) => {
        const started = await next(e);
        // When this session last loaded the panel's code, at its start, at /reload-plugins or at a hot reload: what tells a load that took.
        await $.fs.write(`${await tempFolder($)}/claude-crew/loaded-${(await $.session.id()).replace(/[^\w-]/g, "_")}.txt`, `${new Date(await $.clock.now()).toISOString()}\n`).catch(() => undefined);
        // The session starts again at /reload-plugins too, with its colleagues still at work: only a run whose agent the engine no
        // longer has stopped with what went before. Without the list, nobody is taken for stopped.
        const agents = await $.agent.list().catch(() => undefined);
        const alive = new Set((agents ?? []).filter(agent => !["completed", "failed", "killed"].includes(agent.status)).map(agent => agent.id));
        const isLost = (run: Run) => agents !== undefined && run.status === "running" && !alive.has(run.agentId);

        if ((await read($, runs)).some(isLost)) {
            await update($, runs, list => list.map(run => (isLost(run) ? { ...run, status: "failed" as const, endedAt: run.steppedAt ?? run.startedAt } : run)));
        }

        detectedLanguage = languageOf(options.language, await settingsLanguage($), await $.env.get("LANG"), systemLocale());
        const chosen = await storedPreferences($);
        await update($, preferences, () => chosen);
        language = languageChosen(chosen);
        await $.tool.register({
            name: "step",
            description: "For a colleague at work on a round or a task: report your progress to the Crew panel. Right after reading the brief, call it with "
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

        // Claude Code loads the profiles of .claude/agents/ as they are written only when the folder was there at its start: noted once
        // a session, since /reload-plugins starts it again with the folder there.
        if ((await read($, agentsWatched)) === null) {
            const isWatched = await $.fs.exists(`${await projectRoot($)}/.claude/agents`);
            await update($, agentsWatched, () => isWatched);
        }

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

        // Who works in the project's other chats: shared through the temp folder every 15 s, as a session's state is its own.
        $.clock.every(shareEvery, () => {
            void shareWork($).catch(() => undefined);
        });
        void shareWork($).catch(() => undefined);

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
            const activity = activities.get(run.agentId);
            return { ...run, stepTotal: total || undefined, stepDone: total ? Math.min(total, done) : done, stepNote: input.note?.trim() || undefined, ...(activity ? { activity } : {}) };
        }));
        return { result: say().stepDone };
    });

    // A colleague without reading or writing works only in their own memory folder, and never changes a file another colleague at
    // work is changing: the panel refuses the rest. A command of the main loop never brings a colleague at work into a meeting.
    on("tool.call", async ($, e, next) => {
        const args = e as unknown as Record<string, unknown>;
        const command = !e.agentId && typeof args.command === "string" ? args.command : undefined;
        const reason = e.agentId
            ? (await refusalFor($, e.tool, e.agentId, args)) ?? (await lockRefusal($, e.tool, e.agentId, args))
            : command ? await meetingRefusal($, command) : undefined;

        if (reason) {
            return { deny: reason };
        }

        const activity = e.agentId ? activityOf(e.tool, args) : undefined;

        if (e.agentId) {
            await resume($, e.agentId);
        }

        if (e.agentId && activity) {
            activities.set(e.agentId, activity);
        }

        const result = await next(e);

        // The conversation script (talk, invite, leave, end) changes the meeting now, not at the next prompt.
        if (command?.includes("conversation.mjs")) {
            await refreshMeeting($).catch(() => undefined);
        }

        return result;
    });

    // A colleague hired in this session, in a project that had no .claude/agents/ at its start, is the panel's agent type: called by
    // their id, as every colleague is.
    on("tool.call", { tool: "Agent" }, async ($, e, next) => {
        const late = lateTypes.get(String((e as unknown as { subagent_type?: unknown }).subagent_type ?? ""));
        return next(late ? ({ ...e, subagent_type: late.type } as typeof e) : e);
    });

    on("agent.spawn", async ($, e, next) => {
        const colleague = colleagueOf(await read($, team), e.subagentType);

        if (!colleague) {
            return next(e);
        }

        // One thing at a time: a colleague at work, being started or in the meeting takes no other task. The mark is set before any
        // wait, so a second spawn at the same moment finds it.
        const startingTask = starting.get(colleague.id);

        if (startingTask !== undefined) {
            await countWeek($, colleague.id, "refusals");
            return { deny: atWork(colleague, startingTask) };
        }

        starting.set(colleague.id, e.description);

        try {
            const reason = await busyReason($, colleague);

            if (reason) {
                return { deny: reason };
            }

            const started = await next(e);

            if (started.deny === undefined && started.agentId) {
                await recordRun($, colleague, e.description, started.agentId, started.model);
            }

            return started;
        } finally {
            starting.delete(colleague.id);
        }
    });

    // Each model request of a colleague at work: how full their context is, the tokens, the effort.
    on("turn.step", async function* ($, e, next) {
        if (e.agentId) {
            await resume($, e.agentId);
        }

        const result = yield* next(e);
        const usage = result.usage;

        if (!e.agentId || !usage) {
            return result;
        }

        const spent = (usage.input_tokens || 0) + (usage.cache_read_input_tokens || 0) + (usage.cache_creation_input_tokens || 0) + (usage.output_tokens || 0);
        const at = await $.clock.now();
        const kept = unshown.get(e.agentId);
        unshown.set(e.agentId, {
            model: usage.model || e.model,
            effort: typeof e.effort === "string" ? e.effort : kept?.effort,
            contextTokens: spent,
            tokens: (kept?.tokens ?? 0) + spent,
            at,
        });

        // The figures move with the steps, but redraw the panel at most every so often: a click on a replaced drawing is lost.
        if (at - (shownAt.get(e.agentId) ?? 0) >= stepRedrawEvery) {
            await showSteps($, e.agentId);
        }

        return result;
    });

    // The main loop has read the prompt, and the crew plugin's hook has run: who is in the conversation now.
    on("turn.start", async ($, e, next) => {
        const started = await next(e);
        await refreshMeeting($);
        return started;
    });

    on("turn.complete", async ($, e, next) => {
        if (!e.agentId) {
            // The team is read again once the turn has ended, so the reading never delays it.
            const completed = await next(e);
            await safeRefresh($);
            return completed;
        }

        const agentId = e.agentId;
        const at = await $.clock.now();
        const steps = takeSteps(agentId);
        activities.delete(agentId);
        releaseFiles([agentId]);
        const ended = (await read($, runs)).find(other => other.agentId === agentId);
        const file = ended && e.reason === "answer" && e.answer.trim() ? await saveReport($, ended, e.answer, at).catch(() => undefined) : undefined;
        // One write, so the panel is redrawn once: the steps not yet shown, the end, the report's file.
        await update($, runs, list => list.map(run => (run.agentId !== agentId ? run : { ...withSteps(run, steps), status: e.reason === "answer" ? "done" : "failed", endedAt: at, ...(file ? { report: file } : {}) })));

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

        const speaking = speakersOf(text, await read($, speakers));

        if (speaking.length) {
            const current = await read($, meeting);
            await setMeeting($, [...new Set([...current.members, ...speaking.map(speaker => speaker.id)])], current.pending);
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
            // The latest moment the state knows of, for the times drawn: a start, a step, an end, a reading of the files.
            const at = Math.max(latest.checkedAt, ...list.map(run => Math.max(run.startedAt, run.steppedAt ?? 0, run.endedAt ?? 0)), 0);
            const byId = new Map(colleagues.map(colleague => [colleague.id, colleague]));
            // Each colleague in one section: in the meeting; at work while a task runs; finished, with their latest task, until the user
            // sends them back or something new starts; on a coffee break otherwise.
            // At work here, then in the project's other chats.
            const shared = (await read($, elsewhere)).filter(run => !list.some(own => own.agentId === run.agentId));
            const running = [...list.filter(run => run.status === "running").reverse(), ...shared];
            const busy = new Set(running.map(run => run.colleague));
            const meetingMembers = talk.members.flatMap(id => (busy.has(id) ? [] : byId.get(id) ?? []));
            const inMeeting = new Set(meetingMembers.map(colleague => colleague.id));
            const finished = [...new Map(list.filter(run => run.status !== "running" && !run.isBack && !busy.has(run.colleague) && !inMeeting.has(run.colleague)).map(run => [run.colleague, run])).values()].reverse();
            const done = new Set(finished.map(run => run.colleague));
            const idle = colleagues.filter(colleague => !busy.has(colleague.id) && !inMeeting.has(colleague.id) && !done.has(colleague.id));
            const sendBack = (ids: string[]) => update($, runs, all => all.map(run => (ids.includes(run.colleague) && run.status !== "running" ? { ...run, isBack: true } : run)));
            const selected = panel.selected ? byId.get(panel.selected) : undefined;
            // The meeting itself is in the main chat and above the prompt: here only a ring says who is in it.
            const presence = (colleague: Colleague) => (talk.members.includes(colleague.id) ? say.inMeeting : "");
            const face = (colleague: Colleague, size: number, isRinged = false, isWorking = false) => faceOf(ui, e.surface, colleague, size, stamp, isRinged, isWorking);
            const open = (colleague: Colleague) => async () => {
                await update($, view, current => ({ ...current, selected: colleague.id, reading: undefined }));
                await readCard($, colleague.id);
            };
            const isDesktop = e.surface !== "terminal" && "Svg" in ui;
            // A hint under the pointer, for the controls that are only a sign: the desktop shows it on hover, the terminal draws none.
            // Below the control, or above it at the foot of a card, which cuts what overflows it; from the control's left at a card's left.
            const tip = (key: string, hint: string, control: JSX.Element, place: { isAbove?: boolean; isFromLeft?: boolean } = {}) => (isDesktop
                ? (
                    <Box key={`tip-${key}`} flexShrink={0}>
                        {control}
                        <Box position="absolute" {...(place.isAbove ? { bottom: 1 } : { top: 1 })} {...(place.isFromLeft ? { left: 0 } : { right: 0 })} display="none" hover={{ display: "flex" }} backgroundColor={tooltipBackground} borderStyle="round" borderColor={outline} paddingX={1}>
                            <Text color={tooltipText} wrap="truncate-end">{hint}</Text>
                        </Box>
                    </Box>
                )
                : control);
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
            const togglePick = (colleague: Colleague) => update($, view, current => ({ ...current, picked: (current.picked ?? []).includes(colleague.id) ? (current.picked ?? []).filter(id => id !== colleague.id) : [...(current.picked ?? []), colleague.id] }));
            // On the desktop a small bordered button, empty or with a check, the surface's own checkbox look; on the terminal a box glyph.
            const pick = (colleague: Colleague) => {
                const isPicked = picked.includes(colleague.id);
                // On the desktop a square drawn at its size, a clear button laid over it takes the press; the terminal a box glyph.
                const box = isDesktop && "Svg" in ui
                    ? (
                        <Box key={`pick-box-${colleague.id}`} flexShrink={0}>
                            <ui.Svg source={checkboxSvg(isPicked, colleague.color)} alt={say.pickTip} width={14} height={14} />
                            <Box position="absolute" top={0} left={0}>
                                <Button key={`pick-${colleague.id}`} label={"\u2003"} plain onPress={() => togglePick(colleague)} />
                            </Box>
                        </Box>
                    )
                    : <Button key={`pick-${colleague.id}`} label={isPicked ? "☑\uFE0E" : "☐"} plain onPress={() => togglePick(colleague)} />;
                // Above it: the box sits on the card's last row, and the card cuts what overflows it.
                return tip(`pick-${colleague.id}`, say.pickTip, box, { isAbove: true });
            };

            const pickedTeam = picked.flatMap(id => byId.get(id) ?? []);
            const pickedNames = pickedTeam.length ? listNames(pickedTeam.map(colleague => colleague.name), say.and, say.comma) : "";
            // A meeting with everyone takes whoever is free; while a meeting goes on, the band above the prompt invites.
            const free = colleagues.filter(colleague => !busy.has(colleague.id) && !inMeeting.has(colleague.id));
            const canMeet = !talk.members.length && (pickedTeam.length > 0 || free.length > 0);
            const send = (text: string) => {
                void $.prompt.submit({ text, asUser: true });
            };
            // A click on a colleague's effort moves it to the next level, round to the session's own.
            // On the desktop the effort's meter, as on a card at work, its words in a hint; the terminal says the words.
            const effortButton = (key: string, colleague: Colleague) => {
                const words = colleague.effort ? say.effort(colleague.effort) : say.sessionEffort;
                const onPress = () => setEffort($, colleague.id, nextEffort(colleague.effort));
                const meter = effortSvg(colleague.effort ?? "");

                if (!isDesktop || !meter || !("Svg" in ui)) {
                    return <Button key={key} label={words} plain dimColor onPress={onPress} />;
                }

                // A Button holds only text: the meter is drawn, and a clear button of its size laid over it takes the press.
                return tip(key, words, (
                    <Box key={`${key}-meter`} flexShrink={0} alignItems="center">
                        <ui.Svg source={meter} alt={words} width={16} height={12} />
                        <Box position="absolute" top={0} left={0}>
                            <Button key={key} label={"\u2003\u2003"} plain onPress={onPress} />
                        </Box>
                    </Box>
                ));
            };
            // The panel's actions are the crew plugin's commands, which ask in the chat what the request leaves open: what to review, the
            // meeting's topic, the new colleague's field, the portraits' style, a yes before a firing. The picks are used up.
            const runCommand = async (command: string, members: Colleague[]) => {
                await update($, view, current => ({ ...current, picked: [] }));
                await $.command.run({ command, args: members.map(member => member.name).join(" ") });
            };
            const portraitButton = (key: string, label: string, members: Colleague[]) => <Button key={key} label={`◐ ${label}`} onPress={() => runCommand("crew:portraits", members)} />;
            // A colleague's name, and at its right what belongs to the whole card: a mark of their work, the box that picks them.
            const nameRow = (key: string, colleague: Colleague, extras: (JSX.Element | null)[]) => (
                <Box key={`row-${key}`} flexDirection="row" flexWrap="nowrap" alignItems="center" columnGap={1} minWidth={0}>
                    <Box flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden">
                        {name(`name-${key}`, colleague)}
                    </Box>
                    {extras}
                </Box>
            );
            // In the error color: a firing is the one action that takes someone away. The command asks for a yes first.
            const fireButton = (key: string, members: Colleague[]) => (
                <Button key={key} onPress={() => runCommand("crew:fire", members)}><Text color={errorColor}>{`✕ ${say.fire(listNames(members.map(member => member.name), say.and, say.comma))}`}</Text></Button>
            );
            // A talk with one colleague from their card starts at once, with no topic asked.
            const talkWith = (colleague: Colleague) => $.command.run({ command: "crew:talk", args: colleague.name });
            // A quick question asks in the chat what to ask, and the colleague answers it at once, even while at work.
            const askOf = (colleague: Colleague) => $.command.run({ command: "crew:ask", args: colleague.name });
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
            const opener = (key: string, colleague: Colleague, onPress = open(colleague), hint = say.openCard) => tip(key, hint, <Button key={key} label="❯" plain onPress={onPress} />);
            // A pencil beside the opener, only for a colleague who may change the project's files; its meaning in a hint.
            const writeMark = (colleague: Colleague) => {
                if (!colleague.permissions.write) {
                    return null;
                }

                return isDesktop
                    ? tip(`write-${colleague.id}`, capitalized(say.canWrite), <ui.Svg key={`write-${colleague.id}`} source={iconSvg("pencil", 14)} alt={say.canWrite} width={14} height={14} />)
                    : <Text key={`write-${colleague.id}`} dimColor>✎</Text>;
            };
            const about = (colleague: Colleague) => say.toDo(colleague.openTasks);
            // Each colleague in an outlined card, the portrait at its top left; the cards make a grid that takes a second column when the
            // pane is wide.
            // A picked card is tinted in the colleague's color, under the pointer too.
            const colleagueCard = (key: string, children: (JSX.Element | null)[], tint?: string) => (
                <Box key={key} flexDirection="row" flexWrap="nowrap" gap={1} alignItems="flex-start" flexGrow={1} flexShrink={1} width={cardWidth} overflow="hidden" borderStyle="round" {...border} paddingX={1} {...(tint ? { backgroundColor: tint } : {})} {...(isDesktop ? { hover: { backgroundColor: tint ?? stateLayer } } : {})}>
                    {children}
                </Box>
            );
            // What a colleague is on, one thing a line: the task; at work, the step of their plan, its number in their color, and what
            // they are doing now, its sign first; finished, how long it took or that it stopped, and their report.
            const workLines = (key: string, run: Run, colleague: Colleague) => {
                const row = (rowKey: string, children: (JSX.Element | null)[]) => (
                    <Box key={rowKey} flexDirection="row" flexWrap="nowrap" alignItems="center" columnGap={1} minWidth={0} overflow="hidden">
                        {children}
                    </Box>
                );

                if (run.status !== "running") {
                    return [
                        <Text key={`task-${key}`} bold wrap="truncate-end">{taskOf(run.task, colleague)}</Text>,
                        row(`end-${key}`, [
                            <Text key="end" dimColor>{capitalized(run.status === "done" ? say.doneIn(formatTime((run.endedAt ?? at) - run.startedAt)) : say.failed)}</Text>,
                            run.report ? <Button key={`report-${run.agentId}`} label={`${say.report} ❯`} plain dimColor onPress={() => openReport($, colleague.id, run.report ?? "")} /> : null,
                        ]),
                    ];
                }

                return [
                    <Text key={`task-${key}`} bold wrap="truncate-end">{taskOf(run.task, colleague)}</Text>,
                    run.stepTotal
                        ? row(`step-${key}`, [
                            <Box key="count" flexShrink={0}><Text color={colleague.color}>{capitalized(say.step(stepNow(run), run.stepTotal))}</Text></Box>,
                            run.stepNote ? <Box key="note" flexShrink={1} minWidth={0} overflow="hidden"><Text dimColor wrap="truncate-end">{run.stepNote}</Text></Box> : null,
                        ])
                        : null,
                    run.activity ? <Text key={`activity-${key}`} dimColor italic wrap="truncate-end">{activityText(say, run.activity)}</Text> : null,
                ];
            };

            // What a task costs: on the desktop the model and its effort meter at the left, memory, tokens and while at work the time
            // at the right, each behind its sign with its words in a hint; the terminal says them in words.
            const costsOf = (key: string, run: Run) => {
                const isRunning = run.status === "running";
                const memory = say.memoryUsed(Math.round(contextShare(run) * 100));
                const tokens = say.tokens(formatTokens(run.tokens, say.units));
                const elapsed = isRunning ? formatTime((run.steppedAt ?? at) - run.startedAt) : "";

                if (!isDesktop || !("Svg" in ui)) {
                    return <Text key={`stats-${key}`} dimColor wrap="truncate-end">{[modelName(run.model), run.effort ? say.effort(run.effort) : "", memory, tokens, elapsed].filter(Boolean).join(" · ")}</Text>;
                }

                const effortMeter = run.effort ? effortSvg(run.effort) : undefined;
                const figure = (icon: "memory" | "bolt" | "clock", value: string, hint?: string) => {
                    const drawn = (
                        <Box key={`${icon}-${key}`} flexDirection="row" alignItems="center" columnGap={1} flexShrink={0}>
                            <ui.Svg source={iconSvg(icon, 12)} alt={hint ?? value} width={12} height={12} />
                            <Text dimColor>{value}</Text>
                        </Box>
                    );
                    return hint ? tip(`${icon}-${key}`, hint, drawn, { isAbove: true }) : drawn;
                };
                return (
                    <Box key={`stats-${key}`} flexDirection="row" flexWrap="wrap" alignItems="center" justifyContent="space-between" columnGap={2} minWidth={0}>
                        <Box flexDirection="row" alignItems="center" columnGap={1} flexShrink={0}>
                            <Text dimColor>{modelName(run.model)}</Text>
                            {run.effort && effortMeter ? tip(`effort-of-${key}`, say.effort(run.effort), <ui.Svg key="meter" source={effortMeter} alt={say.effort(run.effort)} width={16} height={12} />, { isAbove: true }) : null}
                            {run.effort && !effortMeter ? <Text dimColor>{say.effort(run.effort)}</Text> : null}
                        </Box>
                        <Box flexDirection="row" alignItems="center" columnGap={2} flexShrink={0}>
                            {figure("memory", `${Math.round(contextShare(run) * 100)}%`, memory)}
                            {figure("bolt", formatTokens(run.tokens, say.units), tokens)}
                            {elapsed ? figure("clock", elapsed) : null}
                        </Box>
                    </Box>
                );
            };

            const chosen = await read($, preferences);
            // The panel's settings: a gear beside the team's actions, its name written out in the empty panel.
            const openSettings = () => update($, view, current => ({ ...current, isSettingsOpen: true }));
            const settingsButton = <Button key="open-settings" label={`⚙\uFE0E ${say.panelSettings}`} plain dimColor onPress={openSettings} />;

            if (panel.isSettingsOpen) {
                const codes = Object.keys(languageNames) as Language[];
                const current = codes.includes(chosen.language as Language) ? chosen.language : "auto";
                const order = ["auto", ...codes];
                const labelOf = (value: string) => (value === "auto" ? say.automatic(languageNames[detectedLanguage]) : languageNames[value as Language]);
                const choose = (value: string) => choosePreferences($, now => ({ ...now, language: value }));
                return (
                    <Box flexDirection="column" gap={1}>
                        <Button key="settings-back" label={`← ${say.back}`} plain onPress={() => update($, view, current => ({ ...current, isSettingsOpen: false }))} />
                        <Text key="settings-title" bold>{say.panelSettings}</Text>
                        {outlined("settings-list", [
                            <Box key="language-row" flexDirection="row" flexWrap="wrap" alignItems="center" columnGap={1}>
                                <Text dimColor>{say.language}</Text>
                                {"Select" in ui
                                    ? <ui.Select key="settings-language" value={current} options={order.map(value => ({ value, label: labelOf(value) }))} onSelect={choose} />
                                    : <Button key="settings-language" label={labelOf(current)} plain onPress={() => choose(order[(order.indexOf(current) + 1) % order.length] ?? "auto")} />}
                            </Box>,
                            <Button key="settings-auto-open" label={`${chosen.autoOpen ? "☑\uFE0E" : "☐"} ${say.autoOpen}`} plain onPress={() => choosePreferences($, now => ({ ...now, autoOpen: !now.autoOpen }))} />,
                        ])}
                    </Box>
                );
            }

            if (!colleagues.length) {
                return (
                    <Box flexDirection="column" gap={1} alignItems="flex-start">
                        <Text key="empty" dimColor>{say.empty}</Text>
                        {latest.hasCommands
                            ? <Button key="act-init" label={`+ ${say.setUp}`} onPress={() => $.command.run({ command: "crew:init", args: "" })} />
                            : <Text key="install" dimColor>{say.installSkill}</Text>}
                        {settingsButton}
                    </Box>
                );
            }

            const reading = panel.reading ? byId.get(panel.reading.colleague) : undefined;

            if (panel.reading && reading) {
                const shown = await read($, report);
                const text = shown?.colleague === reading.id && shown.file === panel.reading.file ? shown : null;
                return (
                    <Box flexDirection="column" gap={1}>
                        <Button key="report-back" label={`← ${say.back}`} plain onPress={() => update($, view, current => ({ ...current, reading: undefined }))} />
                        {nameRow(`report-${reading.id}`, reading, [opener(`report-open-${reading.id}`, reading)])}
                        <Text key="report-file" dimColor wrap="truncate-end">{`notes/${panel.reading.file}`}</Text>
                        {text?.text ? <Markdown key="report-text" text={text.text} /> : <Text key="report-missing" dimColor>{say.reportMissing}</Text>}
                        {text?.isCut ? <Text key="report-cut" dimColor>{say.reportCut(panel.reading.file)}</Text> : null}
                    </Box>
                );
            }

            if (selected) {
                const details = (await read($, card))?.id === selected.id ? await read($, card) : null;
                // A run left at work by an event that never came keeps the colleague busy: the user can free them.
                const stuck = list.filter(run => run.colleague === selected.id && run.status === "running").map(run => run.agentId);
                const isBusy = busy.has(selected.id) || talk.members.includes(selected.id);
                const current = running.find(run => run.colleague === selected.id);
                const retests = details ? retestsOf(details.openTasks).length : 0;
                const week = (await weeklyCounts($))[isoWeek(at)]?.[selected.id];
                const markFree = async () => {
                    const freedAt = await $.clock.now();
                    releaseFiles(stuck);
                    await update($, runs, all => all.map(run => (stuck.includes(run.agentId) && run.status === "running" ? { ...run, status: "failed" as const, endedAt: freedAt } : run)));
                };
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
                                </Box>
                                {week ? <Text key="week" dimColor>{say.thisWeek(week.tasks, week.refusals)}</Text> : null}
                                {details?.latestReport ? <Button key="card-report" label={`${say.latestReport(details.latestReport)} ❯`} plain dimColor onPress={() => openReport($, selected.id, details.latestReport ?? "")} /> : null}
                            </Box>
                        </Box>
                        {current
                            ? (
                                <Box key="card-work" flexDirection="column">
                                    <Text bold>{say.working}</Text>
                                    {outlined("card-work-box", [
                                        ...workLines("work", current, selected),
                                        <Box key="work-bar" marginTop={1}>{wideBar(ui, e.surface, progressOf(current) ?? contextShare(current), progressOf(current) === undefined ? undefined : selected.color)}</Box>,
                                        costsOf("work", current),
                                    ])}
                                </Box>
                            )
                            : null}
                        <Box key="card-actions" flexDirection="row" flexWrap="wrap" gap={1}>
                            {isBusy ? null : <Button key="talk" variant="primary" label={`☰ ${say.talk(selected.name)}`} onPress={() => talkWith(selected)} />}
                            <Button key="card-ask" label={`? ${say.ask(selected.name)}`} onPress={() => askOf(selected)} />
                            {isBusy ? null : <Button key="card-round" label={`↻ ${say.roundWith(selected.name)}`} onPress={() => runCommand("crew:review", [selected])} />}
                            {retests ? <Button key="card-retest" label={`↻ ${say.retest(retests)}`} onPress={() => send(say.retestPrompt(selected.name))} /> : null}
                            {stuck.length ? <Button key="card-free" label={say.markFree} plain onPress={markFree} /> : null}
                            {portraitButton("card-portrait", say.portrait, [selected])}
                            {fireButton("card-fire", [selected])}
                        </Box>
                        <Box key="card-settings" flexDirection="column">
                            <Text bold>{say.settings}</Text>
                            {outlined("card-settings-list", [
                                <Box key="effort-row" flexDirection="row" flexWrap="wrap" alignItems="center" columnGap={1}>
                                    <Text dimColor>{say.effortTitle}</Text>
                                    <Button key="card-effort" label={selected.effort ? (say.levels as Record<string, string>)[selected.effort] ?? selected.effort : say.sessionLevel} plain onPress={() => setEffort($, selected.id, nextEffort(selected.effort))} />
                                </Box>,
                                <Box key="permissions-row" flexDirection="row" flexWrap="wrap" alignItems="center" columnGap={1}>
                                    <Text dimColor>{say.permissions}</Text>
                                    {permissionKinds.map(kind => (
                                        <Button
                                            key={`permission-${kind}`}
                                            label={`${selected.permissions[kind] ? "☑\uFE0E" : "☐"} ${say.permissionNames[kind]}`}
                                            plain
                                            onPress={() => setPermissions($, selected.id, toggled(selected.permissions, kind))}
                                        />
                                    ))}
                                </Box>,
                            ])}
                        </Box>
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
                        {details?.profile.length
                            ? (
                                <Box key="card-profile" flexDirection="column">
                                    <Text bold>{say.profile}</Text>
                                    {outlined("card-profile-list", details.profile.map((section, index) => {
                                        const sectionKey = `${selected.id}:${index}`;
                                        const isOpen = (panel.openProfile ?? []).includes(sectionKey);
                                        const toggle = () => update($, view, current => ({ ...current, openProfile: isOpen ? (current.openProfile ?? []).filter(key => key !== sectionKey) : [...(current.openProfile ?? []), sectionKey] }));
                                        return (
                                            <Box key={`profile-${index}`} flexDirection="column">
                                                <Button key={`profile-toggle-${index}`} label={`${isOpen ? "▾" : "▸"} ${section.title || say.profile}`} plain onPress={toggle} />
                                                {isOpen ? <Box key={`profile-text-${index}`} paddingLeft={2} marginBottom={1}><Markdown text={section.text} /></Box> : null}
                                            </Box>
                                        );
                                    }))}
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
                const isRunning = run.status === "running";
                const mark = isRunning ? "●" : run.status === "done" ? "✓" : "✗";
                return colleagueCard(run.agentId, [
                    face(colleague, 40, true, isRunning),
                    <Box key={`lines-${run.agentId}`} flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden">
                        {nameRow(isRunning ? `open-${colleague.id}` : `open-run-${run.agentId}`, colleague, [
                            isRunning
                                ? <Text key={`mark-${run.agentId}`} color={colleague.color}>{mark}</Text>
                                : tip(`back-${run.agentId}`, say.sendBack, <Button key={`back-${run.agentId}`} label={mark} plain onPress={() => sendBack([colleague.id])} />),
                            writeMark(colleague),
                            // Once finished, the opener shows what they answered.
                            isRunning || !run.report ? opener(isRunning ? `open-${colleague.id}` : `open-run-${run.agentId}`, colleague) : opener(`open-run-${run.agentId}`, colleague, () => openReport($, colleague.id, run.report ?? ""), say.readReport),
                        ])}
                        <Text key={`role-${run.agentId}`} dimColor wrap="truncate-end">{run.isElsewhere ? `${roleOf(colleague)} · ${say.elsewhere}` : roleOf(colleague)}</Text>
                        {workLines(run.agentId, run, colleague)}
                        <Box key={`progress-${run.agentId}`} marginTop={1}>
                            {wideBar(ui, e.surface, progress ?? contextShare(run), progress === undefined ? undefined : colleague.color)}
                        </Box>
                        {costsOf(run.agentId, run)}
                    </Box>,
                ]);
            };
            // A free colleague's card, tinted in their color once picked.
            const teamRow = (colleague: Colleague, canPick = true) => colleagueCard(`idle-${colleague.id}`, [
                face(colleague, 40, true),
                <Box key={`lines-${colleague.id}`} flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden">
                    {nameRow(`open-${colleague.id}`, colleague, [writeMark(colleague), effortButton(`effort-${colleague.id}`, colleague), opener(`open-${colleague.id}`, colleague)])}
                    <Text key={`role-${colleague.id}`} dimColor wrap="truncate-end">{roleOf(colleague)}</Text>
                    <Box key={`about-${colleague.id}`} flexDirection="row" flexWrap="nowrap" alignItems="center" columnGap={1} minWidth={0} overflow="hidden">
                        <Box flexShrink={1} minWidth={0} overflow="hidden">
                            <Text dimColor wrap="truncate-end">{about(colleague)}</Text>
                        </Box>
                        <Box flexGrow={1} />
                        {canPick ? pick(colleague) : null}
                    </Box>
                </Box>,
            ], canPick && isDesktop && picked.includes(colleague.id) ? pickedTint(colleague.color) : undefined);
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
            // One weight for the whole panel: the team's portraits first, then one small portrait a row with what is left; past that,
            // initials.
            const portraitWeight = colleagues.reduce((sum, colleague) => sum + (portraits.get(colleague.id)?.length ?? 0), 0);
            const isBacklogLight = backlog.reduce((sum, task) => sum + (smallPortraits.get(task.colleague)?.length ?? 0), 0) <= drawingBudget - portraitWeight;
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
                    {heavy.length ? <Text key="heavy" dimColor>{say.heavyPortraits(listNames(heavy, say.and, say.comma))}</Text> : null}
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
                                        {tile.share === undefined ? null : bar(ui, e.surface, tile.share, tile.share > 0.85 ? errorColor : tile.share > 0.6 ? "#D9932B" : "#3B9C5F")}
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
                        <Button key="act-round" variant="primary" label={`↻ ${pickedNames ? say.roundWith(pickedNames) : say.startRound}`} onPress={() => runCommand("crew:review", pickedTeam)} />
                        {canMeet ? <Button key="act-meeting" label={`☰ ${pickedNames ? say.meetWith(pickedNames) : say.meetAll}`} onPress={() => runCommand("crew:meeting", pickedTeam.length ? pickedTeam : free)} /> : null}
                        {pickedNames ? null : <Button key="act-hire" label={`+ ${say.hire}`} onPress={() => runCommand("crew:hire", [])} />}
                        {pickedNames ? fireButton("act-fire", pickedTeam) : null}
                        {portraitButton("act-portraits", say.portraits, pickedTeam)}
                        {tip("open-settings", say.panelSettings, <Button key="open-settings" label={"⚙︎"} onPress={openSettings} />)}
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
            const working = new Set((await read($, runs)).filter(run => run.status === "running").map(run => run.colleague));
            return meetingBand($, ui, e.surface, members, colleagues.filter(colleague => !working.has(colleague.id)), stamp);
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

            // Claude speaks too, with [Claude], when it answers the user in a meeting.
            const claude = { id: claudeId, name: "Claude", fullName: "Claude", role: words[language].claudeRole, color: claudeOrange };
            // In a meeting, a reply that names nobody is still Claude's, drawn as such.
            const segments = segmentsOf(e.props.text, [...(await read($, speakers)), claude], (await read($, meeting)).members.length > 0);

            if (!segments) {
                return next(e);
            }

            const ui = $.ui.resolve(e);
            const { Box, Text, Markdown, Button } = ui;
            // A quick answer (/crew:ask, not a meeting) carries a button that opens a meeting with whoever answered.
            const asked = (await read($, meeting)).members.length ? [] : await recentlyAsked($);
            const answered = [...new Map(segments.flatMap(segment => (segment.speaker && asked.includes(segment.speaker.id) ? [[segment.speaker.id, segment.speaker] as const] : []))).values()];
            const stamp = await read($, gallery);
            // One weight for the whole message: the speakers' portraits first, in order, then the thumbnails with what is left.
            let left = drawingBudget;
            const hasPortrait = segments.map(segment => {
                const weight = segment.speaker && !segment.isContinued ? portraits.get(segment.speaker.id)?.length ?? 0 : 0;
                const fits = weight <= left;
                left -= fits ? weight : 0;
                return fits;
            });
            const pictures = e.surface !== "terminal" && "Svg" in ui ? await picturesOf($, segments.map(segment => (segment.speaker ? segment.text : "")), left) : [];
            return (
                <Box flexDirection="column" gap={1}>
                    {segments.map((segment, index) => {
                        const speaker = segment.speaker;

                        if (!speaker) {
                            return <Markdown key={`n${index}`} text={segment.text} dimColor />;
                        }

                        // The portrait at the left; name, role and message in one column, so they start at the same place.
                        return (
                            <Box key={`s${index}`} flexDirection="row" flexWrap="nowrap" gap={1} alignItems="flex-start">
                                {segment.isContinued ? spacer(ui, e.surface, speaker) : faceOf(ui, e.surface, speaker, chatFace, stamp, false, false, hasPortrait[index] ? "main" : "initials")}
                                <Box flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0}>
                                    {segment.isContinued ? null : nameOf(ui, e.surface, speaker, speaker.fullName)}
                                    {segment.isContinued ? null : caption(ui, e.surface, roleOf(speaker))}
                                    <Markdown text={segment.text} />
                                    {(pictures[index] ?? []).map(picture => (
                                        <Box key={`picture-${picture.path}`} flexDirection="column" marginTop={1}>
                                            {picture.uri && "Svg" in ui ? <ui.Svg source={thumbnailSvg(picture.uri, thumbnailWidth, thumbnailHeight)} alt={picture.path} width={thumbnailWidth} height={thumbnailHeight} /> : null}
                                            <Text dimColor wrap="truncate-end">{picture.path}</Text>
                                        </Box>
                                    ))}
                                </Box>
                            </Box>
                        );
                    })}
                    {answered.length
                        ? (
                            <Box key="ask-meeting-row" flexDirection="row" flexWrap="nowrap" gap={1}>
                                {spacer(ui, e.surface, answered[0] ?? claude)}
                                <Button
                                    key="ask-meeting"
                                    label={`☰ ${say().meetWith(listNames(answered.map(speaker => speaker.name), say().and, say().comma))}`}
                                    onPress={() => $.command.run({ command: "crew:talk", args: answered.map(speaker => speaker.name).join(" ") })}
                                />
                            </Box>
                        )
                        : null}
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

// The role under a name in the chat: small and gray, with a little room before the message; on the terminal, dim text.
function caption(ui: Table, surface: string, text: string)
{
    if (surface === "terminal" || !("Svg" in ui)) {
        return <ui.Text key="role" dimColor wrap="truncate-end">{text}</ui.Text>;
    }

    const drawn = captionSvg(text, 12, 6);
    return <ui.Svg key="role" source={drawn.source} alt={text} width={drawn.width} height={drawn.height} />;
}

// The room of a portrait, for a speaker going on after a narrator line.
function spacer(ui: Table, surface: string, colleague: Speaker)
{
    if (surface === "terminal" || !("Svg" in ui)) {
        return <ui.Text key={`face-${colleague.id}`}> </ui.Text>;
    }

    return <ui.Svg key={`face-${colleague.id}`} source={blankSvg(chatFace, 1)} alt={colleague.name} width={chatFace} height={1} />;
}

// A colleague's role as the panel and the chat write it, with a capital.
function roleOf(colleague: Speaker): string
{
    return colleague.role.charAt(0).toLocaleUpperCase() + colleague.role.slice(1);
}

// A colleague's name in their color, a little larger than the text around it; on the terminal, bold text.
function nameOf(ui: Table, surface: string, colleague: Speaker, text: string, size = nameSize)
{
    if (surface === "terminal" || !("Svg" in ui)) {
        return <ui.Text key={`name-${colleague.id}`} bold color={colleague.color} wrap="truncate-end">{text}</ui.Text>;
    }

    const drawn = nameSvg(text, colleague.color, size);
    return <ui.Svg key={`name-${colleague.id}`} source={drawn.source} alt={text} width={drawn.width} height={drawn.height} />;
}

// A colleague's portrait at a fixed size; the terminal draws no pictures, so a dot in their color stands for it there.
function faceOf(ui: Table, surface: string, colleague: Speaker, size: number, stamp: number, isRinged = false, isWorking = false, picture: "main" | "small" | "initials" = "main")
{
    const { Text } = ui;

    if (surface === "terminal" || !("Svg" in ui)) {
        return <Text key={`face-${colleague.id}`} color={colleague.color}>{isWorking ? "◉" : isRinged ? "◎" : "●"}</Text>;
    }

    if (colleague.id === claudeId) {
        return <ui.Svg key="face-claude" source={claudeSvg(size)} alt="Claude" width={size} height={size} />;
    }

    return <ui.Svg key={`face-${colleague.id}-${stamp}`} source={avatarSvg(colleague, picture === "initials" ? undefined : (picture === "small" ? smallPortraits : portraits).get(colleague.id), size, isRinged, isWorking)} alt={colleague.fullName} width={size} height={size} />;
}

// A progress bar as wide as the card: its square middle stretches to the room the surface gives it, between two rounded ends of
// a fixed size, which stretching would flatten.
function wideBar(ui: Table, surface: string, share: number, color: string | undefined)
{
    const { Box, Text } = ui;

    if (surface === "terminal" || !("Svg" in ui)) {
        const filled = Math.round(24 * Math.max(0, Math.min(1, share)));
        return <Text key="bar" color={color} dimColor={!color}>{"█".repeat(filled) + "░".repeat(24 - filled)}</Text>;
    }

    // The filled part a pill of its share of the width, at least its two ends; the track the rest, a pill whose start the filled part covers.
    const part = Math.max(0, Math.min(1, share));
    const alt = `${Math.round(part * 100)}%`;
    const end = (key: string, side: "start" | "end", isFilled: boolean, isOverTrack = false) => <ui.Svg key={key} source={barEndSvg(side, color, isFilled, isOverTrack)} alt={alt} width={3} height={6} />;
    const middle = (key: string, isFilled: boolean) => (
        <Box key={key} flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden">
            <ui.Svg key={`${key}-drawn`} source={wideBarSvg(color, isFilled)} alt={alt} height={6} />
        </Box>
    );
    return (
        <Box key="bar" flexDirection="row" flexWrap="nowrap" flexGrow={1} minWidth={0}>
            {part > 0
                ? (
                    <Box key="bar-filled" flexDirection="row" flexWrap="nowrap" flexShrink={0} width={part < 1 ? `${Math.max(3, Math.round(part * 100))}%` : "100%"}>
                        {end("bar-filled-start", "start", true)}
                        {middle("bar-filled-middle", true)}
                        {end("bar-filled-end", "end", true, part < 1)}
                    </Box>
                )
                : null}
            {part < 1
                ? (
                    <Box key="bar-track" flexDirection="row" flexWrap="nowrap" flexGrow={1} flexShrink={1} minWidth={0}>
                        {part > 0 ? null : end("bar-track-start", "start", false)}
                        {middle("bar-track-middle", false)}
                        {end("bar-track-end", "end", false)}
                    </Box>
                )
                : null}
        </Box>
    );
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
function meetingBand($: EngineInterface, ui: Table, surface: string, members: Colleague[], free: Colleague[], stamp: number)
{
    const { Box, Text, Button } = ui;
    const say = words[language];
    const isDesktop = surface !== "terminal" && "Svg" in ui;
    const others = free.filter(colleague => !members.includes(colleague));
    // The meeting changes at once on screen, and stays so until the command's state file says the same.
    const send = (command: string, args: string, change: (ids: string[]) => string[]) => async () => {
        const current = await read($, meeting);
        const next = change(current.members);
        await setMeeting($, next, { members: next, at: await $.clock.now() });
        await $.command.run({ command, args });
    };
    const chip = (member: Colleague) => (
        <Box key={`chip-${member.id}`} flexDirection="row" flexWrap="nowrap" alignItems="center" columnGap={1} {...(isDesktop ? { borderStyle: "round" as const, borderColor: outline, paddingLeft: 1 } : {})}>
            {faceOf(ui, surface, member, 22, stamp, true)}
            {nameOf(ui, surface, member, member.name)}
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

// The team from their files, their open tasks, the budget's windows, and who is in the conversation. One listing of each folder
// says which files changed since the last reading: only those are read again.
async function refresh($: EngineInterface): Promise<void>
{
    const root = await projectRoot($);
    const agents = `${root}/.claude/agents`;
    const loaded: Colleague[] = [];
    const found = new Map<string, string>();
    const small = new Map<string, string>();
    const tasks: { colleague: string; lines: string[] }[] = [];
    const profiles = new Map<string, string>();

    for (const [name, profile] of (await $.fs.exists(agents)) ? await filesIn($, agents) : new Map<string, FileStamp>()) {
        const id = name.endsWith(".md") ? name.slice(0, -".md".length) : "";
        const folder = `${root}/.claude/agent-memory/${id}`;
        const files = id ? await filesIn($, folder).catch(() => undefined) : undefined;
        const todoFile = files?.get("todo.md");

        if (!files || !todoFile) {
            continue;
        }

        const portrait = await portraitIn($, folder, files);
        const todo = await cached(`${folder}/todo.md`, todoFile, () => $.fs.read(`${folder}/todo.md`));
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

        const text = await cached(`${agents}/${name}`, profile, () => $.fs.read(`${agents}/${name}`));
        loaded.push(colleagueFrom(id, text, todo, portrait?.stamp ?? 0));
        profiles.set(id, text);
    }

    if ((await read($, agentsWatched)) === false) {
        await defineLate($, root, profiles);
    }

    // The drawings read the portraits from the module, which a reload empties: `gallery` tells them to draw again.
    // Past a weight the desktop drops the whole drawing: the heavy portraits give way to initials, and the panel names them.
    const kept = new Map<string, string>();
    const heavy: string[] = [];
    let weight = 0;

    for (const [id, uri] of found) {
        if (uri.length > portraitLimit || weight + uri.length > drawingBudget) {
            heavy.push(id);
        } else {
            kept.set(id, uri);
            weight += uri.length;
        }
    }

    const hasCommands = (await $.command.list()).some(info => info.plugin === "crew" || info.name.startsWith("crew:"));
    const sortedTasks = tasks.sort((first, second) => second.lines.length - first.lines.length || first.colleague.localeCompare(second.colleague));
    const previous = await read($, board);

    // Every write redraws the panel, and a click that lands on a drawing already replaced is lost: write only what changed.
    if (previous.hasCommands !== hasCommands || previous.error || JSON.stringify(previous.tasks) !== JSON.stringify(sortedTasks) || JSON.stringify(previous.heavy ?? []) !== JSON.stringify(heavy)) {
        const checkedAt = await $.clock.now();
        await update($, board, current => ({ ...current, hasCommands, tasks: sortedTasks, heavy, error: undefined, checkedAt }));
    }

    const signature = [...kept, ...small].map(([id, uri]) => `${id}:${uri.length}`).join("|");
    portraits = kept;
    smallPortraits = small;

    if (signature !== portraitsRead) {
        portraitsRead = signature;
        const at = await $.clock.now();
        await update($, gallery, () => at);
    }

    const sorted = loaded.sort((first, second) => first.name.localeCompare(second.name));

    if (JSON.stringify(sorted) !== JSON.stringify(await read($, team))) {
        await update($, team, () => sorted);
    }

    // Every message in the chat draws its speakers: they are written apart from the team, and only when they changed.
    const voices: Speaker[] = sorted.map(({ id, name, fullName, role, color }) => ({ id, name, fullName, role, color }));

    if (JSON.stringify(voices) !== JSON.stringify(await read($, speakers))) {
        await update($, speakers, () => voices);
    }

    const usage = await $.session.usage();
    const windows = usage.rateLimits.map(window => ({ kind: window.kind, percentUsed: window.percentUsed, resetsAt: window.resetsAt }));

    if (JSON.stringify(windows) !== JSON.stringify(await read($, budget))) {
        await update($, budget, () => windows);
    }

    await refreshMeeting($);
}

type FileStamp = { mtimeMs: number; size: number };

// The files of a folder by name, with their time and size; a link with those of the file it leads to.
async function filesIn($: EngineInterface, folder: string): Promise<Map<string, FileStamp>>
{
    const files = new Map<string, FileStamp>();

    for (const entry of await $.fs.list(folder)) {
        const file = entry.isLink ? await $.fs.stat(`${folder}/${entry.name}`).catch(() => undefined) : entry;

        if (file?.kind === "file") {
            files.set(entry.name, { mtimeMs: file.mtimeMs, size: file.size });
        }
    }

    return files;
}

// A file's text, or what `load` makes of it, read again only when its time or size changed.
async function cached(path: string, file: FileStamp, load: () => Promise<string>): Promise<string>
{
    const stamp = `${file.mtimeMs}:${file.size}`;
    const kept = readFiles.get(path);

    if (kept?.stamp === stamp) {
        return kept.text;
    }

    const text = await load();
    readFiles.set(path, { stamp, text });
    return text;
}

// A colleague's files read again at the next refresh: the panel has just written one of them.
function forgetFiles(root: string, id: string): void
{
    for (const path of readFiles.keys()) {
        if (path === `${root}/.claude/agents/${id}.md` || path.startsWith(`${root}/.claude/agent-memory/${id}/`)) {
            readFiles.delete(path);
        }
    }
}

// The portrait as a data URI (avatar.jpg, .webp, .png or .svg) with the file's time, so a new one is drawn again, and the 32 px
// avatar-small.jpg when there is one.
async function portraitIn($: EngineInterface, folder: string, files: Map<string, FileStamp>): Promise<{ uri: string; stamp: number; small?: string } | undefined>
{
    const smallFile = files.get("avatar-small.jpg");
    const small = smallFile ? await cached(`${folder}/avatar-small.jpg`, smallFile, () => dataUri($, `${folder}/avatar-small.jpg`, "image/jpeg")) : undefined;

    for (const [name, type] of [["avatar.jpg", "image/jpeg"], ["avatar.webp", "image/webp"], ["avatar.png", "image/png"], ["avatar.svg", "image/svg+xml"]] as const) {
        const file = files.get(name);

        if (file) {
            return { uri: await cached(`${folder}/${name}`, file, () => dataUri($, `${folder}/${name}`, type)), stamp: file.mtimeMs, small };
        }
    }

    return undefined;
}

// A colleague's permissions written in their profile, so their next task runs with them; the panel reads the team again.
async function setPermissions($: EngineInterface, id: string, permissions: Permissions): Promise<void>
{
    await writeProfile($, id, profile => withPermissions(profile, permissions));
}

// One permission switched. Running commands reads and changes any file, so Testing comes with Read and Write and goes without
// either; changing a file needs reading it, so Write comes with Read and goes without it.
function toggled(permissions: Permissions, kind: keyof Permissions): Permissions
{
    const next = { ...permissions, [kind]: !permissions[kind] };

    if (kind === "test" && next.test) {
        return { ...next, read: true, write: true };
    }

    if (kind === "write") {
        return next.write ? { ...next, read: true } : { ...next, test: false };
    }

    return kind === "read" && !next.read ? { ...next, write: false, test: false } : next;
}

// The next effort a click gives, round to the session's own.
function nextEffort(effort: string | undefined): string | undefined
{
    const index = effortLevels.indexOf((effort ?? "inherit") as typeof effortLevels[number]);
    const next = effortLevels[(index + 1) % effortLevels.length] ?? "inherit";
    return next === "inherit" ? undefined : next;
}

// Why a colleague's tool call is refused: reading or changing the project's files without the permission. Their own memory folder
// is always theirs.
async function refusalFor($: EngineInterface, tool: string, agentId: string, args: Record<string, unknown>): Promise<string | undefined>
{
    const kind = ({ Read: "read", Grep: "read", Glob: "read", Edit: "write", Write: "write", MultiEdit: "write", NotebookEdit: "write" } as Record<string, "read" | "write">)[tool];
    const run = kind ? (await read($, runs)).find(other => other.agentId === agentId) : undefined;
    const colleague = run ? (await read($, team)).find(member => member.id === run.colleague) : undefined;

    if (!kind || !colleague || colleague.permissions[kind]) {
        return undefined;
    }

    const root = await projectRoot($);
    const folder = `.claude/agent-memory/${colleague.id}`;
    // Every path the call names, `..` resolved: a Glob's pattern lies under its path.
    const paths = targetsOf(tool, args).map(target => resolvedPath(target, root));

    if (paths.every(path => path !== undefined && isOwnMemory(path, root, colleague.id))) {
        return undefined;
    }

    await countWeek($, colleague.id, "refusals");
    return kind === "read"
        ? `${colleague.name} reads only their own memory and todo (${folder}/): the user gave them no reading of the project's files. Work from what the brief says, and name what you would need to read.`
        : `${colleague.name} changes only their own memory and todo (${folder}/): the user gave them no writing of the project's files. Propose the change in your answer instead.`;
}

// Why a meeting cannot take someone now: the conversation script's talk or invite names a colleague at work on a task.
async function meetingRefusal($: EngineInterface, command: string): Promise<string | undefined>
{
    const call = /conversation\.mjs["']?\s+(?:talk|invite)\s+([^\n]*)/.exec(command);

    if (!call) {
        return undefined;
    }

    // The names as the script reads them: quotes out, the topic after `--` left aside, split as its namesIn splits them.
    const fold = (word: string) => word.normalize("NFC").toLocaleLowerCase();
    const names = (call[1] ?? "").replace(/["']/g, " ").split(/\s+--(?:\s|$)/)[0] ?? "";
    const words = names.split(/[\s,;:.!?()"«»]+|\s+(?:e|ed|and|&)\s+/u).filter(Boolean).map(fold);
    const working = (await read($, runs)).filter(run => run.status === "running");
    const busy = (await read($, team)).flatMap(colleague => {
        const run = working.find(each => each.colleague === colleague.id);
        return run && (words.includes(fold(colleague.name)) || words.includes(colleague.id)) ? [{ colleague, run }] : [];
    });

    for (const { colleague } of busy) {
        await countWeek($, colleague.id, "refusals");
    }

    return busy.length
        ? `${busy.map(({ colleague, run }) => `${colleague.name} (at work on "${run.task}")`).join(", ")}: a colleague at work on a task joins no meeting until it ends. Ask the user whether to wait, or to meet without them.`
        : undefined;
}

// Why a colleague's change of a file waits: another colleague at work is changing it. Their own memory folder is never held.
async function lockRefusal($: EngineInterface, tool: string, agentId: string, args: Record<string, unknown>): Promise<string | undefined>
{
    const target = writingTools.includes(tool) ? [args.file_path, args.notebook_path].find(value => typeof value === "string" && value) as string | undefined : undefined;
    const list = target ? await read($, runs) : [];
    const writer = list.find(run => run.agentId === agentId && run.status === "running");

    // Most calls change no file: they cost nothing.
    if (!target || !writer) {
        return undefined;
    }

    const root = await projectRoot($);
    const path = resolvedPath(target, root)?.toLowerCase();

    if (!path || isOwnMemory(path, root, writer.colleague)) {
        return undefined;
    }

    const holder = list.find(run => run.agentId === heldFiles.get(path) && run.status === "running");

    if (!holder || holder.agentId === agentId) {
        heldFiles.set(path, agentId);
        return undefined;
    }

    const name = (await read($, team)).find(colleague => colleague.id === holder.colleague)?.name ?? holder.colleague;
    await countWeek($, writer.colleague, "refusals");
    return `${target} is being changed by ${name}, at work on "${holder.task}": wait until their task ends, then go on.`;
}

// The files a run held, let go: its task ended, or the user freed the colleague.
function releaseFiles(agentIds: string[]): void
{
    for (const [path, holder] of heldFiles) {
        if (agentIds.includes(holder)) {
            heldFiles.delete(path);
        }
    }
}

// The paths a reading or writing call names: a Glob's folder and its pattern under it, a Grep's folder, the file of the others.
function targetsOf(tool: string, args: Record<string, unknown>): string[]
{
    const text = (value: unknown) => (typeof value === "string" && value ? value : undefined);

    if (tool === "Glob") {
        const folder = text(args.path) ?? ".";
        const pattern = text(args.pattern) ?? "";
        return [folder, /^([a-z]:)?[\\/]/i.test(pattern) ? pattern : `${folder}/${pattern}`];
    }

    return [(tool === "Grep" ? text(args.path) : text(args.file_path) ?? text(args.notebook_path)) ?? "."];
}

// A colleague's task started: the run the panel shows, and the week's count.
async function recordRun($: EngineInterface, colleague: Colleague, task: string, agentId: string, model: string): Promise<void>
{
    const at = await $.clock.now();
    const run: Run = {
        agentId,
        colleague: colleague.id,
        task,
        model,
        status: "running",
        startedAt: at,
        contextTokens: 0,
        contextMax: contextWindowOf(model),
        tokens: 0,
    };
    // A new task sends whoever had finished back to the coffee break: the panel shows the work now going on.
    await update($, runs, list => [...list.filter(other => other.agentId !== run.agentId).map(other => (other.status !== "running" ? { ...other, isBack: true } : other)), run].slice(-100));
    await countWeek($, colleague.id, "tasks");
    await openForWork($);
}

// A colleague's answer kept in their notes, so the round's report outlives the session: notes/<date>-<task>.md, never over another.
async function saveReport($: EngineInterface, run: Run, answer: string, at: number): Promise<string | undefined>
{
    const colleague = (await read($, team)).find(member => member.id === run.colleague);

    if (!colleague) {
        return undefined;
    }

    const task = taskOf(run.task, colleague);
    const date = dateOf(at);
    const folder = `${await projectRoot($)}/.claude/agent-memory/${colleague.id}/notes`;
    const base = `${date}-${slugOf(task)}`;
    let file = `${base}.md`;

    for (let copy = 2; await $.fs.exists(`${folder}/${file}`); copy++) {
        file = `${base}-${copy}.md`;
    }

    await $.fs.write(`${folder}/${file}`, `# ${task} (${date})\n\n${answer.trim()}\n`);

    if ((await read($, card))?.id === colleague.id) {
        await readCard($, colleague.id);
    }

    return file;
}

// A report of a colleague's notes shown in the panel, over the team or the card until the user goes back. A drawing carries at most
// 100,000 characters: a long report is cut, the rest left to the file.
async function openReport($: EngineInterface, colleague: string, file: string): Promise<void>
{
    const path = `${await projectRoot($)}/.claude/agent-memory/${colleague}/notes/${file}`;
    const text = (await $.fs.exists(path)) ? await $.fs.read(path) : "";
    const isCut = text.length > reportLimit;
    await update($, report, () => ({ colleague, file, text: isCut ? text.slice(0, reportLimit) : text, ...(isCut ? { isCut } : {}) }));
    await update($, view, current => ({ ...current, reading: { colleague, file } }));
}

// The counts of the weeks kept, from the plugin's store; nothing when it cannot be read.
async function weeklyCounts($: EngineInterface): Promise<WeeklyCounts>
{
    try {
        const stored = await $.store.get("weekly");
        return stored && typeof stored === "object" ? stored as WeeklyCounts : {};
    } catch {
        return {};
    }
}

// One more task or refusal for a colleague this week, kept across sessions; only the last weeks stay.
async function countWeek($: EngineInterface, id: string, kind: "tasks" | "refusals"): Promise<void>
{
    counting = counting.then(async () => {
        await $.store.set("weekly", withCount(await weeklyCounts($), isoWeek(await $.clock.now()), id, kind, weeksKept));
    }).catch(() => undefined);
    await counting;
}

// The pictures each colleague's turn names, under the project's root: a thumbnail for the light ones, while the message can carry
// them within `budget` characters; the path alone for the rest.
async function picturesOf($: EngineInterface, texts: string[], budget: number): Promise<{ path: string; uri?: string }[][]>
{
    const root = await projectRoot($);
    let count = 0;
    let weight = 0;
    const pictures: { path: string; uri?: string }[][] = [];

    for (const text of texts) {
        const found: { path: string; uri?: string }[] = [];

        for (const path of imagePathsIn(text)) {
            const resolved = resolvedPath(path, root);
            const thumbnail = resolved && isInside(resolved, root) ? await thumbnailOf($, resolved) : undefined;

            if (!thumbnail) {
                continue;
            }

            const fits = thumbnail.uri !== undefined && count < thumbnailsPerMessage && weight + thumbnail.uri.length <= budget;
            count += fits ? 1 : 0;
            weight += fits ? thumbnail.uri?.length ?? 0 : 0;
            found.push({ path, uri: fits ? thumbnail.uri : undefined });
        }

        pictures.push(found);
    }

    return pictures;
}

// A picture file as a data URI when it is light enough, read again only when it changes; undefined when there is no such file.
async function thumbnailOf($: EngineInterface, path: string): Promise<{ uri: string | undefined } | undefined>
{
    const stat = await $.fs.stat(path).catch(() => undefined);

    if (!stat || stat.kind !== "file") {
        return undefined;
    }

    const kept = thumbnails.get(path);

    if (kept?.mtimeMs === stat.mtimeMs) {
        return kept;
    }

    const uri = stat.size <= thumbnailFileLimit ? await dataUri($, path, imageTypeOf(path)) : undefined;
    thumbnails.set(path, { mtimeMs: stat.mtimeMs, uri });
    return { uri };
}

// A file as a data URI of the given media type.
async function dataUri($: EngineInterface, path: string, type: string): Promise<string>
{
    return `data:${type};base64,${(await $.fs.read(path, { as: "bytes" })).base64}`;
}

// The steps of a run not yet on screen, shown now.
async function showSteps($: EngineInterface, agentId: string): Promise<void>
{
    const steps = takeSteps(agentId);
    const activity = activities.get(agentId);

    if (steps || activity) {
        await update($, runs, list => list.map(run => (run.agentId !== agentId ? run : { ...withSteps(run, steps), ...(activity ? { activity } : {}) })));
    }
}

// A colleague who had finished and is resumed by a message (SendMessage) is at work again, on the same run: the panel shows them so,
// and gives them no other task meanwhile.
async function resume($: EngineInterface, agentId: string): Promise<void>
{
    if (strangers.has(agentId)) {
        return;
    }

    const run = (await read($, runs)).find(other => other.agentId === agentId);

    if (run?.status === "running") {
        return;
    }

    const at = await $.clock.now();

    if (!run) {
        await adopt($, agentId, at);
        return;
    }

    await update($, runs, list => list.map(other => (other.agentId !== agentId
        ? other
        : { ...other, status: "running" as const, startedAt: at, steppedAt: at, endedAt: undefined, isBack: undefined, stepDone: undefined, stepTotal: undefined, stepNote: undefined, activity: undefined })));
}

// A colleague at work whom the panel never saw start: spawned before it loaded, or in a session whose runs a reload or the old
// panel plugin kept elsewhere. The session's agents say who they are; an agent of no colleague is never looked up again.
async function adopt($: EngineInterface, agentId: string, at: number): Promise<void>
{
    const agent = (await $.agent.list().catch(() => [])).find(other => other.id === agentId);
    const colleague = agent ? colleagueOf(await read($, team), agent.type) : undefined;

    if (!agent || !colleague) {
        strangers.add(agentId);
        return;
    }

    const run: Run = { agentId, colleague: colleague.id, task: agent.description, model: "", status: "running", startedAt: at, steppedAt: at, contextTokens: 0, contextMax: contextWindowOf(""), tokens: 0 };
    await update($, runs, list => [...list, run].slice(-100));
}

// What a colleague is doing, from the tool they call: the description of their command, or the kind of action and its object.
function activityOf(tool: string, args: Record<string, unknown>): Activity | undefined
{
    const text = (key: string) => (typeof args[key] === "string" ? args[key] as string : "");
    const file = (key: string) => text(key).replace(/\\/g, "/").split("/").pop() ?? "";
    const short = (value: string) => clip(value.replace(/\s+/g, " ").trim(), 60);

    if (tool === stepTool) {
        return undefined;
    }

    // A command says what it does in its description; without one, its program alone.
    const command = (): Activity => (text("description") ? { kind: "do", what: short(text("description")) } : { kind: "run", what: text("command").trim().split(/\s+/)[0] ?? "" });
    const actions: Record<string, () => Activity> = {
        Read: () => ({ kind: "read", what: file("file_path") }),
        Edit: () => ({ kind: "edit", what: file("file_path") }),
        Write: () => ({ kind: "edit", what: file("file_path") }),
        NotebookEdit: () => ({ kind: "edit", what: file("notebook_path") }),
        Grep: () => ({ kind: "search", what: `"${short(text("pattern"))}"` }),
        Glob: () => ({ kind: "search", what: short(text("pattern")) }),
        Bash: command,
        PowerShell: command,
        WebSearch: () => ({ kind: "web", what: short(text("query")) }),
        WebFetch: () => ({ kind: "web", what: short(text("url").replace(/^https?:\/\//, "")) }),
    };
    return actions[tool]?.() ?? { kind: "tool", what: tool.replace(/^mcp__[^_]+__/, "") };
}

// What a colleague is doing, in the panel's words: their command's own description as written, a sentence around the rest.
function activityText(say: Words, activity: Activity | string | undefined): string
{
    if (!activity || typeof activity === "string") {
        return activity ?? "";
    }

    return `${activitySigns[activity.kind]} ${activity.kind === "do" ? capitalized(activity.what) : say.doing[activity.kind](activity.what)}`;
}

// The step in progress: the tool counts the steps done and names the next, so "0 of 5" is the first; past the last, the last.
function stepNow(run: Run): number
{
    return Math.min((run.stepDone ?? 0) + 1, run.stepTotal ?? 1);
}

// The steps of a run not yet on screen, taken to be shown.
function takeSteps(agentId: string): Steps | undefined
{
    const steps = unshown.get(agentId);

    if (steps) {
        unshown.delete(agentId);
        shownAt.set(agentId, steps.at);
    }

    return steps;
}

// A run with its steps: their tokens added up, the latest context and model.
function withSteps(run: Run, steps: Steps | undefined): Run
{
    if (!steps) {
        return run;
    }

    return {
        ...run,
        model: steps.model,
        effort: steps.effort ?? run.effort,
        contextTokens: steps.contextTokens,
        contextMax: contextWindowOf(steps.model),
        tokens: run.tokens + steps.tokens,
        steppedAt: steps.at,
    };
}

// A colleague's effort written in their profile, so their next task runs at it; the panel reads the team again.
async function setEffort($: EngineInterface, id: string, level: string | undefined): Promise<void>
{
    await writeProfile($, id, profile => withEffort(profile, level));
}

// A colleague's profile changed by the panel, then read again with the rest of their files.
async function writeProfile($: EngineInterface, id: string, change: (profile: string) => string): Promise<void>
{
    const root = await projectRoot($);
    const path = `${root}/.claude/agents/${id}.md`;
    await $.fs.write(path, change(await $.fs.read(path)));
    forgetFiles(root, id);
    await safeRefresh($);
    await readCard($, id);
}

async function readCard($: EngineInterface, id: string): Promise<void>
{
    const root = await projectRoot($);
    const text = async (path: string) => ((await $.fs.exists(path)) ? await $.fs.read(path) : "");
    const loaded = cardFrom(id, await text(`${root}/.claude/agents/${id}.md`), await text(`${root}/.claude/agent-memory/${id}/todo.md`), await text(`${root}/.claude/agent-memory/${id}/MEMORY.md`));
    // The round reports are named by their date first: the newest is the latest date's last written, a copy (-2) after its first.
    const notes = `${root}/.claude/agent-memory/${id}/notes`;
    const reports = (await $.fs.exists(notes)) ? (await $.fs.list(notes)).filter(entry => entry.kind === "file" && /^\d{4}-\d{2}-\d{2}-.*\.md$/.test(entry.name)) : [];
    const order = (entry: { name: string; mtimeMs: number }) => [entry.name.slice(0, 10), String(entry.mtimeMs).padStart(16, "0"), entry.name.slice(0, -".md".length)].join("|");
    const latestReport = reports.sort((first, second) => (order(first) < order(second) ? -1 : 1)).at(-1)?.name;
    await update($, card, () => (latestReport ? { ...loaded, latestReport } : loaded));
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
    return capitalized(rest);
}

// A line's first letter in capitals: "done in 3 min" opens a line as "Done in 3 min".
function capitalized(text: string): string
{
    return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}

// A task as one plain line: markdown marks and line breaks out.
function plainText(markdown: string): string
{
    return markdown.replace(/[`*_]/g, "").replace(/\s+/g, " ").trim();
}

// This session's colleagues at work, written for the project's other chats; theirs, read back when fresh, for this panel. The panel
// is redrawn only when what the others share changed.
async function shareWork($: EngineInterface): Promise<void>
{
    const folder = `${await tempFolder($)}/claude-crew`;
    const session = (await $.session.id()).replace(/[^\w-]/g, "_");
    const root = await projectRoot($);
    const at = await $.clock.now();
    const mine = (await read($, runs)).filter(run => run.status === "running" && !run.isElsewhere);
    await $.fs.write(`${folder}/work-${session}.json`, JSON.stringify({ root, at, runs: mine }));
    const others: Run[] = [];

    for (const entry of await $.fs.list(folder)) {
        if (entry.kind !== "file" || !/^work-.+\.json$/.test(entry.name) || entry.name === `work-${session}.json`) {
            continue;
        }

        const shared = JSON.parse(await $.fs.read(`${folder}/${entry.name}`).catch(() => "{}")) as { root?: string; at?: number; runs?: Run[] };

        // A chat that no longer writes has closed: what it left is not shown.
        if (shared.root === root && typeof shared.at === "number" && at - shared.at < 60_000) {
            others.push(...(shared.runs ?? []).map(run => ({ ...run, isElsewhere: true })));
        }
    }

    // Every redraw loses the click that lands on the drawing it replaces.
    const shown = await read($, elsewhere);
    const outline = (list: Run[]) => JSON.stringify(list.map(run => [run.agentId, run.task, run.stepDone, run.stepTotal, run.stepNote]));
    const hasMoved = outline(others) !== outline(shown);
    const hasDetail = JSON.stringify(others) !== JSON.stringify(shown) && at - sharedDrawnAt >= stepRedrawEvery;

    if (hasMoved || hasDetail) {
        sharedDrawnAt = at;
        await update($, elsewhere, () => others);
    }
}

// The colleagues asked a quick question in this session a little while ago, as the conversation script keeps them: past that, an
// answer's button would open a meeting nobody asked for.
async function recentlyAsked($: EngineInterface): Promise<string[]>
{
    const path = `${await tempFolder($)}/claude-crew/${(await $.session.id()).replace(/[^\w-]/g, "_")}.asked.json`;

    if (!(await $.fs.exists(path))) {
        return [];
    }

    const at = await $.clock.now();
    const asked = JSON.parse(await $.fs.read(path).catch(() => "{}")) as Record<string, number>;
    return Object.entries(asked).flatMap(([id, when]) => (at - when < 10 * 60 * 1000 ? [id] : []));
}

// The colleagues Claude Code has not loaded, as agent types of the panel's, usable from the next turn: those of a project whose
// .claude/agents/ was missing when the session started. Defined again when their profile changes.
async function defineLate($: EngineInterface, root: string, profiles: Map<string, string>): Promise<void>
{
    for (const [id, profile] of profiles) {
        if (lateTypes.get(id)?.profile === profile) {
            continue;
        }

        const defined = await $.agent.register(agentSpecFrom(id, profile, `${root}/.claude/agent-memory/${id}`)).catch(() => undefined);

        if (defined) {
            lateTypes.set(id, { type: defined.agent, profile });
        }
    }
}

async function projectRoot($: EngineInterface): Promise<string>
{
    return (await $.session.root()).replace(/\\/g, "/");
}

// Who is in the meeting now. Whoever joins it starts something new, so those who had finished go back to the coffee break.
async function setMeeting($: EngineInterface, members: string[], pending?: Meeting["pending"]): Promise<void>
{
    const current = await read($, meeting);

    if (members.some(id => !current.members.includes(id))) {
        await openForWork($);
    }

    if (members.some(id => !current.members.includes(id)) && (await read($, runs)).some(run => run.status !== "running" && !run.isBack)) {
        await update($, runs, list => list.map(run => (run.status !== "running" ? { ...run, isBack: true } : run)));
    }

    await update($, meeting, () => ({ members, pending }));
}

// Why a colleague cannot take a task now, for Claude: who, busy with what, and how to free them.
async function busyReason($: EngineInterface, colleague: Colleague): Promise<string | undefined>
{
    const working = (await read($, runs)).find(run => run.colleague === colleague.id && run.status === "running");

    if (working) {
        await countWeek($, colleague.id, "refusals");
        return atWork(colleague, working.task);
    }

    await refreshMeeting($);

    if ((await read($, meeting)).members.includes(colleague.id)) {
        await countWeek($, colleague.id, "refusals");
        return `${colleague.name} is in the meeting with the user: short acts they do there, in the chat. Long work goes in the background: `
            + `run /crew:leave ${colleague.name} first (the others stay), then give them this task again.`;
    }

    return undefined;
}

// Why a colleague at work takes no other task, and where the task can go instead.
function atWork(colleague: Colleague, task: string): string
{
    return `${colleague.name} is already at work on "${task}", and a colleague takes one task at a time. Give this one to them when that task's result comes back, `
        + "to another colleague of the field, or do it yourself; ask the user if it matters which.";
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
        await setMeeting($, active);
    }
}

function sameMembers(one: string[], other: string[]): boolean
{
    return one.length === other.length && one.every(id => other.includes(id));
}

// Where Node's os.tmpdir() points, which is where the hook writes; read once a load.
async function tempFolder($: EngineInterface): Promise<string>
{
    temporaryFolder ??= await systemTemp($);
    return temporaryFolder;
}

async function systemTemp($: EngineInterface): Promise<string>
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

// A colleague who starts a task or joins a meeting brings the panel back, closed or not, to follow them there.
async function openForWork($: EngineInterface): Promise<void>
{
    if ((await $.ui.panes().catch(() => [])).some(open => open.id === pane)) {
        return;
    }

    // A session with nowhere to draw (headless) has no pane to open.
    void $.ui.open({ id: pane, title: say().pane }).catch(() => undefined);
}

async function openOnce($: EngineInterface): Promise<void>
{
    if ((await read($, view)).autoOpened || !(await read($, preferences)).autoOpen) {
        return;
    }

    await update($, view, current => ({ ...current, autoOpened: true }));
    // A session with nowhere to draw (headless) has no pane to open.
    void $.ui.open({ id: pane, title: say().pane }).catch(() => undefined);
}

// The panel's settings as the store keeps them, over the defaults; the defaults when the store cannot be read.
async function storedPreferences($: EngineInterface): Promise<Preferences>
{
    const defaults: Preferences = { language: "auto", autoOpen: true };

    try {
        const stored = await $.store.get("preferences");
        return stored && typeof stored === "object" ? { ...defaults, ...(stored as Partial<Preferences>) } : defaults;
    } catch {
        return defaults;
    }
}

// A change of the panel's settings: kept across sessions, and drawn at once in the language it names.
async function choosePreferences($: EngineInterface, change: (current: Preferences) => Preferences): Promise<void>
{
    const chosen = change(await read($, preferences));
    await $.store.set("preferences", chosen).catch(() => undefined);
    language = languageChosen(chosen);
    await update($, preferences, () => chosen);
}

function languageChosen(chosen: Preferences): Language
{
    return chosen.language === "auto" ? detectedLanguage : languageOf(chosen.language);
}

// The language the settings ask for: the plugin's own option, as written there, then Claude Code's language.
async function settingsLanguage($: EngineInterface): Promise<string | undefined>
{
    try {
        const settings = (await $.settings.read()) as { language?: unknown; pluginConfigs?: Record<string, { options?: { language?: unknown } }> };
        const own = settings.pluginConfigs?.["crew@claude-crew"]?.options?.language;
        const usable = [own, settings.language].filter(hint => typeof hint === "string" && hint !== "auto");
        return usable[0] as string | undefined;
    } catch {
        return undefined;
    }
}

// The system's locale, where no LANG says it (Windows).
function systemLocale(): string | undefined
{
    try {
        return Intl.DateTimeFormat().resolvedOptions().locale;
    } catch {
        return undefined;
    }
}

function clip(text: string, length: number): string
{
    return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}
