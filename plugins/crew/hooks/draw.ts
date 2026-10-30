// The only drawings the panel makes: a colleague's portrait in a circle and a progress bar, each at a fixed size, so the window's
// width never shrinks them; the text around them is the surface's own. The light and dark colors follow savvy-progress by
// johnnyvizz (MIT).
import type { Speaker } from "../types";

const font = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',sans-serif";
const theme = `<style>
.k{fill:#e4e4e1}.edge{stroke:#ffffff}
@media (prefers-color-scheme: dark){.k{fill:#333331}.edge{stroke:#1f1f1e}}
.live{animation:p 1.6s ease-in-out infinite}@keyframes p{50%{opacity:.35}}
@media (prefers-reduced-motion: reduce){.live{animation:none}}
</style>`;

/** The portrait in a circle, or the initials on the colleague's color; a ring in their color, and a pulsing dot while they work. */
export function avatarSvg(colleague: Speaker, uri: string | undefined, size: number, isRinged = false, isWorking = false): string
{
    const inset = isRinged ? 3 : 0;
    const radius = size / 2 - inset;
    const center = size / 2;
    const initials = colleague.fullName.split(/\s+/).map(part => part[0] ?? "").join("").slice(0, 2).toUpperCase();
    const face = uri
        ? `<clipPath id="face"><circle cx="${center}" cy="${center}" r="${radius}"/></clipPath><image href="${uri}" x="${inset}" y="${inset}" width="${radius * 2}" height="${radius * 2}" clip-path="url(#face)" preserveAspectRatio="xMidYMid slice"/>`
        : `<circle cx="${center}" cy="${center}" r="${radius}" fill="${colleague.color}"/><text x="${center}" y="${center + radius * 0.28}" text-anchor="middle" font-family="${font}" font-size="${radius * 0.78}" font-weight="600" fill="#ffffff">${xml(initials)}</text>`;
    const ring = isRinged ? `<circle cx="${center}" cy="${center}" r="${radius + 1.5}" fill="none" stroke="${colleague.color}" stroke-width="2"/>` : "";
    const dot = isWorking ? `<circle class="live edge" cx="${size - 6}" cy="${size - 6}" r="5" fill="${colleague.color}" stroke-width="2"/>` : "";
    return svg(size, size, face + ring + dot, isWorking);
}

/** A thin bar: the steps a colleague reported, in their color, or how full their context is, in gray. */
/** Claude in a meeting's chat: an orange pixel critter of our own, on a round cream background as the colleagues' portraits are round. */
export function claudeSvg(size: number): string
{
    const rows = [".X........X.", "..X......X..", "..XXXXXXXX..", ".XXXXXXXXXX.", ".XXEEXXEEXX.", "XXXEEXXEEXXX", "XXXXXXXXXXXX", ".XXXXXXXXXX.", "..X.X..X.X..", "..X.X..X.X.."];
    // Each run of one color on a row is one rectangle, so no seam shows between pixels.
    const runs = rows.flatMap((row, y) => [...row.matchAll(/X+|E+/g)].map(run => `<rect x="${(run.index ?? 0) + 2}" y="${y + 3}" width="${run[0].length}" height="1" fill="${run[0][0] === "E" ? "#2B1D17" : "#D97757"}"/>`));
    // A smooth circle; only the critter inside is drawn in pixels.
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="${size}" height="${size}"><circle cx="8" cy="8" r="8" fill="#F3E6DC"/><g shape-rendering="crispEdges">${runs.join("")}</g></svg>`;
}

/** A small line icon: a clock for time, a calendar, a bolt for the colleagues' work, a pencil, their memory. */
export function iconSvg(name: "clock" | "calendar" | "bolt" | "pencil" | "memory", size: number, top = 0, color = "#8a8a86"): string
{
    const stroke = `fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
    const shapes = {
        clock: `<circle cx="12" cy="12" r="9" ${stroke}/><path d="M12 7v5l3 2" ${stroke}/>`,
        calendar: `<rect x="3.5" y="5" width="17" height="15" rx="2.5" ${stroke}/><path d="M3.5 10h17M8 3v4M16 3v4" ${stroke}/>`,
        bolt: `<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z" ${stroke}/>`,
        pencil: `<path d="M4 20h4L19 9l-4-4L4 16z" ${stroke}/><path d="M13.5 6.5l4 4" ${stroke}/>`,
        memory: `<rect x="6" y="6" width="12" height="12" rx="2" ${stroke}/><path d="M10 2.5v3.5M14 2.5v3.5M10 18v3.5M14 18v3.5M2.5 10h3.5M2.5 14h3.5M18 10h3.5M18 14h3.5" ${stroke}/>`,
    };
    // `top` pixels of room above the icon, drawn into the picture: the surface's margins come in whole rows.
    const room = (top * 24) / size;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size + top}" viewBox="0 ${-room} 24 ${24 + room}">${shapes[name]}</svg>`;
}

// The style block only where a drawing uses it: every character is carried in the panel's drawing, once per picture.
// Each colleague color in a dark tint for the light theme and a light one for the dark theme, both readable in bold.
const tints: Record<string, [string, string]> = {
    red: ["#b42318", "#f87171"],
    blue: ["#1d4ed8", "#6ea8fe"],
    green: ["#15803d", "#4ade80"],
    yellow: ["#8a6100", "#facc15"],
    purple: ["#7e22ce", "#c084fc"],
    orange: ["#c2410c", "#fb923c"],
    pink: ["#be185d", "#f472b6"],
    cyan: ["#0e7490", "#22d3ee"],
};

/** A square checkbox, 14 px: an outline, or filled in the colleague's light tint with a check. */
export function checkboxSvg(isChecked: boolean, color: string): string
{
    const tint = tints[color.toLowerCase()]?.[1] ?? (/^#[0-9a-f]{6}$/i.test(color) ? color : "#8a8a86");
    const box = isChecked
        ? `<rect x="1" y="1" width="12" height="12" rx="3" fill="${tint}"/><path d="M4 7.2l2 2 4-4.4" fill="none" stroke="#1f1f1e" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`
        : `<rect x="1.5" y="1.5" width="11" height="11" rx="2.5" fill="none" stroke="#8a8a86" stroke-width="1.2"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14">${box}</svg>`;
}

/** A task's priority as an issue tracker draws it: P1 two red chevrons up, P2 an orange equals, P3 a blue chevron down; undefined
 * for a priority it does not know. */
export function prioritySvg(priority: string): string | undefined
{
    const stroke = (color: string) => `fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"`;
    const marks: Record<string, string> = {
        P1: `<path d="M3.5 7.5L7 4l3.5 3.5M3.5 11L7 7.5l3.5 3.5" ${stroke("#E5493A")}/>`,
        P2: `<path d="M3 5.5h8M3 8.5h8" ${stroke("#E2852B")}/>`,
        P3: `<path d="M3.5 5.5L7 9l3.5-3.5" ${stroke("#4C8FE0")}/>`,
    };
    const mark = marks[priority];
    return mark ? `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14">${mark}</svg>` : undefined;
}

/** A task's type as Jira draws an issue type, as the project plugin's panel does: a rounded square in its color with a white sign,
 * a bug a dot, a feature a bookmark, a chore a tick, a research a lens; a type of the project's own its first letter. */
export function typeSvg(type: string): string
{
    const signs: Record<string, string> = {
        bug: `<circle cx="7" cy="7" r="2.6" fill="#ffffff"/>`,
        feature: `<path d="M4.5 3.5h5v7L7 8.6 4.5 10.5z" fill="#ffffff"/>`,
        chore: `<path d="M4 7.2l2 2 4-4.4" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
        research: `<circle cx="6.3" cy="6.3" r="2.4" fill="none" stroke="#ffffff" stroke-width="1.5"/><path d="M8.1 8.1l2.2 2.2" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round"/>`,
    };
    const sign = signs[type] ?? `<text x="7" y="10" text-anchor="middle" font-family="${font}" font-size="8" font-weight="700" fill="#ffffff">${xml(type.slice(0, 1).toUpperCase())}</text>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14"><rect x="0.5" y="0.5" width="13" height="13" rx="3" fill="${typeColor(type)}"/>${sign}</svg>`;
}

/** A task type's color, as Jira's issue types: a bug red, a feature green, a chore blue, a research purple; others gray. */
export function typeColor(type: string): string
{
    return ({ bug: "#E5493A", feature: "#36B37E", chore: "#4C9AFF", research: "#8777D9" } as Record<string, string>)[type] ?? "#8993A4";
}

/** A colleague's color as a faint background, for a card that is picked: its light tint at a tenth, readable in either theme. */
export function pickedTint(color: string): string
{
    const tint = tints[color.toLowerCase()]?.[1] ?? (/^#[0-9a-f]{6}$/i.test(color) ? color : "#808080");
    return `${tint}1f`;
}

/** A colleague's name drawn in bold at `size` px, in their color as the theme reads best; its width estimated from the letters. */
export function nameSvg(name: string, color: string, size: number): { source: string; width: number; height: number }
{
    const [light, dark] = tints[color.toLowerCase()] ?? [color, color];
    const width = Math.ceil(name.length * size * 0.6) + 4;
    const height = Math.ceil(size * 1.35);
    const style = `<style>.n{fill:${light}}@media (prefers-color-scheme: dark){.n{fill:${dark}}}</style>`;
    const text = `<text class="n" x="0" y="${Math.round(size * 1.02)}" font-family="${font}" font-size="${size}" font-weight="600">${xml(name)}</text>`;
    return { source: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${style}${text}</svg>`, width, height };
}

/** A line of gray text drawn small, as the role under a name, with `below` pixels of room under it. */
export function captionSvg(text: string, size: number, below = 0): { source: string; width: number; height: number }
{
    const width = Math.ceil(text.length * size * 0.56) + 4;
    const height = Math.ceil(size * 1.35) + below;
    const style = "<style>.c{fill:#6b6b67}@media (prefers-color-scheme: dark){.c{fill:#a3a39e}}</style>";
    const line = `<text class="c" x="0" y="${Math.round(size * 1.02)}" font-family="${font}" font-size="${size}">${xml(text)}</text>`;
    return { source: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${style}${line}</svg>`, width, height };
}

/** A picture fitted whole in a box of the given size, as a thumbnail. */
export function thumbnailSvg(uri: string, width: number, height: number): string
{
    return svg(width, height, `<image href="${uri}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet"/>`, false);
}

/** Empty room of a given size, to keep a column where a portrait would be. */
export function blankSvg(width: number, height: number): string
{
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"></svg>`;
}

/** The effort a task needs as four gray bars, low to max; undefined for a level it does not know. */
export function effortSvg(level: string): string | undefined
{
    // No level is the session's own effort: the four bars, none filled.
    const filled = level ? ({ low: 1, medium: 2, high: 3, xhigh: 4, max: 4 } as Record<string, number>)[level.toLowerCase()] : 0;

    if (filled === undefined) {
        return undefined;
    }

    const bars = [0, 1, 2, 3].map(index => `<rect x="${index * 4}" y="1" width="3" height="10" rx="1" fill="#8a8a86" fill-opacity="${index < filled ? 1 : 0.3}"/>`).join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="12" viewBox="0 0 16 12">${bars}</svg>`;
}

/** A wide bar's square middle, filled or the track, stretched to the room it is given: its rounded ends are `barEndSvg`. */
export function wideBarSvg(color: string | undefined, isFilled: boolean): string
{
    const paint = isFilled ? `fill="${color ?? "#8a8a86"}"` : `class="k"`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="6" viewBox="0 0 300 6" preserveAspectRatio="none">${theme}<rect ${paint} width="300" height="6"/></svg>`;
}

/** A rounded end of a wide bar, 3 px wide and never stretched: in the bar's color where it is filled, else the track's; the filled
 * part's end over the track, where the track goes on after it. */
export function barEndSvg(side: "start" | "end", color: string | undefined, isFilled: boolean, isOverTrack = false): string
{
    const half = side === "start" ? "M3 0A3 3 0 0 0 3 6Z" : "M0 0A3 3 0 0 1 0 6Z";
    const track = isOverTrack ? `<rect class="k" width="3" height="6"/>` : "";
    return svg(3, 6, track + (isFilled ? `<path d="${half}" fill="${color ?? "#8a8a86"}"/>` : `<path class="k" d="${half}"/>`));
}

function svg(width: number, height: number, body: string, isThemed = true): string
{
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${isThemed ? theme : ""}${body}</svg>`;
}

function xml(text: string): string
{
    return text.replace(/[&<>"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[character] ?? character);
}
