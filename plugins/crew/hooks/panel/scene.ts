// What the panel draws from: the state read once a drawing, what it makes of it (who is at work, in the meeting, finished, free),
// and what its presses do. The controls (controls.tsx) and the views draw from it.
import { atom, read, update } from "claude-code";
import type { EngineInterface, Frozen, RenderInput } from "claude-code";

import type { Colleague } from "../../types";

import { projectRoot } from "../files/index.ts";
import { initial, loaded } from "../session/index.ts";
import { addTodoLine, changeBacklog, changeTodoLine, openIdsOf, projectClaude, projectMe, projectOwner, readCard, removeTodoLine, safeRefresh, type Task, taskWords, withNextPriority } from "../team/index.ts";
import { dateOf, listNames, words } from "../text/index.ts";
import { frozenFor, startingFor } from "./style.ts";

const board = atom({ plugin: "crew", key: "board" } as const, initial.board);
const coordinator = atom({ plugin: "crew", key: "coordinator" } as const, initial.coordinator);
const elsewhere = atom({ plugin: "crew", key: "elsewhere" } as const, initial.elsewhere);
const gallery = atom({ plugin: "crew", key: "gallery" } as const, initial.gallery);
const meeting = atom({ plugin: "crew", key: "meeting" } as const, initial.meeting);
const preferences = atom({ plugin: "crew", key: "preferences" } as const, initial.preferences);
const runs = atom({ plugin: "crew", key: "runs" } as const, initial.runs);
const team = atom({ plugin: "crew", key: "team" } as const, initial.team);
const view = atom({ plugin: "crew", key: "view" } as const, initial.view);

/** The input of the panel's drawing. */
export type PaneInput = Frozen<RenderInput<"Pane">>;

/** The scene of one drawing of the panel. */
export async function sceneOf($: EngineInterface, e: PaneInput)
{
    const ui = $.ui.resolve(e);
    const say = words[loaded.language];
    const colleagues = await read($, team);
    const chat = await read($, coordinator);
    const list = await read($, runs);
    const talk = await read($, meeting);
    const panel = await read($, view);
    const stamp = await read($, gallery);
    const latest = await read($, board);
    // The latest moment the state knows of, for the times drawn: a start, a step, an end, a reading of the files.
    const at = Math.max(latest.checkedAt, ...list.map(run => Math.max(run.startedAt, run.steppedAt ?? 0, run.endedAt ?? 0)), 0);
    const byId = new Map([...colleagues, ...(chat ? [chat] : [])].map(colleague => [colleague.id, colleague]));
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
    // Who can start a task now: neither at work nor in the meeting.
    const isFree = (colleague: Colleague) => !busy.has(colleague.id) && !inMeeting.has(colleague.id);
    // A start the user asked for shows on its button until one of its colleagues begins a task, or for two minutes: Claude takes a
    // moment to start them, and a second press would start them twice.
    const drawnAt = await $.clock.now();
    const isStarting = (key: string, ids: string[]) => {
        const asked = panel.starting?.[key];
        return asked !== undefined && drawnAt - asked < startingFor && !list.some(run => ids.includes(run.colleague) && run.startedAt >= asked);
    };
    const markStarting = async (key: string) => {
        const asked = await $.clock.now();
        await update($, view, current => ({ ...current, starting: { ...Object.fromEntries(Object.entries(current.starting ?? {}).filter(([, when]) => asked - when < startingFor)), [key]: asked } }));
    };
    // One task of a colleague's todo, the one the user pressed ▶ on, as a command, as the user would type it.
    const startTask = async (colleague: Colleague, text: string) => {
        await markStarting(`${colleague.id}:${text}`);
        await $.command.run({ command: "crew:next", args: `${colleague.name} -- ${text}` });
    };
    // The next tasks of some colleagues, from the Next task buttons.
    const startNext = async (members: Colleague[]) => {
        await markStarting(`next:${members.map(member => member.id).join(",")}`);
        await runCommand("crew:next", members);
    };
    const isNextStarting = (members: Colleague[]) => isStarting(`next:${members.map(member => member.id).join(",")}`, members.map(member => member.id));
    // The team's button: any Next task still starting, since its press clears the colleagues picked.
    const isAnyNextStarting = Object.keys(panel.starting ?? {}).some(key => key.startsWith("next:") && isStarting(key, key.slice("next:".length).split(",")));
    const sendBack = (ids: string[]) => update($, runs, all => all.map(run => (ids.includes(run.colleague) && run.status !== "running" ? { ...run, isBack: true } : run)));
    const selected = panel.selected ? byId.get(panel.selected) : undefined;
    // The meeting itself is in the main chat and above the prompt: here only a ring says who is in it.
    const presence = (colleague: Colleague) => (talk.members.includes(colleague.id) ? say.inMeeting : "");
    const open = (colleague: Colleague) => async () => {
        await update($, view, current => ({ ...current, selected: colleague.id, reading: undefined }));
        await readCard($, colleague.id);
    };
    const isDesktop = e.surface !== "terminal" && "Svg" in ui;
    // The colleagues picked for a meeting, on their cards; the meeting button starts it with them.
    // Only who is free can be picked: a colleague at work or in the meeting takes no other task.
    const picked = (panel.picked ?? []).filter(id => byId.has(id) && !busy.has(id) && !inMeeting.has(id));
    // A small square box in the text's color: an outline, checked when picked; a background only under the pointer.
    const togglePick = (colleague: Colleague) => update($, view, current => ({ ...current, picked: (current.picked ?? []).includes(colleague.id) ? (current.picked ?? []).filter(id => id !== colleague.id) : [...(current.picked ?? []), colleague.id] }));
    const pickedTeam = picked.flatMap(id => byId.get(id) ?? []);
    const pickedNames = pickedTeam.length ? listNames(pickedTeam.map(colleague => colleague.name), say.and, say.comma) : "";
    // A meeting with everyone takes whoever is free; while a meeting goes on, the band above the prompt invites.
    const free = colleagues.filter(colleague => !busy.has(colleague.id) && !inMeeting.has(colleague.id));
    const canMeet = !talk.members.length && (pickedTeam.length > 0 || free.length > 0);
    const send = (text: string) => {
        void $.prompt.submit({ text, asUser: true });
    };
    // The panel's actions are the crew plugin's commands, which ask in the chat what the request leaves open: what to review, the
    // meeting's topic, the new colleague's field, the portraits' style, a yes before a firing. The picks are used up.
    const runCommand = async (command: string, members: Colleague[]) => {
        await update($, view, current => ({ ...current, picked: [] }));
        await $.command.run({ command, args: members.map(member => member.name).join(" ") });
    };
    // A talk with one colleague from their card starts at once, with no topic asked.
    const talkWith = (colleague: Colleague) => $.command.run({ command: "crew:talk", args: colleague.name });
    // A quick question asks in the chat what to ask, and the colleague answers it at once, even while at work.
    const askOf = (colleague: Colleague) => $.command.run({ command: "crew:ask", args: colleague.name });
    const about = (colleague: Colleague) => say.toDo(colleague.openTasks);
    const chosen = await read($, preferences);
    // The panel's settings: a gear beside the team's actions, its name written out in the empty panel.
    const openSettings = () => update($, view, current => ({ ...current, isSettingsOpen: true }));
    const today = await $.clock.now();
    // The panel changes a todo itself, at once, without Claude: a task's priority turned or its words, a task removed to the archive.
    const changeTodo = async (colleague: Colleague, line: string, change: (line: string) => string) => {
        await changeTodoLine($, colleague.id, line, change);
        await safeRefresh($);
        if ((await read($, view)).selected === colleague.id) {
            await readCard($, colleague.id);
        }
    };
    const cyclePriority = async (colleague: Colleague, line: string) => {
        const day = dateOf(await $.clock.now());
        await changeTodo(colleague, line, current => withNextPriority(current, day));
    };
    const removeTask = async (colleague: Colleague, line: string) => {
        await removeTodoLine($, colleague.id, line);
        await update($, view, current => ({ ...current, openTask: undefined }));
        await safeRefresh($);
        if ((await read($, view)).selected === colleague.id) {
            await readCard($, colleague.id);
        }
    };
    // The types a new backlog task may take: the five every project has, in the panel's language, then those the project adds or
    // renames; feature first picked.
    const taskTypes = { ...say.typeNames, ...(latest.types ?? {}) };
    const newTaskType = panel.newTaskType && panel.newTaskType in taskTypes ? panel.newTaskType : "feature";
    // A new task written in a colleague's card: a task of the project's backlog held by them, of the type picked, created by the
    // project's owner, or without a backlog a line of their todo.
    const addTask = async (colleague: Colleague, value: string) => {
        const written = taskWords(value);
        await update($, view, now => ({ ...now, editing: undefined }));

        if (!written) {
            return;
        }

        if (latest.backlog) {
            // Created by who is in this chat as the project names them, else by the project's owner.
            const owner = (await projectMe($, await projectRoot($))) ?? (await projectOwner($));
            // The coordinator's tasks are Claude's in the backlog, as the project plugin names Claude: the first of its people.
            const holder = colleague.id === chat?.id ? await projectClaude($, await projectRoot($)) : colleague.name;
            await changeBacklogTask(colleague, ["add", written, "--type", newTaskType, "--to", holder, ...(owner ? ["--by", owner] : [])]);
            return;
        }

        await addTodoLine($, colleague.id, `P2 · ${dateOf(await $.clock.now())} · ${written}`);
        await safeRefresh($);
        await readCard($, colleague.id);
    };
    // A task of the project's backlog is changed by the backlog's own command: its priority turned, its words, or archived.
    const changeBacklogTask = async (colleague: Colleague, args: string[]) => {
        try {
            await changeBacklog($, args);
        } catch (error) {
            await update($, board, current => ({ ...current, error: error instanceof Error ? error.message : String(error) }));
            return;
        }

        await update($, view, current => ({ ...current, openTask: args[0] === "archive" ? undefined : current.openTask }));
        await safeRefresh($);
        if ((await read($, view)).selected === colleague.id) {
            await readCard($, colleague.id);
        }
    };
    // The tasks' places as drawn, by "<colleague>:<its words>": after a priority turns they stay for a moment, the row under the pointer.
    const held = panel.frozen && drawnAt < panel.frozen.until ? new Map(Object.entries(panel.frozen.rank)) : undefined;
    const shownRank = new Map<string, number>();
    const shown = (tasks: Task[]) => {
        tasks.forEach((task, index) => shownRank.set(`${task.colleague}:${task.text}`, index));
        return tasks;
    };
    const freeze = async () => {
        const until = (await $.clock.now()) + frozenFor;
        await update($, view, current => ({ ...current, frozen: { until, rank: Object.fromEntries(shownRank) } }));
        $.clock.after(frozenFor, () => void update($, view, current => (current.frozen && current.frozen.until <= until ? { ...current, frozen: undefined } : current)));
    };
    // A day count with a space that never breaks: "15 g" stays on one line.
    const dayCount = (count: number) => `${count}${say.units.gap.replace(" ", " ")}${say.units.day}`;
    const todayDate = dateOf(today);
    // Every open task with an id, by who holds it: what a task waits for is found there, without asking anyone.
    const openIds = openIdsOf(chat && latest.chatTasks?.length ? [...latest.tasks, { colleague: chat.id, lines: latest.chatTasks }] : latest.tasks, latest.backlog);
    return { e, ui, say, colleagues, chat, list, talk, panel, stamp, latest, at, byId, shared, running, busy, meetingMembers, inMeeting, finished, done, idle, isFree, drawnAt, isStarting, markStarting, startTask, startNext, isNextStarting, isAnyNextStarting, sendBack, selected, presence, open, isDesktop, picked, togglePick, pickedTeam, pickedNames, free, canMeet, send, runCommand, talkWith, askOf, about, chosen, openSettings, today, changeTodo, cyclePriority, removeTask, taskTypes, newTaskType, addTask, changeBacklogTask, held, shownRank, shown, freeze, dayCount, todayDate, openIds };
}

export type Scene = Awaited<ReturnType<typeof sceneOf>>;
