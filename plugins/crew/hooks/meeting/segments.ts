// A conversation with the colleagues as the chat shows it: each turn starts with "[Matteo]", Claude's narrator lines are in italics.
import type { Speaker } from "../../types";
import { nameKey } from "../text/index.ts";

/** One piece of a reply: a colleague's turn, or a narrator line when `speaker` is absent. */
export type Segment = {
    speaker?: Speaker;
    text: string;
    /** The same speaker going on after a narrator line: drawn without their name again. */
    isContinued?: boolean;
};

/** The reply cut at each "[Name]" that starts a line, Name being a colleague's first name; undefined when no colleague speaks in it,
 * unless a meeting goes on: there a reply without a name is Claude's, or the narrator's when it carries italics. Claude is the
 * speaker marked `isClaude`, the coordinator when the team has one: their turns start with [Claude] or with their own name. */
export function segmentsOf(text: string, team: Speaker[], isMeeting = false): Segment[] | undefined
{
    if (!team.length) {
        return undefined;
    }

    const claude = team.find(member => member.isClaude);
    const markers = markersOf(text, team);
    const speakerOf = (marker: RegExpMatchArray) => speakerNamed(marker[1] ?? "", team);

    // Outside a meeting, Claude naming itself makes no group chat: only a colleague who speaks does.
    if (!markers.length || (!isMeeting && markers.every(marker => speakerOf(marker)?.isClaude))) {
        // A note that carries italics is the narrator's between tools, all of it; plain words alone are Claude speaking.
        const own = !isMeeting || !claude ? [] : hasItalic(text) ? narration(text) : outside(text, claude);
        return own.length ? own : undefined;
    }

    const segments: Segment[] = outside(text.slice(0, markers[0]?.index ?? 0), claude);

    markers.forEach((marker, index) => {
        const end = markers[index + 1]?.index ?? text.length;
        segments.push(...turn(text.slice((marker.index ?? 0) + marker[0].length, end), speakerOf(marker)));
    });

    return segments.filter(segment => segment.text);
}

/** A reply that is no group chat, without the name Claude may have put in front of it: drawn as a plain message, as Claude's
 * replies always are outside a meeting. The text as it is when it starts with no name of Claude's. */
export function withoutClaudeMark(text: string, team: Speaker[]): string
{
    const first = markersOf(text, team)[0];
    const isClaude = first?.index !== undefined && !text.slice(0, first.index).trim() && speakerNamed(first[1] ?? "", team)?.isClaude;
    return isClaude && first ? text.slice((first.index ?? 0) + first[0].length) : text;
}

// Each "[Name]" that starts a line and names a speaker: their first name, without case or accents, or [Claude] where Claude is among them.
function markersOf(text: string, team: Speaker[]): RegExpMatchArray[]
{
    return [...text.matchAll(/^[ \t]*(?:\*\*)?\[([^\]\n]{1,60})\](?:\*\*)?:?(?:\*\*)?[ \t]*/gm)].filter(marker => speakerNamed(marker[1] ?? "", team));
}

// The speaker a name in brackets is: a colleague's first name, else Claude's, the coordinator's included, or [Claude].
function speakerNamed(name: string, team: Speaker[]): Speaker | undefined
{
    const key = nameKey(name.trim());
    const claude = team.find(member => member.isClaude);
    return team.find(colleague => nameKey(colleague.name) === key) ?? (claude && key === "claude" ? claude : undefined);
}

/** The colleagues who speak in a reply, in order, each once: Claude, the coordinator too, is none of them. */
export function speakersOf(text: string, team: Speaker[]): Speaker[]
{
    const speakers = (segmentsOf(text, team) ?? []).flatMap(segment => (segment.speaker && !segment.speaker.isClaude ? [segment.speaker] : []));
    return speakers.filter((speaker, index) => speakers.indexOf(speaker) === index);
}

// A speaker's turn, with the narrator lines inside it split out.
function turn(text: string, speaker: Speaker | undefined): Segment[]
{
    const segments: Segment[] = [];
    let spoken: string[] = [];
    let hasSpoken = false;
    const flush = () => {
        if (spoken.length) {
            segments.push({ speaker, text: spoken.join("\n\n"), isContinued: hasSpoken || undefined });
            hasSpoken = true;
            spoken = [];
        }
    };

    for (const paragraph of text.trim().split(/\n\s*\n/)) {
        if (isItalic(paragraph) && (hasSpoken || spoken.length)) {
            flush();
            segments.push({ text: paragraph.trim() });
        } else {
            spoken.push(paragraph.trim());
        }
    }

    flush();
    return segments;
}

function narration(text: string): Segment[]
{
    return text.trim() ? [{ text: text.trim() }] : [];
}

// What stands before the first name: narration in italics and, when Claude is among the speakers, its own words, which are not.
function outside(text: string, claude: Speaker | undefined): Segment[]
{
    if (!claude) {
        return narration(text);
    }

    const segments: Segment[] = [];

    for (const paragraph of text.trim().split(/\n\s*\n/).map(part => part.trim()).filter(Boolean)) {
        const speaker = isItalic(paragraph) ? undefined : claude;
        const last = segments.at(-1);

        if (last && last.speaker === speaker) {
            last.text = `${last.text}\n\n${paragraph}`;
        } else {
            segments.push(speaker ? { speaker, text: paragraph } : { text: paragraph });
        }
    }

    return segments;
}

// Words in italics anywhere in the text, out of code: *so* or _so_.
function hasItalic(markdown: string): boolean
{
    const text = markdown.replace(/`[^`\n]*`/g, "");
    return /(^|[^*\w])\*[^*\s][^*\n]*\*(?!\*)/.test(text) || /(^|[^_\w])_[^_\s][^_\n]*_(?!\w)/.test(text);
}

function isItalic(paragraph: string): boolean
{
    const trimmed = paragraph.trim();
    return /^\*[^*\s][\s\S]*\*$/.test(trimmed) || /^_[^_\s][\s\S]*_$/.test(trimmed);
}
