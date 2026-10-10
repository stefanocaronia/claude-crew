// A pixel-art portrait, 32×32 cells, from a few traits: node pixel-portrait.mjs <out.svg> '<json>'
// Traits: background, skin, hair (color), hairStyle (short, bob, long, curly, bun, ponytail, bald), clothes, neckline (crew, v,
// collar), glasses (none, square, round), beard (none, stubble, full), accessory (none, pencil, headphones, earrings, scarf).
// Unknown traits fall back to the defaults; the portrait is square, with no text, for panels that crop it to a circle.
import { writeFileSync } from "node:fs";

const defaults = { background: "#888780", skin: "#E3B08D", hair: "#3B2A20", hairStyle: "short", clothes: "#2F3640", neckline: "crew", glasses: "none", beard: "none", accessory: "none" };
const [output, json] = process.argv.slice(2);

if (!output) {
    process.stderr.write("Usage: node pixel-portrait.mjs <out.svg> '{\"background\":\"#D9773A\",\"hairStyle\":\"bob\",...}'\n");
    process.exit(1);
}

const traits = { ...defaults, ...JSON.parse(json ?? "{}") };
const grid = Array.from({ length: 32 }, () => Array(32).fill(traits.background));
const paint = (x, y, color) => {
    if (x >= 0 && x < 32 && y >= 0 && y < 32) {
        grid[y][x] = color;
    }
};
const span = (y, from, to, color) => {
    for (let x = from; x <= to; x++) {
        paint(x, y, color);
    }
};
const shade = (color, amount) => `#${color.replace("#", "").match(/../g).map(part => Math.max(0, Math.min(255, Math.round(parseInt(part, 16) * amount))).toString(16).padStart(2, "0")).join("")}`;
const skinShade = shade(traits.skin, 0.84);
const hairLight = shade(traits.hair, 1.35);

drawShoulders();

if (traits.hairStyle === "long" || traits.hairStyle === "ponytail") {
    drawHairBehind();
}

drawHead();
drawHair();
drawFace();
drawAccessory();
writeFileSync(output, svg());
console.log(`saved ${output}`);

function drawShoulders()
{
    const widths = [[23, 9, 22], [24, 7, 24], [25, 5, 26], [26, 4, 27], [27, 3, 28], [28, 3, 28], [29, 2, 29], [30, 2, 29], [31, 2, 29]];
    widths.forEach(([y, from, to]) => span(y, from, to, traits.clothes));
    span(21, 14, 17, skinShade);
    span(22, 14, 17, skinShade);
    span(23, 14, 17, traits.skin);

    if (traits.neckline === "v") {
        [[24, 14, 17], [25, 15, 16]].forEach(([y, from, to]) => span(y, from, to, traits.skin));
    } else if (traits.neckline === "collar") {
        [[23, 12, 13], [24, 12, 14], [23, 18, 19], [24, 17, 19]].forEach(([y, from, to]) => span(y, from, to, "#F2F0EA"));
    } else {
        span(23, 13, 18, shade(traits.clothes, 0.8));
    }
}

function drawHead()
{
    const rows = [[7, 13, 18], [8, 11, 20], [9, 10, 21], [10, 10, 21], [11, 9, 22], [12, 9, 22], [13, 9, 22], [14, 9, 22], [15, 9, 22], [16, 10, 21], [17, 10, 21], [18, 11, 20], [19, 12, 19], [20, 13, 18]];
    rows.forEach(([y, from, to]) => {
        span(y, from, to, traits.skin);
        paint(to, y, skinShade);
    });
    [13, 14, 15].forEach(y => {
        paint(8, y, traits.skin);
        paint(23, y, skinShade);
    });
}

function drawHair()
{
    const color = traits.hair;
    const style = traits.hairStyle;

    if (style === "bald") {
        span(10, 9, 10, color);
        span(10, 21, 22, color);
        span(11, 9, 9, color);
        span(11, 22, 22, color);
        return;
    }

    [[5, 12, 19], [6, 10, 21], [7, 9, 22], [8, 9, 22], [9, 9, 22]].forEach(([y, from, to]) => span(y, from, to, color));
    span(6, 13, 16, hairLight);
    [10, 11, 12].forEach(y => {
        paint(9, y, color);
        paint(22, y, color);
    });
    span(10, 10, 13, color);

    if (style === "curly") {
        [[4, 11, 13], [4, 16, 18], [5, 9, 22], [6, 8, 23], [7, 8, 23], [8, 8, 23]].forEach(([y, from, to]) => span(y, from, to, color));
        [[5, 12], [6, 17], [7, 10], [8, 20], [4, 15]].forEach(([x, y]) => paint(x, y, hairLight));
        [9, 10, 11, 12, 13].forEach(y => {
            paint(8, y, color);
            paint(23, y, color);
        });
    }

    if (style === "bob" || style === "long" || style === "ponytail") {
        for (let y = 10; y <= (style === "bob" ? 18 : 19); y++) {
            paint(8, y, color);
            paint(9, y, color);
            paint(22, y, color);
            paint(23, y, color);
        }
    }

    if (style === "bun") {
        [[2, 14, 17], [3, 13, 18], [4, 13, 18]].forEach(([y, from, to]) => span(y, from, to, color));
        span(3, 14, 15, hairLight);
    }
}

function drawHairBehind()
{
    for (let y = 10; y <= (traits.hairStyle === "long" ? 25 : 14); y++) {
        span(y, 7, 9, traits.hair);
        span(y, 22, 24, traits.hair);
    }

    if (traits.hairStyle === "ponytail") {
        [[11, 24, 25], [12, 24, 26], [13, 25, 26], [14, 25, 26], [15, 25, 26], [16, 25, 25]].forEach(([y, from, to]) => span(y, from, to, traits.hair));
    }
}

function drawFace()
{
    const ink = "#2A1F1A";
    span(12, 12, 14, traits.hair);
    span(12, 17, 19, traits.hair);
    paint(13, 14, ink);
    paint(18, 14, ink);
    paint(12, 14, "#F4F1EC");
    paint(19, 14, "#F4F1EC");
    paint(16, 16, skinShade);
    paint(15, 17, skinShade);
    span(18, 14, 17, "#B5584A");
    paint(13, 17, shade(traits.skin, 0.95));

    if (traits.beard !== "none") {
        const beard = traits.beard === "full" ? traits.hair : shade(traits.skin, 0.72);
        [[17, 10, 12], [17, 19, 21], [18, 11, 13], [18, 18, 20], [19, 12, 19], [20, 13, 18]].forEach(([y, from, to]) => span(y, from, to, beard));
        span(17, 14, 17, beard);
        span(18, 14, 17, "#B5584A");
    }

    // A thin frame around each eye, lighter below, so the eyes still show at 32 cells.
    if (traits.glasses !== "none") {
        const frame = "#3D3B39";
        const rim = shade(traits.skin, 0.66);
        const round = traits.glasses === "round";
        [[11, 14], [17, 20]].forEach(([from, to]) => {
            span(13, round ? from + 1 : from, round ? to - 1 : to, frame);
            span(15, from + 1, to - 1, rim);
            paint(from, 14, frame);
            paint(to, 14, frame);
        });
        span(14, 15, 16, frame);
    }
}

function drawAccessory()
{
    const accessory = traits.accessory;

    if (accessory === "pencil") {
        [[22, 8], [23, 9], [24, 10], [25, 11]].forEach(([x, y]) => paint(x, y, "#E8B83A"));
        paint(26, 12, "#3A3A38");
        paint(21, 7, "#E7A0A0");
    }

    if (accessory === "headphones") {
        [[6, 11, 20], [5, 13, 18]].forEach(([y, from, to]) => span(y, from, to, "#2C2C2B"));
        for (let y = 7; y <= 12; y++) {
            paint(8, y, "#2C2C2B");
            paint(23, y, "#2C2C2B");
        }
        [[13, 7, 9], [14, 7, 9], [15, 7, 9], [13, 22, 24], [14, 22, 24], [15, 22, 24]].forEach(([y, from, to]) => span(y, from, to, "#3F3F3D"));
    }

    if (accessory === "earrings") {
        paint(8, 16, "#E8C35A");
        paint(23, 16, "#E8C35A");
    }

    if (accessory === "scarf") {
        [[21, 11, 20], [22, 10, 21], [23, 11, 20], [24, 17, 19], [25, 17, 19], [26, 18, 19]].forEach(([y, from, to]) => span(y, from, to, "#B8452F"));
        span(22, 12, 19, "#D2603F");
    }
}

// Runs of one color on a row become one rect: a few hundred rects, a few kilobytes.
function svg()
{
    const rects = grid.flatMap((row, y) => {
        const runs = [];

        for (let x = 0; x < 32;) {
            let end = x;

            while (end + 1 < 32 && row[end + 1] === row[x]) {
                end++;
            }

            runs.push(`<rect x="${x}" y="${y}" width="${end - x + 1}" height="1" fill="${row[x]}"/>`);
            x = end + 1;
        }

        return runs;
    });
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="128" height="128" shape-rendering="crispEdges">${rects.join("")}</svg>\n`;
}
