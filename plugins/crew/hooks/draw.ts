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
export function barSvg(share: number, color: string | undefined, width: number): string
{
    const height = 6;
    const fill = Math.round(width * Math.max(0, Math.min(1, share)));
    return svg(width, height, `<rect class="k" width="${width}" height="${height}" rx="3"/><rect width="${fill}" height="${height}" rx="3" fill="${color ?? "#8a8a86"}"/>`);
}

/** A small line icon for the usage cards: a clock for the five hours, a calendar for the week, a bolt for the colleagues' work. */
export function iconSvg(name: "clock" | "calendar" | "bolt" | "pencil", size: number): string
{
    const stroke = `fill="none" stroke="#8a8a86" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
    const shapes = {
        clock: `<circle cx="12" cy="12" r="9" ${stroke}/><path d="M12 7v5l3 2" ${stroke}/>`,
        calendar: `<rect x="3.5" y="5" width="17" height="15" rx="2.5" ${stroke}/><path d="M3.5 10h17M8 3v4M16 3v4" ${stroke}/>`,
        bolt: `<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z" ${stroke}/>`,
        pencil: `<path d="M4 20h4L19 9l-4-4L4 16z" ${stroke}/><path d="M13.5 6.5l4 4" ${stroke}/>`,
    };
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">${shapes[name]}</svg>`;
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
    const filled = ({ low: 1, medium: 2, high: 3, xhigh: 4, max: 4 } as Record<string, number>)[level.toLowerCase()];

    if (!filled) {
        return undefined;
    }

    const bars = [0, 1, 2, 3].map(index => `<rect x="${index * 4}" y="1" width="3" height="10" rx="1" fill="#8a8a86" fill-opacity="${index < filled ? 1 : 0.3}"/>`).join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="12" viewBox="0 0 16 12">${bars}</svg>`;
}

/** The bar across a card: drawn 300 wide and stretched to the room it is given, its ends still round at the usual widths. */
export function wideBarSvg(share: number, color: string | undefined): string
{
    const fill = Math.round(300 * Math.max(0, Math.min(1, share)));
    return `<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="6" viewBox="0 0 300 6" preserveAspectRatio="none">${theme}<rect class="k" width="300" height="6" rx="3"/><rect width="${fill}" height="6" rx="3" fill="${color ?? "#8a8a86"}"/></svg>`;
}

function svg(width: number, height: number, body: string, isThemed = true): string
{
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${isThemed ? theme : ""}${body}</svg>`;
}

function xml(text: string): string
{
    return text.replace(/[&<>"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[character] ?? character);
}
