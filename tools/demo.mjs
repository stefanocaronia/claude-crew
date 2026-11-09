// A made-up project for the README's picture: five colleagues with profiles, todos, memories and vector portraits, nobody's
// real work. The picture, from the repository's root:
//   node tools/demo.mjs <folder>
//   node tools/preview.mjs <folder> --out <page.html> --working jonas-weber --meeting elena-marchetti,priya-nair --language en
//   chrome --headless=new --hide-scrollbars --force-device-scale-factor=2 --window-size=1030,860 --screenshot=docs/crew.png <page.html>
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = process.argv[2];
const portraitScripts = fileURLToPath(new URL("../plugins/crew/scripts/portrait", import.meta.url));

if (!root) {
    console.error("Usage: node tools/demo.mjs <folder>");
    process.exit(1);
}

rmSync(root, { recursive: true, force: true });

const team = [
    {
        id: "elena-marchetti", name: "Elena Marchetti", role: "software architect", color: "purple",
        field: "the structure of the code, its modules and their boundaries",
        traits: { background: "purple", skin: "#e3b08d", hair: "#3b2a20", hairStyle: "bob", clothes: "#2f3640", neckline: "collar", glasses: "round", accessory: "earrings" },
        todo: [
            "- [ ] P1 · 2026-10-30 · #elena-1 · Split the route planner from the map view before the offline mode lands",
            "- [ ] P2 · 2026-10-28 · Write down why tiles are cached per zoom level",
            "- [ ] P3 · 2026-10-21 · Look again at the plugin loader once the API settles",
        ],
        memory: ["- 2026-10-30: review of step 12, the route planner leaks into the map view; the user agreed to split them.", "- The user prefers small modules with one owner each."],
    },
    {
        id: "jonas-weber", name: "Jonas Weber", role: "test engineer", color: "green",
        field: "tests, test plans and the cases nobody tried",
        traits: { background: "green", skin: "#f1c7a5", hair: "#c9a26b", hairStyle: "short", clothes: "#1f3b5a", neckline: "crew", glasses: "square", beard: "stubble", accessory: "headphones" },
        todo: [
            "- [ ] P1 · 2026-10-31 · Retest the GPX import with tracks over 10,000 points",
            "- [ ] P2 · 2026-10-29 · Cases for a route that crosses the date line (after: #elena-1)",
            "- [ ] P2 · 2026-10-27 · A smoke test for the offline maps",
        ],
        memory: ["- 2026-10-31: the import drops the last point of long tracks; reproduced twice.", "- Tests run with npm test; the slow ones are tagged @slow."],
    },
    {
        id: "priya-nair", name: "Priya Nair", role: "UX and accessibility designer", color: "pink",
        field: "the screens, their words and who can use them",
        traits: { background: "pink", skin: "#a8724f", hair: "#1e1512", hairStyle: "long", clothes: "#f4f4f1", neckline: "v", accessory: "pencil" },
        todo: [
            "- [ ] P1 · 2026-10-31 · The first screen: two of five testers could not find where to start",
            "- [ ] P2 · 2026-10-26 · Contrast of the trail colors on the satellite layer",
        ],
        memory: ["- 2026-10-31: hallway test of the first screen with five people.", "- The user wants plain words over icons alone."],
    },
    {
        id: "lucas-moreau", name: "Lucas Moreau", role: "security reviewer", color: "red",
        field: "secrets, permissions and what the app trusts",
        traits: { background: "red", skin: "#e8b796", hair: "#5a3b26", hairStyle: "curly", clothes: "#222222", neckline: "crew", beard: "full" },
        todo: [
            "- [ ] P2 · 2026-10-25 · Check what the share link reveals about a private route",
            "- [ ] P3 · 2026-10-20 · Rotate the map provider's key out of the repo history",
        ],
        memory: ["- 2026-10-25: share links carry the route id in clear; proposed signed links."],
    },
    {
        id: "kenji-sato", name: "Kenji Sato", role: "performance engineer", color: "cyan",
        field: "start-up time, memory and the frame rate of the map",
        traits: { background: "cyan", skin: "#f0c8a0", hair: "#141414", hairStyle: "short", clothes: "#3a3a38", neckline: "v", glasses: "square" },
        todo: [
            "- [ ] P2 · 2026-10-29 · Profile the map at zoom 16 on a mid-range phone",
            "- [ ] P3 · 2026-10-22 · Lazy-load the elevation chart",
        ],
        memory: ["- 2026-10-29: the map drops to 40 fps when the route has over 2,000 points."],
    },
];

for (const colleague of team) {
    const memory = join(root, ".claude", "agent-memory", colleague.id);
    mkdirSync(memory, { recursive: true });
    mkdirSync(join(root, ".claude", "agents"), { recursive: true });
    writeFileSync(join(root, ".claude", "agents", `${colleague.id}.md`), `---
name: ${colleague.id}
description: "${colleague.name}, ${colleague.role}. Use them proactively whenever the work touches ${colleague.field}."
tools: Read, Grep, Glob
memory: project
color: ${colleague.color}
---

# ${colleague.name}, ${colleague.role}

A made-up colleague of the Trailmap demo project.
`);
    writeFileSync(join(memory, "todo.md"), `${colleague.todo.join("\n")}\n`);
    writeFileSync(join(memory, "MEMORY.md"), `# ${colleague.name}\n\n${colleague.memory.join("\n")}\n`);
    execFileSync(process.execPath, [join(portraitScripts, "vector.mjs"), join(memory, "avatar.svg"), JSON.stringify(colleague.traits)]);
}

console.log(`demo in ${root}`);
