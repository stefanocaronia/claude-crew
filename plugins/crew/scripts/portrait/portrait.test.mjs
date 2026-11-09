// The two portrait scripts as the portrait reference runs them: node --test plugins/crew/scripts/portrait/portrait.test.mjs
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const folder = mkdtempSync(join(tmpdir(), "crew-portraits-"));
const traits = { background: "orange", skin: "#c96", hairStyle: "bob", clothes: "blue", neckline: "v", glasses: "round", beard: "stubble", accessory: "headphones" };

after(() => rmSync(folder, { recursive: true, force: true }));

for (const kind of ["pixel", "vector"]) {
    describe(`${kind}-portrait.mjs`, () => {
        it("draws a square SVG with no text, scripts or outside references, light enough for the panel", () => {
            const { status, svg } = draw(kind, JSON.stringify(traits));
            assert.equal(status, 0);
            assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 (\d+) \1"/);
            assert.doesNotMatch(svg, /<text|<script|href=/);
            assert.ok(svg.length < 32 * 1024, `${svg.length} characters`);
        });

        it("draws the colors by the team's names, never as the browser's", () => {
            const { svg } = draw(kind, JSON.stringify(traits));
            assert.match(svg, /fill="#d9773a"/);
            assert.doesNotMatch(svg, /fill="(?:orange|blue)"/);
        });

        it("refuses traits that are not JSON, and a color it does not know, saying what works", () => {
            assert.match(draw(kind, "{bad").error, /The traits are not JSON/);
            const unknown = draw(kind, JSON.stringify({ skin: "teal\"/><script>" }));
            assert.equal(unknown.status, 1);
            assert.match(unknown.error, /Unknown color .*give #rrggbb, #rgb or one of red/);
        });
    });
}

function draw(kind, json)
{
    const out = join(folder, `${kind}.svg`);
    rmSync(out, { force: true });
    const script = fileURLToPath(new URL(`./${kind}.mjs`, import.meta.url));
    const result = spawnSync(process.execPath, [script, out, json], { encoding: "utf8" });
    const svg = result.status === 0 ? readFileSync(out, "utf8") : "";
    return { status: result.status, svg, error: result.stderr };
}
