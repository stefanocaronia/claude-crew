// The project plugin's backlog, where the project keeps one: its open tasks asked of its own command, and changed by it.
import type { EngineInterface } from "claude-code";

import { cached, filesIn, type FileStamp, projectRoot } from "./files.ts";
import type { BacklogTask } from "./team.ts";

// The project backlog's open tasks as last asked, and what the project's docs were then.
let backlogRead: { signature: string; tasks: BacklogTask[] | undefined } | undefined;

// The open tasks of the project's backlog done in one go, its parts and never the task they make up, asked of the project plugin's
// own command when the project has one and the plugin is installed; asked again only when a file of the project's docs changes.
// Undefined without them: the todo lines say what is open.
export async function projectBacklog($: EngineInterface, root: string): Promise<BacklogTask[] | undefined>
{
    const configPath = `${root}/.claude/project.yaml`;
    const script = (await $.fs.exists(configPath)) ? await backlogScript($) : undefined;

    if (!script) {
        return undefined;
    }

    const config = await $.fs.read(configPath).catch(() => "");
    const docs = /^docs:\s*["']?([^\s"'#]+)/m.exec(config)?.[1] ?? "project";
    const prefixes = /^prefixes:.*(?:\n[ \t].*)*/m.exec(config)?.[0] ?? "";
    const prefix = /\btask:\s*["']?([A-Z]+)/.exec(prefixes)?.[1] ?? "T";
    // The specifications a task does are the ids of its `see` with their prefix, where the project keeps them.
    const specPrefix = /\bspec:\s*["']?([A-Z]+)/.exec(prefixes)?.[1] ?? "S";
    const stamps = await filesIn($, `${root}/${docs}`).catch(() => new Map<string, FileStamp>());
    const signature = [script, prefix, specPrefix, ...[...stamps].map(([name, file]) => `${name}:${file.mtimeMs}:${file.size}`)].join("|");

    if (backlogRead?.signature !== signature) {
        const listed = await $.process.run(["node", script, "list", "--atomic", "--json"], { cwd: root, env: { CLAUDE_PROJECT_DIR: root }, timeoutMs: 30_000 }).catch(() => undefined);
        let open: BacklogTask[] | undefined;

        try {
            type Listed = { id: number | string; to?: string; priority?: string; created?: string; text?: string; after?: string[]; type?: string | null; due?: string | null; by?: string | null; started?: string | null; state?: string; see?: string[] };
            const listedTasks = listed?.exitCode === 0 ? (JSON.parse(listed.stdout) as Listed[]) : undefined;
            open = listedTasks?.map(task => ({
                ...specsOf(task.see ?? [], specPrefix),
                id: `${prefix}-${task.id}`,
                to: task.to ?? "",
                priority: task.priority,
                date: task.created,
                text: task.text,
                after: task.after,
                ...(task.type ? { type: task.type } : {}),
                ...(task.due ? { due: task.due } : {}),
                ...(task.by ? { by: task.by } : {}),
                ...(task.started ? { started: task.started } : {}),
                ...(task.state ? { state: task.state } : {}),
            }));
        } catch {
            open = undefined;
        }

        backlogRead = { signature, tasks: open };
    }

    return backlogRead.tasks;
}

// The specifications among a task's `see`, by their prefix: `{ specs: ["S-12"] }`, or nothing when it cites none.
function specsOf(see: string[], prefix: string): { specs?: string[] }
{
    const specs = see.filter(id => id.startsWith(`${prefix}-`));
    return specs.length ? { specs } : {};
}

// A change to a task of the project's backlog, by the project plugin's own command (`set T-61 --p P2`, `archive T-61`); read again after.
export async function changeBacklog($: EngineInterface, args: string[]): Promise<void>
{
    const script = await backlogScript($);

    if (!script) {
        return;
    }

    const root = await projectRoot($);
    const changed = await $.process.run(["node", script, ...args], { cwd: root, env: { CLAUDE_PROJECT_DIR: root }, timeoutMs: 30_000 });
    backlogRead = undefined;

    if (changed.exitCode !== 0) {
        throw new Error(`The project plugin's backlog refused ${args.join(" ")}: ${changed.stderr.trim() || changed.stdout.trim()}`);
    }
}

// The project plugin's backlog command, where Claude Code installed it; the list of plugins read again only when it changes, and
// one being written right now taken for none, so the panel still reads the team.
async function backlogScript($: EngineInterface): Promise<string | undefined>
{
    const home = (await $.env.get("CLAUDE_CONFIG_DIR")) ?? `${(await $.env.get("USERPROFILE")) ?? (await $.env.get("HOME")) ?? ""}/.claude`;
    const path = `${home}/plugins/installed_plugins.json`;
    const stat = await $.fs.stat(path).catch(() => undefined);
    const text = stat?.kind === "file" ? await cached(path, stat, () => $.fs.read(path)).catch(() => "") : "";
    let registry: { plugins?: Record<string, { installPath?: string }[]> };

    try {
        registry = JSON.parse(text || "{}") as typeof registry;
    } catch {
        registry = {};
    }

    const installs = Object.entries(registry.plugins ?? {}).filter(([name]) => name.startsWith("project@")).flatMap(([, list]) => list);

    for (const install of installs) {
        const script = `${(install.installPath ?? "").replace(/\\/g, "/")}/scripts/backlog.mjs`;

        if (install.installPath && (await $.fs.exists(script))) {
            return script;
        }
    }

    return undefined;
}

// The project's owner as its backlog names people, `people` of .claude/project.yaml: the first who is not Claude; undefined without one.
export async function projectOwner($: EngineInterface): Promise<string | undefined>
{
    const config = await $.fs.read(`${await projectRoot($)}/.claude/project.yaml`).catch(() => "");
    const inline = /^people:\s*\[([^\]]*)\]/m.exec(config)?.[1]?.split(",");
    const listed = inline ?? [.../^people:\s*\n((?:[ \t]+-.*\n?)*)/m.exec(config)?.[1]?.matchAll(/^[ \t]+-\s*(.+)$/gm) ?? []].map(match => match[1] ?? "");
    return listed.map(name => name.trim().replace(/^["']|["']$/g, "")).find(name => name && name !== "Claude");
}
