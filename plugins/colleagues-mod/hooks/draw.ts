// The desktop drawings: each row is one SVG, because the desktop wraps sibling elements onto new lines. The way of drawing rows
// as SVG, the text measuring and the light and dark colors come from savvy-progress by johnnyvizz (MIT).
import type { Budget, Colleague, Run } from "../types";

import { formatTime, formatTokens, formatUntil, modelName, words } from "./text.ts";

export const font = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',sans-serif";
const theme = `<style>
.t{fill:#1f1f1f}.s{fill:#6b6b68}.m{fill:#9a9a96}.k{fill:#ecebe8}.ln{stroke:#e4e4e1}.tile{fill:#f4f3f0}.ring{stroke:#ffffff}
@media (prefers-color-scheme: dark){.t{fill:#ececec}.s{fill:#a8a8a4}.m{fill:#7d7d79}.k{fill:#2c2c2b}.ln{stroke:#333331}.tile{fill:#262625}.ring{stroke:#1f1f1e}}
.live{animation:p 1.6s ease-in-out infinite}@keyframes p{50%{opacity:.3}}
@media (prefers-reduced-motion: reduce){.live{animation:none}}
</style>`;

export type Words = (typeof words)["en"];
export type Portraits = ReadonlyMap<string, string>;

export const runHeight = 70;
export const idleHeight = 52;
export const headerHeight = 48;
export const meetingHeight = 40;
export const speakerHeight = 30;

/** The tiles on top: the week's and the five hours' budget, the colleagues' tokens and time in this session. */
export function headerSvg(width: number, budget: Budget[], runs: Run[], now: number, say: Words): string
{
    const week = budget.find(window => window.kind === "seven_day");
    const hours = budget.find(window => window.kind === "five_hour");
    const tiles = [
        ...(week ? [{ label: say.week, value: `${Math.round(week.percentUsed)}%`, note: resetNote(week, now), share: week.percentUsed / 100 }] : []),
        ...(hours ? [{ label: say.hours, value: `${Math.round(hours.percentUsed)}%`, note: resetNote(hours, now), share: hours.percentUsed / 100 }] : []),
        { label: `${say.tokens} · ${say.time}`, value: `${formatTokens(runs.reduce((sum, run) => sum + run.tokens, 0))} · ${formatTime(totalTime(runs, now))}`, note: "", share: undefined },
    ];
    const gap = 6;
    const tileWidth = (width - gap * (tiles.length - 1)) / tiles.length;
    const body = tiles.map((tile, index) => {
        const x = index * (tileWidth + gap);
        const bar = tile.share === undefined ? ""
            : `<rect class="k" x="${x + 9}" y="38" width="${tileWidth - 18}" height="3" rx="1.5"/><rect x="${x + 9}" y="38" width="${Math.max(0, Math.min(1, tile.share)) * (tileWidth - 18)}" height="3" rx="1.5" fill="${shareColor(tile.share)}"/>`;
        return `<rect class="tile" x="${x}" y="0" width="${tileWidth}" height="${headerHeight}" rx="8"/>
<text class="s" x="${x + 9}" y="15" font-family="${font}" font-size="11">${xml(fitText(tile.label, 11, tileWidth - 18 - (tile.note ? measure(tile.note, 10) + 6 : 0)))}</text>
${tile.note ? `<text class="m" x="${x + tileWidth - 9}" y="15" text-anchor="end" font-family="${font}" font-size="10" font-variant-numeric="tabular-nums">${xml(tile.note)}</text>` : ""}
<text class="t" x="${x + 9}" y="31" font-family="${font}" font-size="15" font-weight="600" font-variant-numeric="tabular-nums">${xml(fitText(tile.value, 15, tileWidth - 18))}</text>${bar}`;
    });
    return svg(width, headerHeight, body.join(""));
}

/** Who is in the conversation, the last speaker ringed in their color. */
export function meetingSvg(width: number, members: Colleague[], last: Colleague | undefined, portraits: Portraits, say: Words): string
{
    const size = 28;
    const faces = members.map((member, index) => avatar(member, portraits, 72 + index * (size - 6), 6, size, member === last ? member.color : undefined)).join("");
    const textX = 72 + members.length * (size - 6) + 14;
    const names = members.map(member => member.name).join(", ");
    const line = last ? `${say.speaking}: ${last.name}` : names;
    return svg(width, meetingHeight, `<text class="s" x="0" y="25" font-family="${font}" font-size="12" font-weight="600">${xml(say.meeting)}</text>${faces}
<text class="t" x="${textX}" y="25" font-family="${font}" font-size="12">${xml(fitText(line, 12, width - textX))}</text>`);
}

/** A colleague at work, or done: portrait, name and role, task, model and effort, the steps they report, context, tokens, time. */
export function runSvg(width: number, run: Run, colleague: Colleague, portraits: Portraits, now: number, say: Words): string
{
    const textX = 56;
    const textWidth = width - textX - 22;
    const context = contextShare(run);
    const progress = progressOf(run);
    const meta = [run.task, run.effort ? `${modelName(run.model)} · ${run.effort}` : modelName(run.model), run.status === "failed" ? say.failed : ""].filter(Boolean).join("  ·  ");
    const steps = run.stepTotal ? `${run.stepDone ?? 0}/${run.stepTotal}${run.stepNote ? ` · ${run.stepNote}` : ""}` : "";
    const stats = `ctx ${Math.round(context * 100)}% · ${formatTokens(run.tokens)} · ${formatTime((run.endedAt ?? Math.max(now, run.startedAt)) - run.startedAt)}`;
    const stepsWidth = Math.max(0, textWidth - measure(stats, 11) - 12);
    const fill = Math.round(textWidth * (progress ?? context));
    return svg(width, runHeight, `${avatar(colleague, portraits, 0, 12, 44, colleague.color)}
${run.status === "running" ? `<circle class="live ring" cx="40" cy="50" r="5" fill="${colleague.color}" stroke-width="2"/>` : ""}
${nameLine(colleague, textX, 18, textWidth)}
<text class="s" x="${textX}" y="34" font-family="${font}" font-size="11">${xml(fitText(meta, 11, textWidth))}</text>
${steps && stepsWidth > 30 ? `<text class="t" x="${textX}" y="50" font-family="${font}" font-size="11" font-variant-numeric="tabular-nums">${xml(fitText(steps, 11, stepsWidth))}</text>` : ""}
<text class="s" x="${textX + textWidth}" y="50" text-anchor="end" font-family="${font}" font-size="11" font-variant-numeric="tabular-nums">${stats}</text>
<rect class="k" x="${textX}" y="57" width="${textWidth}" height="4" rx="2"/><rect${progress === undefined ? ' class="m"' : ""} x="${textX}" y="57" width="${fill}" height="4" rx="2"${progress === undefined ? "" : ` fill="${colleague.color}"`}/>
${statusMark(width - 8, 16, run.status, colleague.color)}
<line class="ln" x1="0" y1="${runHeight - 0.5}" x2="${width}" y2="${runHeight - 0.5}"/>`);
}

/** A colleague who is not at work: portrait, name and role, open tasks, model and effort; ringed while in the conversation. */
export function idleSvg(width: number, colleague: Colleague, portraits: Portraits, say: Words, presence?: "member" | "speaking"): string
{
    const textX = 48;
    const textWidth = width - textX;
    const meta = [presence === "speaking" ? say.speaking : presence ? say.inMeeting : "", say.toDo(colleague.openTasks), colleague.model ? modelName(colleague.model) : "", colleague.effort ?? ""].filter(Boolean).join("  ·  ");
    return svg(width, idleHeight, `${avatar(colleague, portraits, 0, 8, 36, presence ? colleague.color : undefined)}
${nameLine(colleague, textX, 22, textWidth)}
<text class="m" x="${textX}" y="38" font-family="${font}" font-size="11">${xml(fitText(meta, 11, textWidth))}</text>
<line class="ln" x1="0" y1="${idleHeight - 0.5}" x2="${width}" y2="${idleHeight - 0.5}"/>`);
}

/** The head of a colleague's turn in the chat: portrait, name in their color, role. */
export function speakerSvg(width: number, colleague: Colleague, portraits: Portraits): string
{
    const nameWidth = measure(colleague.fullName, 13) + 10;
    return svg(width, speakerHeight, `${avatar(colleague, portraits, 1, 2, 26)}
<text x="36" y="20" font-family="${font}" font-size="13" font-weight="600" fill="${colleague.color}">${xml(colleague.fullName)}</text>
<text class="s" x="${36 + nameWidth}" y="20" font-family="${font}" font-size="11">${xml(fitText(colleague.role, 11, Math.max(0, width - 36 - nameWidth)))}</text>`);
}

/** The steps a colleague reported, or nothing until they report; a finished run is full. */
export function progressOf(run: Run): number | undefined
{
    if (run.status === "done") {
        return 1;
    }

    return run.stepTotal ? Math.min(1, (run.stepDone ?? 0) / run.stepTotal) : undefined;
}

export function contextShare(run: Run): number
{
    return run.contextMax ? Math.min(1, run.contextTokens / run.contextMax) : 0;
}

// The portrait in a circle, or the initials on the colleague's color when there is none.
function avatar(colleague: Colleague, portraits: Portraits, x: number, y: number, size: number, ring?: string): string
{
    const radius = size / 2;
    const centerX = x + radius;
    const centerY = y + radius;
    const clip = `c${Math.round(x)}x${Math.round(y)}`;
    const uri = portraits.get(colleague.id);
    const initials = colleague.fullName.split(/\s+/).map(part => part[0] ?? "").join("").slice(0, 2).toUpperCase();
    const face = uri
        ? `<clipPath id="${clip}"><circle cx="${centerX}" cy="${centerY}" r="${radius}"/></clipPath><image href="${uri}" x="${x}" y="${y}" width="${size}" height="${size}" clip-path="url(#${clip})" preserveAspectRatio="xMidYMid slice"/>`
        : `<circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="${colleague.color}"/><text x="${centerX}" y="${centerY + size * 0.14}" text-anchor="middle" font-family="${font}" font-size="${size * 0.38}" font-weight="600" fill="#ffffff">${xml(initials)}</text>`;
    return face + (ring ? `<circle cx="${centerX}" cy="${centerY}" r="${radius + 1}" fill="none" stroke="${ring}" stroke-width="2"/>` : "");
}

function nameLine(colleague: Colleague, x: number, y: number, width: number): string
{
    const name = fitText(colleague.fullName, 13, width);
    const roleX = x + measure(name, 13) + 8;
    const role = fitText(colleague.role, 11, Math.max(0, x + width - roleX - 14));
    return `<text class="t" x="${x}" y="${y}" font-family="${font}" font-size="13" font-weight="600">${xml(name)}</text>
${role ? `<text x="${roleX}" y="${y}" font-family="${font}" font-size="11" fill="${colleague.color}">${xml(role)}</text>` : ""}`;
}

function statusMark(x: number, y: number, status: Run["status"], color: string): string
{
    if (status === "running") {
        return `<circle class="live" cx="${x}" cy="${y}" r="3.5" fill="${color}"/>`;
    }

    if (status === "done") {
        return `<path d="M${x - 5} ${y}l3.5 3.5 6.5-7" fill="none" stroke="#3B9C5F" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
    }

    return `<path d="M${x - 4} ${y - 4}l8 8M${x + 4} ${y - 4}l-8 8" stroke="#D0453F" stroke-width="1.8" stroke-linecap="round"/>`;
}

function resetNote(window: Budget, now: number): string
{
    const until = formatUntil(window.resetsAt, now);
    return until ? `↻ ${until}` : "";
}

function shareColor(share: number): string
{
    return share >= 0.9 ? "#D0453F" : share >= 0.7 ? "#D9773A" : "#4E9A6B";
}

function totalTime(runs: Run[], now: number): number
{
    if (!runs.length) {
        return 0;
    }

    const start = Math.min(...runs.map(run => run.startedAt));
    const end = Math.max(...runs.map(run => run.endedAt ?? Math.max(now, run.startedAt)));
    return end - start;
}

function svg(width: number, height: number, body: string): string
{
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${theme}${body}</svg>`;
}

function xml(text: string): string
{
    return text.replace(/[&<>"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[character] ?? character);
}

// A rough advance of system UI text, in em: enough to fit a text into its slot.
function measure(text: string, size: number): number
{
    return [...text].reduce((sum, character) => sum + (/[\s.,:;'|!il1()[\]]/.test(character) ? 0.3 : /[A-Zmw@%]/.test(character) ? 0.72 : 0.56) * size, 0);
}

function fitText(text: string, size: number, width: number): string
{
    if (measure(text, size) <= width) {
        return text;
    }

    let fitted = "";

    for (const character of text) {
        if (measure(`${fitted}${character}…`, size) > width) {
            break;
        }

        fitted += character;
    }

    return `${fitted}…`;
}
