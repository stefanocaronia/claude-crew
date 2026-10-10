// A flat geometric cartoon portrait in SVG: a big rounded head, big eyes, flat colors, no outlines.
// node vector-portrait.mjs <out.svg> '<json>' with the same traits as pixel-portrait.mjs: background, skin, hair, hairStyle (short,
// bob, long, curly, bun, ponytail, bald), clothes, neckline (crew, v, collar), glasses (none, square, round), beard (none,
// stubble, full), accessory (none, pencil, headphones, earrings, scarf). Square, no text, for panels that crop it to a circle.
import { writeFileSync } from "node:fs";

const defaults = { background: "#888780", skin: "#E3B08D", hair: "#3B2A20", hairStyle: "short", clothes: "#2F3640", neckline: "crew", glasses: "none", beard: "none", accessory: "none" };
const [output, json] = process.argv.slice(2);

if (!output) {
    process.stderr.write("Usage: node vector-portrait.mjs <out.svg> '{\"background\":\"#D9773A\",\"hairStyle\":\"bob\",...}'\n");
    process.exit(1);
}

const t = { ...defaults, ...JSON.parse(json ?? "{}") };
const shade = (color, amount) => `#${color.replace("#", "").match(/../g).map(part => Math.max(0, Math.min(255, Math.round(parseInt(part, 16) * amount))).toString(16).padStart(2, "0")).join("")}`;
const ink = "#2B2421";
const parts = [
    `<rect width="128" height="128" fill="${t.background}"/>`,
    hairBehind(),
    body(),
    `<rect x="55" y="76" width="18" height="20" rx="6" fill="${shade(t.skin, 0.86)}"/>`,
    accessory("behind"),
    `<circle cx="34" cy="60" r="7" fill="${t.skin}"/><circle cx="94" cy="60" r="7" fill="${shade(t.skin, 0.92)}"/>`,
    `<rect x="34" y="24" width="60" height="64" rx="29" fill="${t.skin}"/>`,
    `<path d="M64 24h1c16 0 29 13 29 29v6c0 16-13 29-29 29h-1z" fill="${shade(t.skin, 0.95)}"/>`,
    beard(),
    hair(),
    face(),
    glasses(),
    accessory("front"),
];
writeFileSync(output, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">${parts.join("")}</svg>\n`);
console.log(`saved ${output}`);

function body()
{
    const shirt = `<path d="M18 128c0-22 18-34 46-34s46 12 46 34z" fill="${t.clothes}"/>`;

    if (t.neckline === "v") {
        return `${shirt}<path d="M54 94h20l-10 14z" fill="${shade(t.skin, 0.9)}"/>`;
    }

    if (t.neckline === "collar") {
        return `${shirt}<path d="M50 94l14 10-6 8-12-14zM78 94l-14 10 6 8 12-14z" fill="#F4F2EC"/>`;
    }

    return `${shirt}<path d="M52 94c2 6 7 9 12 9s10-3 12-9z" fill="${shade(t.clothes, 0.8)}"/>`;
}

function hairBehind()
{
    if (t.hairStyle === "long") {
        return `<path d="M28 58c0-26 16-40 36-40s36 14 36 40v52H28z" fill="${shade(t.hair, 0.9)}"/>`;
    }

    if (t.hairStyle === "ponytail") {
        return `<path d="M88 40c14 2 20 16 16 34-2 10-8 16-10 22-4-10-4-22-2-32z" fill="${shade(t.hair, 0.9)}"/>`;
    }

    if (t.hairStyle === "bob") {
        return `<path d="M30 60c0-24 14-38 34-38s34 14 34 38v22c0 4-4 6-8 6H38c-4 0-8-2-8-6z" fill="${shade(t.hair, 0.9)}"/>`;
    }

    return "";
}

function hair()
{
    const color = t.hair;
    const light = shade(color, 1.25);

    switch (t.hairStyle) {
        case "bald":
            return `<path d="M33 52c0-6 3-9 5-10v14zM95 52c0-6-3-9-5-10v14z" fill="${color}"/>`;
        case "curly":
            return [[44, 30, 12], [58, 24, 13], [74, 24, 13], [88, 32, 11], [36, 42, 9], [94, 44, 9], [66, 32, 10]]
                .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}"/>`).join("") + `<circle cx="58" cy="22" r="4" fill="${light}"/>`;
        case "bun":
            return `<circle cx="64" cy="16" r="12" fill="${color}"/><path d="M34 54c0-20 12-32 30-32s30 12 30 32c-6-12-16-18-30-18s-24 6-30 18z" fill="${color}"/><circle cx="60" cy="13" r="3" fill="${light}"/>`;
        default:
            return `<path d="M33 56c-2-22 12-36 31-36s33 14 31 36c-4-10-10-16-18-18-6 6-16 9-28 8-6 0-12 4-16 10z" fill="${color}"/><path d="M52 26c6-2 14-2 20 0-6 1-14 1-20 0z" fill="${light}"/>`;
    }
}

function face()
{
    const eye = x => `<ellipse cx="${x}" cy="60" rx="7" ry="8" fill="#FFFFFF"/><circle cx="${x + 1}" cy="61" r="4" fill="${ink}"/><circle cx="${x + 2.5}" cy="59" r="1.4" fill="#FFFFFF"/>`;
    const brow = x => `<path d="M${x - 6} 48q6-4 12 0" fill="none" stroke="${t.hair === "#FFFFFF" ? ink : t.hair}" stroke-width="3" stroke-linecap="round"/>`;
    return [
        brow(52), brow(76), eye(52), eye(76),
        `<ellipse cx="44" cy="72" rx="5" ry="3" fill="#F28B82" opacity=".35"/><ellipse cx="84" cy="72" rx="5" ry="3" fill="#F28B82" opacity=".35"/>`,
        `<ellipse cx="64" cy="70" rx="4" ry="3" fill="${shade(t.skin, 0.8)}"/>`,
        `<path d="M56 78q8 7 16 0" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`,
    ].join("");
}

function beard()
{
    if (t.beard === "none") {
        return "";
    }

    const opacity = t.beard === "stubble" ? ' opacity=".3"' : "";
    return `<path d="M35 62c2 20 14 30 29 30s27-10 29-30c-4 10-10 16-17 18-4-4-8-5-12-5s-8 1-12 5c-7-2-13-8-17-18z" fill="${t.hair}"${opacity}/>`;
}

function glasses()
{
    if (t.glasses === "none") {
        return "";
    }

    const frame = `fill="none" stroke="${ink}" stroke-width="2.5"`;
    const lenses = t.glasses === "round"
        ? `<circle cx="52" cy="60" r="11" ${frame}/><circle cx="76" cy="60" r="11" ${frame}/>`
        : `<rect x="40" y="50" width="24" height="20" rx="5" ${frame}/><rect x="64" y="50" width="24" height="20" rx="5" ${frame}/>`;
    return `${lenses}<path d="M63 58h2" ${frame}/>`;
}

function accessory(layer)
{
    if (t.accessory === "headphones" && layer === "front") {
        return `<path d="M30 60c0-24 14-40 34-40s34 16 34 40" fill="none" stroke="#2C2C2B" stroke-width="6" stroke-linecap="round"/><rect x="24" y="52" width="12" height="20" rx="5" fill="#3F3F3D"/><rect x="92" y="52" width="12" height="20" rx="5" fill="#3F3F3D"/>`;
    }

    if (t.accessory === "pencil" && layer === "front") {
        return `<g transform="rotate(-35 96 40)"><rect x="90" y="22" width="7" height="34" rx="1" fill="#F2C744"/><rect x="90" y="22" width="7" height="5" fill="#F2A0A0"/><path d="M90 56h7l-3.5 7z" fill="#E8D2B0"/><path d="M92.5 61h2l-1 2z" fill="${ink}"/></g>`;
    }

    if (t.accessory === "earrings" && layer === "front") {
        return `<circle cx="33" cy="70" r="3" fill="#E8C35A"/><circle cx="95" cy="70" r="3" fill="#E8C35A"/>`;
    }

    if (t.accessory === "scarf" && layer === "front") {
        return `<path d="M44 90c10 6 30 6 40 0l2 8c-12 7-32 7-44 0z" fill="#C9553A"/><path d="M70 96l8 20h-9l-5-18z" fill="#B44A31"/>`;
    }

    return "";
}
