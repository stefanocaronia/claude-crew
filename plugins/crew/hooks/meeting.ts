// A conversation with the colleagues as the chat shows it: each turn starts with "[Matteo]", Claude's narrator lines are in italics.
import type { Speaker } from "../types";

/** The id of Claude among the speakers, when it speaks in its own voice in a meeting. */
export const claudeId = "claude";

/** One piece of a reply: a colleague's turn, or a narrator line when `speaker` is absent. */
export type Segment = {
    speaker?: Speaker;
    text: string;
    /** The same speaker going on after a narrator line: drawn without their name again. */
    isContinued?: boolean;
};

/** The reply cut at each "[Name]" that starts a line, Name being a colleague's first name; undefined when no colleague speaks in it,
 * unless a meeting goes on: there a reply without a name is Claude's, its italics the narration. */
export function segmentsOf(text: string, team: Speaker[], isMeeting = false): Segment[] | undefined
{
    if (!team.length) {
        return undefined;
    }

    const names = team.map(colleague => escapeRegExp(colleague.name)).join("|");
    const markers = [...text.matchAll(new RegExp(`^[ \\t]*(?:\\*\\*)?\\[(${names})\\](?:\\*\\*)?:?(?:\\*\\*)?[ \\t]*`, "gim"))];

    if (!markers.length) {
        const claude = team.find(member => member.id === claudeId);
        const own = isMeeting && claude ? outside(text, claude) : [];
        return own.length ? own : undefined;
    }

    const segments: Segment[] = outside(text.slice(0, markers[0]?.index ?? 0), team.find(member => member.id === claudeId));

    markers.forEach((marker, index) => {
        const end = markers[index + 1]?.index ?? text.length;
        const speaker = team.find(colleague => colleague.name.toLowerCase() === marker[1]?.toLowerCase());
        segments.push(...turn(text.slice((marker.index ?? 0) + marker[0].length, end), speaker));
    });

    return segments.filter(segment => segment.text);
}

/** The colleagues who speak in a reply, in order, each once. */
export function speakersOf(text: string, team: Speaker[]): Speaker[]
{
    const speakers = (segmentsOf(text, team) ?? []).flatMap(segment => (segment.speaker ? [segment.speaker] : []));
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

function isItalic(paragraph: string): boolean
{
    const trimmed = paragraph.trim();
    return /^\*[^*\s][\s\S]*\*$/.test(trimmed) || /^_[^_\s][\s\S]*_$/.test(trimmed);
}

function escapeRegExp(text: string): string
{
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
