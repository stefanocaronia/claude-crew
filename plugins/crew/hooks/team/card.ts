// A colleague's card, as the panel opens it, and what the card changes in their profile: their effort and their permissions.
import { atom, read, update } from "claude-code";
import type { EngineInterface } from "claude-code";

import type { Permissions } from "../../types";

import { forgetFiles, projectRoot } from "../files/index.ts";
import { initial } from "../session/index.ts";
import { cardFrom, withEffort, withPermissions } from "./profile.ts";
import { safeRefresh } from "./read.ts";

const board = atom({ plugin: "crew", key: "board" } as const, initial.board);
const card = atom({ plugin: "crew", key: "card" } as const, initial.card);

// The efforts a colleague can work at; "inherit" takes the line out of the profile, and the session's effort holds.
const effortLevels = ["inherit", "low", "medium", "high", "xhigh", "max"] as const;

/** A colleague's card read from their files: the profile, the open tasks with the backlog's they hold, the memory, the latest report. */
export async function readCard($: EngineInterface, id: string): Promise<void>
{
    const root = await projectRoot($);
    const text = async (path: string) => ((await $.fs.exists(path)) ? await $.fs.read(path) : "");
    const todoCard = cardFrom(id, await text(`${root}/.claude/agents/${id}.md`), await text(`${root}/.claude/agent-memory/${id}/todo.md`), await text(`${root}/.claude/agent-memory/${id}/MEMORY.md`));
    // With the backlog's tasks they hold, as the board has them.
    const held = ((await read($, board)).fromBacklog ?? []).filter(key => key.startsWith(`${id}:`)).map(key => key.slice(id.length + 1));
    const loaded = { ...todoCard, openTasks: [...todoCard.openTasks, ...held] };
    // The round reports are named by their date first: the newest is the latest date's last written, a copy (-2) after its first.
    const notes = `${root}/.claude/agent-memory/${id}/notes`;
    const reports = (await $.fs.exists(notes)) ? (await $.fs.list(notes)).filter(entry => entry.kind === "file" && /^\d{4}-\d{2}-\d{2}-.*\.md$/.test(entry.name)) : [];
    const order = (entry: { name: string; mtimeMs: number }) => [entry.name.slice(0, 10), String(entry.mtimeMs).padStart(16, "0"), entry.name.slice(0, -".md".length)].join("|");
    const latestReport = reports.sort((first, second) => (order(first) < order(second) ? -1 : 1)).at(-1)?.name;
    await update($, card, () => (latestReport ? { ...loaded, latestReport } : loaded));
}

/** A colleague's effort written in their profile, so their next task runs at it; the panel reads the team again. */
export async function setEffort($: EngineInterface, id: string, level: string | undefined): Promise<void>
{
    await writeProfile($, id, profile => withEffort(profile, level));
}

/** A colleague's permissions written in their profile, so their next task runs with them; the panel reads the team again. */
export async function setPermissions($: EngineInterface, id: string, permissions: Permissions): Promise<void>
{
    await writeProfile($, id, profile => withPermissions(profile, permissions));
}

/** One permission switched. Running commands reads and changes any file, so Testing comes with Read and Write and goes without
 * either; changing a file needs reading it, so Write comes with Read and goes without it. */
export function toggled(permissions: Permissions, kind: keyof Permissions): Permissions
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

/** The next effort a click gives, round to the session's own. */
export function nextEffort(effort: string | undefined): string | undefined
{
    const index = effortLevels.indexOf((effort ?? "inherit") as typeof effortLevels[number]);
    const next = effortLevels[(index + 1) % effortLevels.length] ?? "inherit";
    return next === "inherit" ? undefined : next;
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
