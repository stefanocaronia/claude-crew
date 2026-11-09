// How numbers, times, dates, models, names and the words of a task are written.
import type { Colleague } from "../../types";

import { en, type Words } from "./en.ts";

/** "920k", "1.2M"; in Italian "920 mila", "1,2 milioni". */
export function formatTokens(count: number, units: Words["units"] = en.units): string
{
    // Past 999.5 thousand the thousands would round to 1000: a million already.
    return count >= 999_500 ? `${(count / 1e6).toFixed(1).replace(".", units.decimal)}${units.million}` : count >= 1e3 ? `${Math.round(count / 1e3)}${units.thousand}` : `${Math.round(count)}`;
}

/** "2 min 54 s", "1 h 05 min", "40 s". */
export function formatTime(milliseconds: number): string
{
    const seconds = Math.max(0, Math.round(milliseconds / 1000));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours ? `${hours} h ${String(minutes).padStart(2, "0")} min` : minutes ? `${minutes} min ${seconds % 60} s` : `${seconds} s`;
}

/** The ISO week of a moment, in local time: "2026-W41". */
export function isoWeek(at: number): string
{
    const local = new Date(at);
    // The week's Thursday names its year.
    const day = new Date(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()));
    day.setUTCDate(day.getUTCDate() + 4 - (day.getUTCDay() || 7));
    const week = Math.ceil(((day.getTime() - Date.UTC(day.getUTCFullYear(), 0, 1)) / 86_400_000 + 1) / 7);
    return `${day.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** A task as a file name's part: lowercase ASCII and hyphens, at most `length` characters. */
export function slugOf(text: string, length = 50): string
{
    const slug = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return slug.slice(0, length).replace(/-+$/, "") || "report";
}

/** A web address in a text, as a link draws it: where it goes and its words. */
export type WebLink = { href: string; label: string };

/** A text's web addresses apart from the words around them, so each can be drawn as a link: Markdown's [words](https://…) and bare
 * http(s) addresses, which leave to the sentence the punctuation that ends it and a parenthesis they did not open. */
export function linksIn(text: string): (string | WebLink)[]
{
    const parts: (string | WebLink)[] = [];
    let last = 0;

    for (const match of text.matchAll(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|https?:\/\/[^\s<>"'`]+/g)) {
        const [whole, label, linked] = match;
        let href = linked ?? whole.replace(/[.,;:!?»"'\]}]+$/, "");

        while (!linked && href.endsWith(")") && (href.match(/\(/g)?.length ?? 0) < (href.match(/\)/g)?.length ?? 0)) {
            href = href.slice(0, -1).replace(/[.,;:!?»"'\]}]+$/, "");
        }

        if (match.index > last) {
            parts.push(text.slice(last, match.index));
        }

        parts.push({ href, label: label ?? href });
        last = match.index + (linked ? whole.length : href.length);
    }

    return last < text.length ? [...parts, text.slice(last)] : parts;
}

/** A moment's local date: "2026-10-11". */
export function dateOf(at: number): string
{
    const local = new Date(at);
    return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
}

/** "Matteo, Giulia and Sara", with the language's own joiners: `and` carries its spaces, as " e " or "と". */
export function listNames(names: string[], and: string, comma = ", "): string
{
    return names.length < 2 ? names.join("") : `${names.slice(0, -1).join(comma)}${and}${names.at(-1)}`;
}

/** "claude-opus-5-5" → "Opus 5.5". */
export function modelName(id: string): string
{
    const match = /(fable|mythos|opus|sonnet|haiku)-(\d+)(?:-(\d{1,2})(?!\d))?/i.exec(id);

    if (!match) {
        return id.replace(/^claude-/, "").replace(/\[.*\]$/, "") || "—";
    }

    const [, family = "", major = "", minor] = match;
    return `${family.charAt(0).toUpperCase()}${family.slice(1).toLowerCase()} ${major}${minor ? `.${minor}` : ""}`;
}

/** The context window of a model, to show how full a colleague's context is. */
export function contextWindowOf(model: string): number
{
    return /haiku/i.test(model) ? 200_000 : 1_000_000;
}

/** A first name as a key, compared as the project plugin compares them: without case or accents, so «Nicolo» is «Nicolò». */
export function nameKey(name: string): string
{
    return name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** A line's first letter in capitals: "done in 3 min" opens a line as "Done in 3 min". */
export function capitalized(text: string): string
{
    return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}

/** A text cut at `length` characters, an ellipsis at its end. */
export function clip(text: string, length: number): string
{
    return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

/** A task as one plain line: markdown marks and line breaks out. */
export function plainText(markdown: string): string
{
    return markdown.replace(/[`*_]/g, "").replace(/\s+/g, " ").trim();
}

/** A task's words as plainText draws them, its links apart and whole, underscores and all. */
export function taskParts(markdown: string): (string | WebLink)[]
{
    return linksIn(markdown.replace(/\s+/g, " ").trim()).map(part => (typeof part === "string" ? part.replace(/[`*_]/g, "") : part));
}

/** What a colleague is doing, without their name in front: "Tommaso: naming" is "Naming" on Tommaso's card. */
export function withoutName(task: string, colleague: Colleague): string
{
    const names = [colleague.fullName, colleague.name].map(name => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const rest = task.replace(new RegExp(`^\\s*(?:${names.join("|")})\\s*[:\\-–—,]?\\s*`, "i"), "").trim() || task;
    return capitalized(rest);
}
