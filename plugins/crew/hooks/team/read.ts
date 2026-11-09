// The team read from their files into the session's state: the colleagues and the coordinator, their open tasks with the project
// backlog's, their portraits, who is in this chat. One listing of each folder says which files changed since the last reading: only
// those are read again.
import { atom, read, update } from "claude-code";
import type { EngineInterface } from "claude-code";

import type { Colleague, Speaker } from "../../types";

import { drawingBudget } from "../draw/index.ts";
import { cached, dataUri, filesIn, type FileStamp, projectRoot, tempFolder } from "../files/index.ts";
import { refreshMeeting } from "../meeting/index.ts";
import { initial, loaded } from "../session/index.ts";
import { projectBacklog, projectClaude, projectMe, projectTypes } from "./backlog.ts";
import { agentSpecFrom, backlogLinesOf, colleagueFrom, coordinatorPromptOf, isCoordinatorProfile, memorySizeOf, openTasks } from "./profile.ts";

const agentsWatched = atom({ plugin: "crew", key: "agentsWatched" } as const, initial.agentsWatched);
const board = atom({ plugin: "crew", key: "board" } as const, initial.board);
const coordinator = atom({ plugin: "crew", key: "coordinator" } as const, initial.coordinator);
const gallery = atom({ plugin: "crew", key: "gallery" } as const, initial.gallery);
const speakers = atom({ plugin: "crew", key: "speakers" } as const, initial.speakers);
const team = atom({ plugin: "crew", key: "team" } as const, initial.team);

// A portrait's characters as a data URI, at most: past it, initials. A small one serves the backlog's rows as it is.
const portraitLimit = 24_000;
const smallLimit = 3_000;
// The portraits as last read, by their sizes: a change tells the drawings to draw again.
let portraitsRead = "";
// Who is in this chat, for the memories: the project plugin's `me:`, else git's user name; asked once a load.
let personRead: Promise<string | undefined> | undefined;
// The colleagues whose profile Claude Code did not load, as the panel defines them: their agent type by id, and the profile it was
// defined from. A load of the module defines them again, since an unload takes a plugin's agent types away.
const lateTypes = new Map<string, { type: string; profile: string }>();

/** What was read forgotten, as at a new load of the module. */
export function forgetTeam(): void
{
    lateTypes.clear();
    personRead = undefined;
    loaded.coordinatorText = undefined;
    loaded.isTeamRead = false;
}

/** A colleague hired in this session, in a project that had no .claude/agents/ at its start, is the panel's agent type. */
export function lateType(id: string): string | undefined
{
    return lateTypes.get(id)?.type;
}

/** Claude Code loads the profiles of .claude/agents/ as they are written only when the folder was there at its start: noted once a
 * session, since /reload-plugins starts it again with the folder there. */
export async function noteAgentsFolder($: EngineInterface): Promise<void>
{
    if ((await read($, agentsWatched)) === null) {
        const isWatched = await $.fs.exists(`${await projectRoot($)}/.claude/agents`);
        await update($, agentsWatched, () => isWatched);
    }
}

/** A refresh that never stops the panel: what fails is shown in it, and kept in the temp folder for whoever helps. */
export async function safeRefresh($: EngineInterface): Promise<void>
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

/** Who is in this chat, for the memories: the project plugin's `me:`, else git's user name; undefined without either. Asked once a
 * load. */
export async function personOf($: EngineInterface): Promise<string | undefined>
{
    personRead ??= (async () => {
        const root = await projectRoot($);
        const me = await projectMe($, root);

        if (me) {
            return me;
        }

        const named = await $.process.run(["git", "config", "user.name"], { cwd: root, timeoutMs: 5000 }).catch(() => undefined);
        return named?.exitCode === 0 ? named.stdout.trim() || undefined : undefined;
    })();
    return personRead;
}

// The team from their files, their open tasks, the budget's windows, and who is in the conversation.
async function refresh($: EngineInterface): Promise<void>
{
    const root = await projectRoot($);
    const agents = `${root}/.claude/agents`;
    const colleagues: Colleague[] = [];
    const found = new Map<string, string>();
    const small = new Map<string, string>();
    const tasks: { colleague: string; lines: string[] }[] = [];
    const longMemories: string[] = [];
    const profiles = new Map<string, string>();
    // The coordinator, `coordinator: true` in their profile: the first one, apart from the team, with their profile and memory.
    let chat: Colleague | null = null;
    let chatProfile = "";
    let chatMemory = "";
    const chatTasks: string[] = [];

    for (const [name, profile] of (await $.fs.exists(agents)) ? await filesIn($, agents) : new Map<string, FileStamp>()) {
        const id = name.endsWith(".md") ? name.slice(0, -".md".length) : "";
        const folder = `${root}/.claude/agent-memory/${id}`;
        const files = id ? await filesIn($, folder).catch(() => undefined) : undefined;
        const todoFile = files?.get("todo.md");
        const readProfile = () => cached(`${agents}/${name}`, profile, () => $.fs.read(`${agents}/${name}`));
        // The coordinator needs no todo of their own: the backlog's tasks of Claude are theirs.
        const isChat = Boolean(id) && !chat && isCoordinatorProfile(await readProfile());

        if (!isChat && (!files || !todoFile)) {
            continue;
        }

        const portrait = files ? await portraitIn($, folder, files) : undefined;
        const todo = todoFile ? await cached(`${folder}/todo.md`, todoFile, () => $.fs.read(`${folder}/todo.md`)) : "";
        const lines = openTasks(todo);

        if (portrait) {
            found.set(id, portrait.uri);
        }

        // A light portrait (a small SVG) serves the backlog as it is.
        const smallUri = portrait?.small ?? portrait?.uri;

        if (smallUri && smallUri.length <= smallLimit) {
            small.set(id, smallUri);
        }

        const memoryFile = files?.get("MEMORY.md");
        const memory = memoryFile ? await cached(`${folder}/MEMORY.md`, memoryFile, () => $.fs.read(`${folder}/MEMORY.md`)) : "";
        const text = await readProfile();

        if (isChat) {
            chat = { ...colleagueFrom(id, text, todo, portrait?.stamp ?? 0), isClaude: true };
            chatProfile = text;
            chatMemory = memory;
            chatTasks.push(...lines);

            if (memorySizeOf(memory).isLong) {
                longMemories.push(id);
            }

            continue;
        }

        if (lines.length) {
            tasks.push({ colleague: id, lines });
        }

        // A memory past what it may hold: Claude Code hands its colleague only the beginning.
        if (memorySizeOf(memory).isLong) {
            longMemories.push(id);
        }

        colleagues.push(colleagueFrom(id, text, todo, portrait?.stamp ?? 0));
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

    // The tasks of the project's backlog a colleague holds join their open tasks, written as todo lines, and count as theirs.
    const backlog = await projectBacklog($, root);
    const types = backlog ? await projectTypes($, root) : undefined;
    const fromBacklog: string[] = [];

    // The backlog's tasks of Claude, the first of the project's people, are the coordinator's: the project plugin writes them so,
    // whatever name they were given by. Before the colleagues, since Claude is the first of the people there too.
    const holders = chat ? [{ id: chat.id, name: await projectClaude($, root) }, { id: chat.id, name: chat.name }, ...colleagues] : colleagues;

    for (const [id, lines] of backlogLinesOf(backlog ?? [], holders)) {
        fromBacklog.push(...lines.map(line => `${id}:${line}`));

        if (chat && id === chat.id) {
            chat = { ...chat, openTasks: chat.openTasks + lines.length };
            continue;
        }

        const group = tasks.find(one => one.colleague === id);

        if (group) {
            group.lines.push(...lines);
        } else {
            tasks.push({ colleague: id, lines });
        }

        const holder = colleagues.findIndex(one => one.id === id);
        const colleague = colleagues[holder];

        if (colleague) {
            colleagues[holder] = { ...colleague, openTasks: colleague.openTasks + lines.length };
        }
    }

    const hasCommands = (await $.command.list()).some(info => info.plugin === "crew" || info.name.startsWith("crew:"));
    const sortedTasks = tasks.sort((first, second) => second.lines.length - first.lines.length || first.colleague.localeCompare(second.colleague));
    const previous = await read($, board);

    // Every write redraws the panel, and a click that lands on a drawing already replaced is lost: write only what changed.
    if (previous.hasCommands !== hasCommands || previous.error || JSON.stringify(previous.tasks) !== JSON.stringify(sortedTasks) || JSON.stringify(previous.heavy ?? []) !== JSON.stringify(heavy)
        || JSON.stringify(previous.longMemories ?? []) !== JSON.stringify(longMemories) || JSON.stringify(previous.backlog) !== JSON.stringify(backlog)
        || JSON.stringify(previous.fromBacklog ?? []) !== JSON.stringify(fromBacklog) || JSON.stringify(previous.types) !== JSON.stringify(types)
        || JSON.stringify(previous.chatTasks ?? []) !== JSON.stringify(chatTasks)) {
        const checkedAt = await $.clock.now();
        await update($, board, current => ({ ...current, hasCommands, tasks: sortedTasks, chatTasks, heavy, longMemories, backlog, fromBacklog, types, error: undefined, checkedAt }));
    }

    const signature = [...kept, ...small].map(([id, uri]) => `${id}:${uri.length}`).join("|");
    loaded.portraits = kept;
    loaded.smallPortraits = small;

    if (signature !== portraitsRead) {
        portraitsRead = signature;
        const at = await $.clock.now();
        await update($, gallery, () => at);
    }

    const sorted = colleagues.sort((first, second) => first.name.localeCompare(second.name));

    if (JSON.stringify(sorted) !== JSON.stringify(await read($, team))) {
        await update($, team, () => sorted);
    }

    loaded.coordinatorText = chat ? coordinatorPromptOf(chat, chatProfile, chatMemory, await personOf($)) : undefined;
    loaded.isTeamRead = true;

    if (JSON.stringify(chat) !== JSON.stringify(await read($, coordinator))) {
        const shown = chat;
        await update($, coordinator, () => shown);
    }

    // Every message in the chat draws its speakers: they are written apart from the team, and only when they changed. The coordinator
    // among them: the Claude of this chat, who speaks in a meeting with [Claude].
    const voices: Speaker[] = [...sorted, ...(chat ? [chat] : [])].map(({ id, name, fullName, role, color, isClaude }) => ({ id, name, fullName, role, color, ...(isClaude ? { isClaude } : {}) }));

    if (JSON.stringify(voices) !== JSON.stringify(await read($, speakers))) {
        await update($, speakers, () => voices);
    }

    await refreshMeeting($);
}

// The portrait as a data URI (avatar.jpg, .webp, .png or .svg) with the file's time, so a new one is drawn again, and the small one,
// as the project plugin reads it too: the 32 px avatar-small.jpg, else the drawn avatar.svg.
async function portraitIn($: EngineInterface, folder: string, files: Map<string, FileStamp>): Promise<{ uri: string; stamp: number; small?: string } | undefined>
{
    const smallFile = files.get("avatar-small.jpg");
    const svgFile = files.get("avatar.svg");
    const small = smallFile ? await cached(`${folder}/avatar-small.jpg`, smallFile, () => dataUri($, `${folder}/avatar-small.jpg`, "image/jpeg"))
        : svgFile ? await cached(`${folder}/avatar.svg`, svgFile, () => dataUri($, `${folder}/avatar.svg`, "image/svg+xml")) : undefined;

    for (const [name, type] of [["avatar.jpg", "image/jpeg"], ["avatar.webp", "image/webp"], ["avatar.png", "image/png"], ["avatar.svg", "image/svg+xml"]] as const) {
        const file = files.get(name);

        if (file) {
            return { uri: await cached(`${folder}/${name}`, file, () => dataUri($, `${folder}/${name}`, type)), stamp: file.mtimeMs, small };
        }
    }

    return undefined;
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
