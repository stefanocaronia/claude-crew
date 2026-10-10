// The only drawings the panel makes: a colleague's portrait in a circle and a progress bar, each at a fixed size, so the window's
// width never shrinks them; the text around them is the surface's own. The light and dark colors follow savvy-progress by
// johnnyvizz (MIT).
import type { Colleague } from "../types";

const font = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',sans-serif";
const theme = `<style>
.k{fill:#e4e4e1}.edge{stroke:#ffffff}
@media (prefers-color-scheme: dark){.k{fill:#333331}.edge{stroke:#1f1f1e}}
.live{animation:p 1.6s ease-in-out infinite}@keyframes p{50%{opacity:.35}}
@media (prefers-reduced-motion: reduce){.live{animation:none}}
</style>`;

/** The portrait in a circle, or the initials on the colleague's color; a ring in their color, and a pulsing dot while they work. */
export function avatarSvg(colleague: Colleague, uri: string | undefined, size: number, isRinged = false, isWorking = false): string
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
    return svg(size, size, face + ring + dot);
}

/** A thin bar: the steps a colleague reported, in their color, or how full their context is, in gray. */
export function barSvg(share: number, color: string | undefined, width: number): string
{
    const height = 6;
    const fill = Math.round(width * Math.max(0, Math.min(1, share)));
    return svg(width, height, `<rect class="k" width="${width}" height="${height}" rx="3"/><rect width="${fill}" height="${height}" rx="3" fill="${color ?? "#8a8a86"}"/>`);
}

function svg(width: number, height: number, body: string): string
{
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${theme}${body}</svg>`;
}

function xml(text: string): string
{
    return text.replace(/[&<>"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[character] ?? character);
}
