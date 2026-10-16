// A preview of the Crew panel as the desktop gets it: the mod draws the panel, the meeting band and a group-chat reply from a
// project's real colleagues, inside `claude plugin test`; the trees it hands over become an HTML page in the app's dark colors.
// Not the app's own paint, but its layout, portraits and wrapping. Usage:
//   node tools/preview.mjs <project> [--out page.html] [--meeting id,id] [--working id] [--card id] [--pick id] [--language it|en]
// CLAUDE_BIN names the claude to run, when the one on the PATH is not the build the mod is made for.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(fileURLToPath(new URL("..", import.meta.url)));
const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const project = resolve(args.find(arg => !arg.startsWith("--") && !args[args.indexOf(arg) - 1]?.startsWith("--")) ?? ".");
const out = resolve(option("out", join(project, "tmp", "crew-preview.html")));
const meeting = option("meeting", "").split(",").filter(Boolean);
const working = option("working", "");
const card = option("card", "");
const pick = option("pick", "");
const language = option("language", "it");
// The portraits the page defines once, and a count that keeps each drawing's ids apart.
const symbols = new Map();
let drawings = 0;

const sandbox = mkdtempSync(join(tmpdir(), "crew-preview-"));

try {
    const mod = join(sandbox, "crew");
    cpSync(join(repo, "plugins", "crew"), mod, { recursive: true, filter: source => !/\.test\.|[\\/]\.claude-plugin[\\/]types/.test(source) });
    writeFileSync(join(mod, "hooks", "fixture.ts"), fixture());
    writeFileSync(join(mod, "hooks", "preview.test.tsx"), previewTest());
    const run = spawnSync(`"${process.env.CLAUDE_BIN ?? "claude"}" plugin test "${mod}"`, { encoding: "utf8", shell: true, maxBuffer: 64 * 1024 * 1024 });
    const output = `${run.stdout}\n${run.stderr}`;
    const trees = Object.fromEntries([...output.matchAll(/^PREVIEW (\w+) (.+)$/gm)].map(match => [match[1], JSON.parse(match[2])]));

    if (!trees.pane) {
        throw new Error(`The mod drew no panel:\n${output.slice(-3000)}`);
    }

    writeFileSync(out, page(trees));
    console.log(`written ${out}`);
} finally {
    rmSync(sandbox, { recursive: true, force: true });
}

// The project's colleagues as the fake world of the test serves them, under the root "/p".
function fixture()
{
    const files = {};
    const bytes = {};
    const times = {};
    const agents = join(project, ".claude", "agents");

    for (const name of existsSync(agents) ? readdirSync(agents) : []) {
        const id = name.replace(/\.md$/, "");
        const folder = join(project, ".claude", "agent-memory", id);

        if (!name.endsWith(".md") || !existsSync(join(folder, "todo.md"))) {
            continue;
        }

        files[`/p/.claude/agents/${name}`] = readFileSync(join(agents, name), "utf8");

        for (const file of ["todo.md", "MEMORY.md"]) {
            if (existsSync(join(folder, file))) {
                files[`/p/.claude/agent-memory/${id}/${file}`] = readFileSync(join(folder, file), "utf8");
                times[`/p/.claude/agent-memory/${id}/${file}`] = statSync(join(folder, file)).mtimeMs;
            }
        }

        for (const portrait of ["avatar.jpg", "avatar.webp", "avatar.png", "avatar.svg"]) {
            if (existsSync(join(folder, portrait))) {
                bytes[`/p/.claude/agent-memory/${id}/${portrait}`] = readFileSync(join(folder, portrait)).toString("base64");
            }
        }
    }

    if (meeting.length) {
        files["/tmp/claude-crew/preview.json"] = JSON.stringify({ active: meeting });
    }

    return `export const files: Record<string, string> = ${JSON.stringify(files)};\nexport const bytes: Record<string, string> = ${JSON.stringify(bytes)};\nexport const times: Record<string, number> = ${JSON.stringify(times)};\n`;
}

function previewTest()
{
    const speakers = meeting.length ? meeting : [];
    return `import type { On } from "claude-code";
import { mock, test } from "claude-code/testing";
import { bytes, files, times } from "./fixture.ts";

const posix = (path: string) => path.replace(/\\\\/g, "/").replace(/^[A-Za-z]:/, "");
const exists = (path: string) => Object.keys({ ...files, ...bytes }).some(name => name === posix(path) || name.startsWith(\`\${posix(path)}/\`));

function world(on: On): void
{
    mock.env(on, { OS: "Linux", TMPDIR: "/tmp" });
    mock.clock(on, { now: ${Date.now()} });
    on("session.start", () => ({ cwd: "/p" }) as never);
    on("settings.read", () => ({ value: {} }) as never);
    on("tool.register", () => ({ value: {} }) as never);
    on("command.register", () => ({ value: {} }) as never);
    on("ui.open", () => ({ value: {} }) as never);
    on("command.list", () => ({ value: [{ name: "crew:talk", description: "", source: "plugin", plugin: "crew", isFullscreen: false }] }) as never);
    mock.store(on);
    on("session.root", () => ({ value: "/p" }));
    on("session.id", () => ({ value: "preview" }));
    on("session.usage", () => ({ value: { startedAt: 0, context: {}, rateLimits: [{ kind: "five_hour", percentUsed: 7, resetsAt: new Date(${Date.now()} + 35 * 60000).toISOString() }, { kind: "seven_day", percentUsed: 8, resetsAt: new Date(${Date.now()} + 6 * 86400000).toISOString() }] } }) as never);
    on("fs.exists", (_, e) => ({ value: exists(e.path) }));
    on("fs.list", (_, e) => ({ value: Object.keys(files).filter(name => name.startsWith(\`\${posix(e.path)}/\`) && !name.slice(posix(e.path).length + 1).includes("/")).map(name => ({ name: name.slice(posix(e.path).length + 1), kind: "file", size: 1, mtimeMs: 0, isLink: false })) }) as never);
    on("fs.read", (_, e) => ({ value: e.as === "bytes" ? { base64: bytes[posix(e.path)] ?? "" } : files[posix(e.path)] ?? "" }) as never);
    on("fs.stat", (_, e) => ({ value: { kind: "file", size: 1, mtimeMs: times[posix(e.path)] ?? 1, isLink: false } }) as never);
    on("agent.spawn", () => ({ model: "claude-opus-5-5", agentId: "preview-run" }) as never);
    on("tool.call", { tool: "Read" }, () => ({ result: "" }) as never);
    // A model request of the colleague at work, with what it spent.
    on("turn.step", async function* () {
        return { usage: { model: "claude-opus-5-5", input_tokens: 58000, output_tokens: 1200 } };
    } as never);
    on("ui.render", ($, e) => {
        const { Text } = $.ui.resolve(e);
        return <Text key="engine">engine</Text>;
    });
}

test("preview", { options: { language: "${language}" }, timeoutMs: 20000 }, async ($, on) => {
    world(on);
    await $.session.start({ cwd: "/p", surface: null, isInteractive: true } as never);
    ${working ? `await $.agent.spawn({ prompt: "Review.", description: "revisione del passo 13", subagentType: "${working}", effort: "medium" } as never);
    await $.turn.step({ agentId: "preview-run", model: "claude-opus-5-5", effort: "medium" } as never);
    await $.tool.call({ tool: "Read", file_path: "/p/private/project/DECISIONI.md", agentId: "preview-run", tool_use_id: "r1" } as never);
    await $.tool.call({ tool: "mcp__crew__step", done: 1, total: 5, note: "leggo todo, istruzioni e decisioni", agentId: "preview-run", tool_use_id: "s1" } as never);` : ""}
    const pane = await $.ui.mount({ plugin: "crew", surface: "desktop", component: "Pane", requestId: "crew", props: { title: "Crew", isFocused: false, bodyColumns: 50, placement: "dock" } as never });
    ${card ? `await pane.press({ key: "open-${card}" });` : ""}
    ${pick ? `await pane.press({ key: "pick-${pick}" });` : ""}
    console.log("PREVIEW pane " + JSON.stringify(await pane.find({})));
    ${speakers.length ? `const band = await $.ui.mount({ plugin: "crew", surface: "desktop", component: "AbovePrompt", props: { hasSurvey: false, isWorking: false, maxRows: 8, bodyColumns: 100 } as never });
    console.log("PREVIEW band " + JSON.stringify(await band.find({})));` : ""}
    const chat = await $.ui.mount({ plugin: "crew", surface: "desktop", component: "AssistantMessage", props: { text: ${JSON.stringify(chatSample())}, isFirstOfReply: true } });
    console.log("PREVIEW chat " + JSON.stringify(await chat.find({})));
});
`;
}

// A reply of the first two colleagues, with a narrator line, to see the group chat.
function chatSample()
{
    const names = readdirSync(join(project, ".claude", "agents")).filter(name => name.endsWith(".md")).slice(0, 2)
        .map(name => /^# ([^\s,]+)/m.exec(readFileSync(join(project, ".claude", "agents", name), "utf8"))?.[1] ?? "");
    return `[${names[0]}] Il passo 13 regge, ma il viaggio a tratti salta l'evento al confine.\n\n*Claude apre src/travel.ts.*\n\n[${names[1]}] Io partirei dalla prova di ieri sera: il master si è fermato tre volte.`;
}

// The trees as HTML: Box a flex box, Text a span, Button a button, Svg an image, Markdown a little markdown.
function page(trees)
{
    const sections = [["pane", "Pannello"], ["band", "Sopra il prompt"], ["chat", "Chat"]].filter(([key]) => trees[key])
        .map(([key, title]) => `<section class="${key}"><h2>${title}</h2><div class="surface">${element(trees[key], false)}</div></section>`);
    return `<!doctype html><meta charset="utf-8"><title>Crew panel preview</title>
<style>
:root{color-scheme:dark}
body{margin:0;padding:16px;background:#141413;color:#ececec;font:13px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start}
h2{font-size:11px;font-weight:600;color:#7d7d79;text-transform:uppercase;letter-spacing:.06em;margin:0 0 8px}
.surface{background:#1f1f1e;border:1px solid #333331;border-radius:10px;padding:12px}
.pane .surface{width:var(--pane,380px);resize:horizontal;overflow:auto}
.band .surface,.chat .surface{width:520px;resize:horizontal;overflow:auto}
.box{display:flex;min-width:0;position:relative}
.text{min-width:0}.text.block{display:block}.dim{color:#9a9a96}.bold{font-weight:600}.italic{font-style:italic}
.truncate{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
button{font:inherit;color:#ececec;background:#2c2c2b;border:1px solid #3a3a38;border-radius:6px;padding:2px 8px;cursor:pointer}
button.plain{background:none;border:none;padding:0;color:#ececec;font-weight:600;text-align:left}
button.plain:hover{text-decoration:underline}
select{font:inherit;background:#2c2c2b;color:#ececec;border:1px solid #3a3a38;border-radius:6px}
.md p{margin:0 0 4px}.md ul{margin:0;padding-left:18px}.md code{background:#2c2c2b;border-radius:4px;padding:0 3px}
.svg{display:inline-block;flex-shrink:0;line-height:0}.svg>svg{width:100%;height:100%}
</style>${sections.join("")}${symbolDefinitions()}`;
}

function element(node, isInline)
{
    if (typeof node === "string") {
        return escape(node);
    }

    if (!node || typeof node !== "object") {
        return "";
    }

    const props = node.props ?? {};
    const children = (node.children ?? []).map(child => element(child, node.type === "Text"));

    switch (node.type) {
        case "Box":
            return `<div class="box" style="${boxStyle(props)}">${children.join("")}</div>`;
        case "Text": {
            const classes = ["text", isInline ? "" : "block", props.dimColor ? "dim" : "", props.bold ? "bold" : "", props.italic ? "italic" : "", String(props.wrap ?? "").startsWith("truncate") ? "truncate" : ""];
            const color = props.color && String(props.color).startsWith("#") ? `color:${props.color}` : "";
            return `<span class="${classes.filter(Boolean).join(" ")}" style="${color}">${children.join("")}</span>`;
        }
        case "Button":
            // Children of text are drawn in the label's place, as the app does; the label then only names the control.
            return `<button class="${props.plain ? "plain" : ""}">${node.children?.length ? node.children.map(child => (typeof child === "string" ? escape(child).replace(/\n/g, "<br>") : element(child, true))).join("") : escape(String(props.label ?? node.text ?? ""))}</button>`;
        case "Svg":
            // Without a width, the drawing takes the room it is given, as the app's image does.
            return `<span class="svg" style="${props.width ? `width:${props.width}px` : "display:block;flex:1 1 auto;min-width:0"};height:${props.height}px">${inlineSvg(String(props.source ?? ""))}</span>`;
        case "Markdown":
            return `<div class="md${props.dimColor ? " dim" : ""}">${markdown(String(props.text ?? ""))}</div>`;
        case "Select":
            return `<select><option>${escape(String(props.label ?? ""))}</option>${(props.options ?? []).map(choice => `<option>${escape(choice.label ?? choice.value)}</option>`).join("")}</select>`;
        default:
            return children.join("");
    }
}

// An Svg drawn inline: its ids made unique in the page, each portrait defined once as a symbol and used where it is drawn.
function inlineSvg(source)
{
    const number = ++drawings;
    return source
        .replace(/id="([\w-]+)"/g, `id="$1-${number}"`).replace(/url\(#([\w-]+)\)/g, `url(#$1-${number})`)
        .replace(/<image href="(data:[^"]+)" x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"([^>]*)\/>/g, (_, uri, x, y, width, height, rest) => {
            if (!symbols.has(uri)) {
                symbols.set(uri, `portrait-${symbols.size + 1}`);
            }

            return `<use href="#${symbols.get(uri)}" x="${x}" y="${y}" width="${width}" height="${height}"${rest.replace(/ preserveAspectRatio="[^"]*"/, "")}/>`;
        });
}

function symbolDefinitions()
{
    return `<svg width="0" height="0" style="position:absolute"><defs>${[...symbols].map(([uri, id]) => `<symbol id="${id}" viewBox="0 0 128 128"><image href="${uri}" width="128" height="128" preserveAspectRatio="xMidYMid slice"/></symbol>`).join("")}</defs></svg>`;
}

// The desktop's cells as pixels: about 8 across.
function boxStyle(props)
{
    const cell = value => `${Number(value) * 8}px`;
    const rules = [
        `flex-direction:${props.flexDirection ?? "row"}`,
        props.flexWrap ? `flex-wrap:${props.flexWrap}` : "",
        props.alignItems ? `align-items:${props.alignItems}` : "",
        props.justifyContent ? `justify-content:${props.justifyContent}` : "",
        // A width in percent, as the bar's filled part has; the cells of a numeric one are left to the flex layout.
        typeof props.width === "string" ? `width:${props.width}` : "",
        props.flexGrow !== undefined ? `flex-grow:${props.flexGrow}` : "",
        props.flexShrink !== undefined ? `flex-shrink:${props.flexShrink}` : "",
        props.gap !== undefined ? `gap:${cell(props.gap)}` : "",
        props.columnGap !== undefined ? `column-gap:${cell(props.columnGap)}` : "",
        props.rowGap !== undefined ? `row-gap:${cell(props.rowGap)}` : "",
        props.paddingLeft !== undefined ? `padding-left:${cell(props.paddingLeft)}` : "",
        props.paddingX !== undefined ? `padding-left:${cell(props.paddingX)};padding-right:${cell(props.paddingX)}` : "",
        props.paddingY !== undefined ? `padding-top:${cell(props.paddingY)};padding-bottom:${cell(props.paddingY)}` : "",
        // The outlined cards: a thin line in their color, rounded as the desktop draws them.
        props.borderStyle ? `border:1px solid ${props.borderColor ?? "#8080803d"};border-radius:${props.borderStyle === "round" ? 8 : 0}px;padding-top:4px;padding-bottom:4px` : "",
        props.marginBottom !== undefined ? `margin-bottom:${cell(props.marginBottom)}` : "",
        props.backgroundColor ? `background:${props.backgroundColor}` : "",
        // Laid over its neighbours, as the app does: the clear buttons over a drawing take no room.
        props.position === "absolute" ? `position:absolute;${["top", "left", "right", "bottom"].filter(side => props[side] !== undefined).map(side => `${side}:${cell(props[side])}`).join(";")}` : "",
        props.marginTop !== undefined ? `margin-top:${cell(props.marginTop)}` : "",
        props.overflow === "hidden" ? "overflow:hidden" : "",
        // A box shown only under the pointer, as the hints are, stays hidden here.
        props.display === "none" ? "display:none" : "",
    ];
    return rules.filter(Boolean).join(";");
}

function markdown(text)
{
    const inline = line => escape(line).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/(^|[^*])\*([^*]+)\*/g, "$1<i>$2</i>").replace(/`([^`]+)`/g, "<code>$1</code>");
    const blocks = text.split(/\n\s*\n/);
    return blocks.map(block => {
        const lines = block.split("\n");
        return lines.every(line => /^\s*- /.test(line))
            ? `<ul>${lines.map(line => `<li>${inline(line.replace(/^\s*- /, ""))}</li>`).join("")}</ul>`
            : `<p>${lines.map(inline).join("<br>")}</p>`;
    }).join("");
}

function escape(text)
{
    return String(text).replace(/[&<>"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[character] ?? character);
}
