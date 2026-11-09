// Who works in the project's other chats: each chat writes its colleagues at work and its meeting to the temp folder, and reads
// the others', as a session's state is its own.
import { atom, read, update } from "claude-code";
import type { EngineInterface } from "claude-code";

import type { Run } from "../../types";

import { projectRoot, tempFolder } from "../files/index.ts";
import { initial } from "../session/index.ts";
import { stepRedrawEvery } from "./runs.ts";

const elsewhere = atom({ plugin: "crew", key: "elsewhere" } as const, initial.elsewhere);
const meeting = atom({ plugin: "crew", key: "meeting" } as const, initial.meeting);
const runs = atom({ plugin: "crew", key: "runs" } as const, initial.runs);
const team = atom({ plugin: "crew", key: "team" } as const, initial.team);

/** How often a panel shares who works in its chat, and reads who works in the others: who starts, stops or changes step shows at
 * once; what they are doing and their tokens, which change at every tool, redraw only as often as a colleague's own steps. */
export const shareEvery = 5_000;
// While someone is at work, a chat writes what it shares at least this often: the others take a file a minute old for a closed chat.
const shareFreshEvery = 20_000;
let sharedDrawnAt = 0;
// What this chat last shared, and when: written again only when it changed, or while someone is at work, to stay fresh.
let sharedLast: { outline: string; at: number } | undefined;
// The other chats' shared files as last read, by name: read again only when their time or size changed.
const sharedFiles = new Map<string, { stamp: string; shared: { root?: string; at?: number; runs?: Run[]; meeting?: string[] } }>();
// Who is in a meeting in the project's other chats, by id, as last read: they take no task and no meeting here.
let meetingsElsewhere: string[] = [];

/** What was shared and read forgotten, as at a new load of the module. */
export function forgetShared(): void
{
    sharedFiles.clear();
    sharedLast = undefined;
}

/** Who is in a meeting in the project's other chats, as last read. */
export function inMeetingsElsewhere(): string[]
{
    return meetingsElsewhere;
}

/** This session's colleagues at work, written for the project's other chats; theirs, read back when fresh, for this panel. The
 * panel is redrawn only when what the others share changed. */
export async function shareWork($: EngineInterface): Promise<void>
{
    const folder = `${await tempFolder($)}/claude-crew`;
    const session = (await $.session.id()).replace(/[^\w-]/g, "_");
    const root = await projectRoot($);
    const at = await $.clock.now();
    const shown = await read($, elsewhere);

    // A project without a team has nobody to share or show.
    if (!(await read($, team)).length && !shown.length) {
        return;
    }

    const mine = (await read($, runs)).filter(run => run.status === "running" && !run.isElsewhere);
    const members = (await read($, meeting)).members;
    const outline = JSON.stringify([mine, members]);

    if (outline !== sharedLast?.outline || ((mine.length || members.length) && at - sharedLast.at >= shareFreshEvery)) {
        await $.fs.write(`${folder}/work-${session}.json`, JSON.stringify({ root, at, runs: mine, meeting: members }));
        sharedLast = { outline, at };
    }

    const others: Run[] = [];
    const meetings: string[] = [];

    // The files of chats closed long ago stay in the folder: unchanged, they are not read again.
    for (const entry of await $.fs.list(folder)) {
        if (entry.kind !== "file" || !/^work-.+\.json$/.test(entry.name) || entry.name === `work-${session}.json`) {
            continue;
        }

        const stamp = `${entry.mtimeMs}:${entry.size}`;
        let shared = sharedFiles.get(entry.name)?.stamp === stamp ? sharedFiles.get(entry.name)?.shared : undefined;

        if (!shared) {
            try {
                shared = JSON.parse(await $.fs.read(`${folder}/${entry.name}`)) as { root?: string; at?: number; runs?: Run[] };
                sharedFiles.set(entry.name, { stamp, shared });
            } catch {
                // A file being written right now: read again at the next turn.
                shared = {};
            }
        }

        // A chat that no longer writes has closed: what it left is not shown.
        if (shared.root === root && typeof shared.at === "number" && at - shared.at < 60_000) {
            others.push(...(shared.runs ?? []).map(run => ({ ...run, isElsewhere: true })));
            meetings.push(...(shared.meeting ?? []));
        }
    }

    meetingsElsewhere = meetings;

    // Every redraw loses the click that lands on the drawing it replaces.
    const outlineOf = (list: Run[]) => JSON.stringify(list.map(run => [run.agentId, run.task, run.stepDone, run.stepTotal, run.stepNote]));
    const hasMoved = outlineOf(others) !== outlineOf(shown);
    const hasDetail = JSON.stringify(others) !== JSON.stringify(shown) && at - sharedDrawnAt >= stepRedrawEvery;

    if (hasMoved || hasDetail) {
        sharedDrawnAt = at;
        await update($, elsewhere, () => others);
    }
}
