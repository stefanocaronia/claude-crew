// A conversation with the colleagues as the chat shows it: each turn starts with "[Matteo]", Claude's narrator lines are in italics.
import type { Colleague } from "../types";

/** One piece of a reply: a colleague's turn, or a narrator line when `speaker` is absent. */
export type Segment = {
    speaker?: Colleague;
    text: string;
    /** The same speaker going on after a narrator line: drawn without their name again. */
    isContinued?: boolean;
};

const ends = [
    /\b(?:torna(?:re)?\s+claude|riunione\s+finita|fine\s+(?:della\s+)?riunione|chiud\w*\s+(?:la\s+)?riunione|riunione\b[^.?!\n]{0,40}\bchiud\w*la)\b/i,
    /\b(?:back\s+to\s+claude|claude[,\s]+(?:come\s+)?back|(?:the\s+)?meeting(?:['’]s|\s+is)?\s+over|(?:end|close)\s+(?:the\s+|this\s+)?meeting)\b/i,
];

/** Whether the user's prompt closes the conversation, as the colleagues plugin's hook understands it. */
export function isEnding(prompt: string): boolean
{
    return ends.some(end => end.test(prompt));
}

/** The reply cut at each "[Name]" that starts a line, Name being a colleague's first name; undefined when no colleague speaks in it. */
export function segmentsOf(text: string, team: Colleague[]): Segment[] | undefined
{
    if (!team.length) {
        return undefined;
    }

    const names = team.map(colleague => escapeRegExp(colleague.name)).join("|");
    const markers = [...text.matchAll(new RegExp(`^[ \\t]*(?:\\*\\*)?\\[(${names})\\](?:\\*\\*)?:?[ \\t]*`, "gim"))];

    if (!markers.length) {
        return undefined;
    }

    const segments: Segment[] = narration(text.slice(0, markers[0]?.index ?? 0));

    markers.forEach((marker, index) => {
        const end = markers[index + 1]?.index ?? text.length;
        const speaker = team.find(colleague => colleague.name.toLowerCase() === marker[1]?.toLowerCase());
        segments.push(...turn(text.slice((marker.index ?? 0) + marker[0].length, end), speaker));
    });

    return segments.filter(segment => segment.text);
}

/** The colleagues who speak in a reply, in order, each once. */
export function speakersOf(text: string, team: Colleague[]): Colleague[]
{
    const speakers = (segmentsOf(text, team) ?? []).flatMap(segment => (segment.speaker ? [segment.speaker] : []));
    return speakers.filter((speaker, index) => speakers.indexOf(speaker) === index);
}

/** Whether a reply is only narrator lines, which keep a meeting going. */
export function isNarration(text: string): boolean
{
    const paragraphs = text.trim().split(/\n\s*\n/).filter(Boolean);
    return paragraphs.length > 0 && paragraphs.every(isItalic);
}

// A speaker's turn, with the narrator lines inside it split out.
function turn(text: string, speaker: Colleague | undefined): Segment[]
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

function isItalic(paragraph: string): boolean
{
    const trimmed = paragraph.trim();
    return /^\*[^*\s][\s\S]*\*$/.test(trimmed) || /^_[^_\s][\s\S]*_$/.test(trimmed);
}

function escapeRegExp(text: string): string
{
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
