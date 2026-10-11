// Makes one picture with the Codex CLI and saves it as a PNG: node codex-image.mjs <out.png> < brief.txt
// Only with Codex logged in with ChatGPT, never with an API key, which pays by the picture. Codex runs in an empty folder of its own,
// so it reads nothing of the project; the picture lands in its generated_images folder, from which it is moved to <out.png>.
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

// A picture takes 30 to 45 seconds: past three minutes it is given up.
const longest = 3 * 60 * 1000;
const output = process.argv[2];

if (!output) {
    fail("Usage: node codex-image.mjs <out.png> < brief.txt (the brief describes the picture)");
}

const brief = readFileSync(0, "utf8").trim();

if (!brief) {
    fail("The brief is empty: write what the picture shows on the standard input.");
}

checkLogin();
const file = await makePicture(brief);
mkdirSync(dirname(resolve(output)), { recursive: true });
copyFileSync(file.path, output);
file.clean();
console.log(`saved ${output}`);

function checkLogin()
{
    // Whether codex is there at all, by the exit code: the shell's own message changes with the system's language.
    const found = spawnSync(process.platform === "win32" ? "where codex" : "command -v codex", { shell: true, encoding: "utf8", timeout: 15_000, windowsHide: true });

    if (found.status !== 0) {
        fail("Codex is not installed on this computer: try another way to make the portrait.");
    }

    // One line for the shell, which finds codex as npm installed it, a script on Windows.
    const status = spawnSync("codex login status", { shell: true, encoding: "utf8", timeout: 15_000, windowsHide: true });
    const said = `${status.stdout ?? ""}${status.stderr ?? ""}`;

    if (status.status !== 0 || /not logged in/i.test(said)) {
        fail("Codex is not logged in: the user logs in with `codex login`, with ChatGPT.");
    }

    if (!/chatgpt/i.test(said)) {
        fail("Codex uses an API key, which pays by the picture: pictures are made only with the ChatGPT login.");
    }
}

function makePicture(text)
{
    const folder = mkdtempSync(join(tmpdir(), "crew-picture-"));
    const last = join(folder, "last.txt");
    const line = `codex exec --ephemeral --skip-git-repo-check -s read-only -C "${folder}" --json -o "${last}" --ignore-user-config --ignore-rules -c model_reasoning_effort="low" -`;
    const prompt = `Generate this picture with your image tool and say nothing else: ${text}`;

    return new Promise(done => {
        const child = spawn(line, { shell: true, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
        let events = "";
        let errors = "";
        const timer = setTimeout(() => stop(child), longest);
        child.stdout.on("data", chunk => (events += chunk.toString()));
        child.stderr.on("data", chunk => (errors += chunk.toString()));
        child.on("error", () => undefined);
        child.on("close", () => {
            clearTimeout(timer);
            const parsed = events.split("\n").flatMap(eventLine => {
                try {
                    return [JSON.parse(eventLine)];
                } catch {
                    return [];
                }
            });
            const thread = parsed.find(event => event.type === "thread.started")?.thread_id;
            const pictures = typeof thread === "string" ? join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "generated_images", thread) : undefined;
            const picture = pictures && existsSync(pictures) ? readdirSync(pictures).find(name => name.toLowerCase().endsWith(".png")) : undefined;
            const clean = () => {
                rmSync(folder, { recursive: true, force: true });

                if (pictures) {
                    rmSync(pictures, { recursive: true, force: true });
                }
            };

            if (picture) {
                done({ path: join(pictures, picture), clean });
                return;
            }

            const said = existsSync(last) ? readFileSync(last, "utf8").trim().split("\n").at(-1) ?? "" : "";
            const failed = parsed.find(event => event.type === "turn.failed")?.error?.message;
            clean();
            fail(/moderation_blocked/.test(errors) ? "The generator's safety check refused the brief: describe it differently."
                : failed ? `Codex failed: ${failed}` : said ? `Codex said: ${said}` : `No picture came in ${longest / 60_000} minutes.`);
        });
        child.stdin.end(prompt);
    });
}

// On Windows the shell runs codex as a child of its own: the whole tree goes, or codex keeps running.
function stop(child)
{
    if (process.platform === "win32" && child.pid) {
        spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true });
    } else {
        child.kill();
    }
}

function fail(message)
{
    process.stderr.write(`${message}\n`);
    process.exit(1);
}
