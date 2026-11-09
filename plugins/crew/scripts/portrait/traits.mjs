// The traits both portrait scripts take, from their command line: node <script> <out.svg> '<json>'. Traits left out keep the
// defaults; the colors become #rrggbb, and a color the scripts do not know is refused with what works.

const defaults = { background: "#888780", skin: "#E3B08D", hair: "#3B2A20", hairStyle: "short", clothes: "#2F3640", neckline: "crew", glasses: "none", beard: "none", accessory: "none" };
// The plain color names a profile uses.
const names = { red: "C0453A", blue: "2F6FDB", green: "2E9E5B", yellow: "D9A21B", purple: "8B5CF6", orange: "D9773A", pink: "D9599A", cyan: "1FA3B8", black: "222222", white: "F4F4F1", gray: "888780", grey: "888780", brown: "7A5230" };

/** Where the portrait goes and its traits, every color checked once, so a color the script does not know never reaches the drawing raw. */
export function traitsFrom(script)
{
    const [output, json] = process.argv.slice(2);

    if (!output) {
        fail(`Usage: node ${script} <out.svg> '{"background":"#D9773A","hairStyle":"bob",...}'`);
    }

    let given;

    try {
        given = JSON.parse(json ?? "{}");
    } catch {
        fail(`The traits are not JSON: ${json}. Give them as '{"background":"#D9773A","hairStyle":"bob"}'.`);
    }

    const traits = { ...defaults, ...given };

    for (const key of ["background", "skin", "hair", "clothes"]) {
        traits[key] = `#${hex(traits[key])}`;
    }

    return { output, traits };
}

/** A color as six hex digits: #abc and the plain names become aabbcc; anything else is refused, with what works. */
export function hex(color)
{
    const plain = String(color).trim().replace(/^#/, "").toLowerCase();
    const full = /^[0-9a-f]{6}$/.test(plain) ? plain : /^[0-9a-f]{3}$/.test(plain) ? plain.replace(/./g, digit => digit + digit) : names[plain]?.toLowerCase();

    if (!full) {
        fail(`Unknown color "${color}": give #rrggbb, #rgb or one of ${Object.keys(names).join(", ")}.`);
    }

    return full;
}

/** A color darker (below 1) or lighter (above 1) by `amount`. */
export function shade(color, amount)
{
    return `#${hex(color).match(/../g).map(part => Math.max(0, Math.min(255, Math.round(parseInt(part, 16) * amount))).toString(16).padStart(2, "0")).join("")}`;
}

function fail(message)
{
    process.stderr.write(`${message}\n`);
    process.exit(1);
}
