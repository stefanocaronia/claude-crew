// Who is in the conversation with the user: the crew plugin's conversation script keeps it in the system's temp folder by session,
// the band above the prompt changes it at once, and a reply where colleagues speak brings them in.
import { atom, read, update } from "claude-code";
import type { EngineInterface } from "claude-code";

import type { Meeting } from "../../types";

import { cached, tempFolder } from "../files/index.ts";
import { initial, openForWork } from "../session/index.ts";
import { shareWork } from "../work/index.ts";
import { speakersOf } from "./segments.ts";

const meeting = atom({ plugin: "crew", key: "meeting" } as const, initial.meeting);
const runs = atom({ plugin: "crew", key: "runs" } as const, initial.runs);
const speakers = atom({ plugin: "crew", key: "speakers" } as const, initial.speakers);

/** Who is in the meeting now. Whoever joins it starts something new, so those who had finished go back to the coffee break. */
export async function setMeeting($: EngineInterface, members: string[], pending?: Meeting["pending"]): Promise<void>
{
    const current = await read($, meeting);

    if (members.some(id => !current.members.includes(id))) {
        await openForWork($);
    }

    if (members.some(id => !current.members.includes(id)) && (await read($, runs)).some(run => run.status !== "running" && !run.isBack)) {
        await update($, runs, list => list.map(run => (run.status !== "running" ? { ...run, isBack: true } : run)));
    }

    await update($, meeting, () => ({ members, pending }));
    // The project's other chats learn of it now, not at the next share.
    await shareWork($).catch(() => undefined);
}

/** The meeting as the conversation script's state file says it, unless a change made in the band still waits for its command. */
export async function refreshMeeting($: EngineInterface): Promise<void>
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

/** Who spoke last, from a reply as it is stored: the colleagues who speak in it join the meeting. */
export async function noteSpeakers($: EngineInterface, text: string): Promise<void>
{
    const speaking = speakersOf(text, await read($, speakers));

    if (speaking.length) {
        const current = await read($, meeting);
        await setMeeting($, [...new Set([...current.members, ...speaking.map(speaker => speaker.id)])], current.pending);
    }
}

/** The colleagues asked a quick question in this session a little while ago, as the conversation script keeps them: past that, an
 * answer's button would open a meeting nobody asked for. */
export async function recentlyAsked($: EngineInterface): Promise<string[]>
{
    const path = `${await tempFolder($)}/claude-crew/${(await $.session.id()).replace(/[^\w-]/g, "_")}.asked.json`;
    // Every colleague's message in the chat asks, at each drawing: the file is read again only when it changed.
    const stat = await $.fs.stat(path).catch(() => undefined);

    if (stat?.kind !== "file") {
        return [];
    }

    const at = await $.clock.now();
    let asked: Record<string, number>;

    try {
        asked = JSON.parse(await cached(path, stat, () => $.fs.read(path))) as Record<string, number>;
    } catch {
        return [];
    }

    return Object.entries(asked).flatMap(([id, when]) => (at - when < 10 * 60 * 1000 ? [id] : []));
}

function sameMembers(one: string[], other: string[]): boolean
{
    return one.length === other.length && one.every(id => other.includes(id));
}
