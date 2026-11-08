// The project's colleagues as their files describe them: .claude/agents/<id>.md, and .claude/agent-memory/<id>/ with todo.md.
import type { Card, Colleague, Permissions } from "../types";

/** Claude Code's agent colors, as the panel draws them. */
const colors: Record<string, string> = {
    red: "#C0453A",
    blue: "#3F7CC4",
    green: "#4E9A6B",
    yellow: "#C9A227",
    purple: "#8A63C9",
    orange: "#D9773A",
    pink: "#D0679B",
    cyan: "#2FA3B5",
};
const gray = "#888780";

/** A colleague from their profile and their todo: the heading's name and role, the frontmatter's color, model and effort. */
export function colleagueFrom(id: string, profile: string, todo: string, avatarStamp: number): Colleague
{
    const text = normalized(profile);
    // The heading, `# <First> <Last>, <role>`; without one, the id's first part, capitalized, as the project plugin reads it too.
    const heading = /^# (.+)$/m.exec(text.replace(/^---\n[\s\S]*?\n---\n/, ""))?.[1]?.trim() || firstOfId(id);
    const [fullName = id, ...role] = heading.split(",");
    const color = field(text, "color");
    return {
        id,
        name: fullName.trim().split(/\s+/)[0] ?? id,
        fullName: fullName.trim(),
        role: role.join(",").trim(),
        color: (color && colors[color.toLowerCase()]) ?? (color && /^#[0-9a-f]{3,8}$/i.test(color) ? color : gray),
        model: field(text, "model"),
        effort: field(text, "effort"),
        permissions: permissionsOf(listField(text, "tools")),
        openTasks: openTasks(todo).length,
        avatarStamp,
    };
}

/** The id's first part, capitalized: a colleague's first name where their profile has no heading. */
function firstOfId(id: string): string
{
    const first = id.split("-")[0] ?? id;
    return first.charAt(0).toUpperCase() + first.slice(1);
}

/** A first name as a key, compared as the project plugin compares them: without case or accents, so «Nicolo» is «Nicolò». */
export function nameKey(name: string): string
{
    return name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** A colleague's card: the profile's description, the open lines of their todo, the last section of their memory. */
export function cardFrom(id: string, profile: string, todo: string, memory: string): Card
{
    const text = memory.replace(/\r\n/g, "\n");
    const sections = text.split(/^(?=## )/m).filter(section => section.startsWith("## "));
    return {
        id,
        description: field(normalized(profile), "description") ?? "",
        openTasks: openTasks(todo),
        memory: (sections.at(-1) ?? text.split("\n").slice(-12).join("\n")).trim(),
        memorySize: memorySizeOf(memory),
        profile: profileSections(profile),
    };
}

// The template's headed sections a card shows, by place: what they know (first) and how they work (third).
const shownHeadings = [0, 2];

/** A profile's body in sections: each paragraph of its opening led by a bold title ("**Who you are.** …"), then the template's first
 * and third "## " sections, what they know and how they work; the project, what they return and their memory are instructions, left
 * out with the frontmatter and the heading. */
function profileSections(profile: string): Card["profile"]
{
    const body = normalized(profile).replace(/^---\n[\s\S]*?\n---\n/, "").replace(/^\s*# [^\n]*\n/, "");
    const sections: Card["profile"] = [];
    let headed = 0;

    for (const part of body.split(/^(?=## )/m)) {
        if (part.startsWith("## ")) {
            const [heading = "", ...lines] = part.split("\n");

            if (shownHeadings.includes(headed++)) {
                sections.push({ title: heading.replace(/^##\s*/, "").trim(), text: lines.join("\n").trim() });
            }

            continue;
        }

        for (const paragraph of part.split(/\n\s*\n/).map(text => text.trim()).filter(Boolean)) {
            const lead = /^\*\*([^*]+?)\*\*\s*/.exec(paragraph);
            const last = sections.at(-1);

            if (lead) {
                sections.push({ title: (lead[1] ?? "").trim().replace(/[.:]$/, ""), text: paragraph.slice(lead[0].length).trim() });
            } else if (last) {
                last.text = `${last.text}\n\n${paragraph}`;
            } else {
                sections.push({ title: "", text: paragraph });
            }
        }
    }

    return sections.filter(section => section.text);
}

/** How long a colleague's MEMORY.md may grow: Claude Code hands them only its beginning, so past this it is compacted into notes. */
const memoryLimit = { lines: 80, bytes: 10 * 1024 };

/** A memory's length, and whether it is past what it may hold. */
export function memorySizeOf(memory: string): { lines: number; bytes: number; isLong: boolean }
{
    const lines = memory ? memory.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n").length : 0;
    // Its bytes in UTF-8, as the file holds them: the panel's code has no encoder of its own.
    const bytes = [...memory].reduce((sum, character) => {
        const point = character.codePointAt(0) ?? 0;
        return sum + (point < 0x80 ? 1 : point < 0x800 ? 2 : point < 0x10000 ? 3 : 4);
    }, 0);
    return { lines, bytes, isLong: lines > memoryLimit.lines || bytes > memoryLimit.bytes };
}

// The tools a colleague's memory needs, whatever their permissions.
const memoryTools = ["Read", "Edit", "Write"];

/** A colleague as an agent type the panel defines, for a profile Claude Code has not loaded: its frontmatter's description, tools,
 * model and effort, and its body as the prompt. Their memory folder is named in the prompt, since a type of the panel's own
 * would keep a memory of its own elsewhere. */
export function agentSpecFrom(id: string, profile: string, memoryFolder: string): { name: string; description: string; prompt: string; tools?: string[]; model?: string; effort?: string }
{
    const text = normalized(profile);
    const tools = listField(text, "tools");
    const model = field(text, "model");
    const effort = field(text, "effort");
    const body = text.replace(/^---\n[\s\S]*?\n---\n/, "").trim();
    const memory = `Your memory is the folder ${memoryFolder}/: read its MEMORY.md and todo.md before anything else, and write what you learn there, `
        + "as your profile says.";
    return {
        name: id,
        description: field(text, "description") ?? id,
        prompt: `${body}\n\n${memory}`,
        // Their memory is always theirs to read and write, as Claude Code gives a profile with `memory: project`: without the
        // permissions the panel refuses the rest of the project (register.tsx, refusalFor).
        ...(tools === undefined ? {} : { tools: [...new Set([...toolsOf(tools), ...memoryTools])] }),
        ...(model ? { model } : {}),
        ...(effort ? { effort } : {}),
    };
}

/** The colleague behind an agent type: "matteo-conti", or "plugin:matteo-conti" for an agent a plugin ships. */
export function colleagueOf(team: Colleague[], subagentType: string): Colleague | undefined
{
    const bare = subagentType.replace(/^[^:]*:/, "");
    return team.find(colleague => colleague.id === bare);
}

/** The profile with its effort set, or without the line, so the colleague works at the session's effort; a profile with no
 * frontmatter is left as it is. */
export function withEffort(profile: string, level: string | undefined): string
{
    const newline = profile.includes("\r\n") ? "\r\n" : "\n";
    const lines = profile.replace(/\r\n/g, "\n").split("\n");
    const end = lines[0]?.replace(/^\uFEFF/, "") === "---" ? lines.indexOf("---", 1) : -1;

    if (end < 0) {
        return profile;
    }

    const at = lines.findIndex((line, index) => index > 0 && index < end && /^effort\s*:/.test(line));

    if (at >= 0 && level) {
        lines[at] = `effort: ${level}`;
    } else if (at >= 0) {
        lines.splice(at, 1);
    } else if (level) {
        lines.splice(end, 0, `effort: ${level}`);
    }

    return lines.join(newline);
}

/** The permissions a tools line gives; no line means every tool, so every permission. Running commands can change any file, so
 * Bash gives writing too. */
export function permissionsOf(tools: string | undefined): Permissions
{
    if (tools === undefined) {
        return { read: true, write: true, test: true, web: true };
    }

    const names = toolsOf(tools);
    return {
        read: names.includes("Grep") || names.includes("Glob"),
        write: names.includes("Edit") || names.includes("Write") || names.includes("Bash"),
        test: names.includes("Bash"),
        web: names.includes("WebSearch") || names.includes("WebFetch"),
    };
}

/** The profile with its tools line written from the permissions: Read always, for their memory; the other tools it had, kept. */
export function withPermissions(profile: string, permissions: Permissions): string
{
    const newline = profile.includes("\r\n") ? "\r\n" : "\n";
    const lines = profile.replace(/\r\n/g, "\n").split("\n");
    const end = lines[0]?.replace(/^\uFEFF/, "") === "---" ? lines.indexOf("---", 1) : -1;

    if (end < 0) {
        return profile;
    }

    const at = lines.findIndex((line, index) => index > 0 && index < end && /^tools[ \t]*:/.test(line));
    // A tools list written as YAML items under the key becomes one comma line, and its items go.
    const items = at >= 0 ? listItems(lines, at + 1, end) : [];
    const written = [lines[at]?.replace(/^tools[ \t]*:/, "") ?? "", ...items].join(",");
    // The step tool kept its old name while the panel was its own plugin, crew-mod.
    const others = at >= 0 ? toolsOf(written).filter(name => !managedTools.includes(name)).map(name => (name === "mcp__crew-mod__step" ? stepTool : name)) : [stepTool];
    const tools = [
        "Read",
        ...(permissions.read ? ["Grep", "Glob"] : []),
        ...(permissions.write ? ["Edit", "Write"] : []),
        ...(permissions.test ? ["Bash"] : []),
        ...(permissions.web ? ["WebSearch", "WebFetch"] : []),
        ...others,
    ];

    if (at >= 0) {
        lines.splice(at, 1 + items.length, `tools: ${tools.join(", ")}`);
    } else {
        lines.splice(end, 0, `tools: ${tools.join(", ")}`);
    }

    return lines.join(newline);
}

/** A task of the backlog: its words, and what its line says of it: priority, the day it was written, the effort it needs. */
export type Task = { colleague: string; text: string; priority?: string; date?: string; id?: string; effort?: string; after?: string[]; line?: string };

/** The open tasks that ask to try something again: those starting with Riprova, Retest, Re-test or Check again. */
export function retestsOf(tasks: string[]): string[]
{
    return tasks.filter(task => /^(?:riprov|re-?test|check again)/i.test(taskOf("", task).text.replace(/^[\s*_`]+/, "")));
}

/** Up to `limit` open tasks, by priority (P1, P2, P3, then those without), the oldest first within one, those without a date
 * last; where all that is equal, every colleague's next one in turn. With `held`, the places the tasks had a moment ago, by
 * "<colleague>:<words>", come first: a priority just turned leaves its task under the pointer. */
export function backlogOf(tasks: { colleague: string; lines: string[] }[], limit: number, held?: Map<string, number>): Task[]
{
    const ranked = tasks.flatMap((group, groupIndex) => group.lines.map((line, index) => ({ task: taskOf(group.colleague, line), index, groupIndex })));
    const rank = (task: Task) => (task.priority ? priorities.indexOf(task.priority) : priorities.length);
    const place = (task: Task) => held?.get(`${task.colleague}:${task.text}`) ?? Number.MAX_SAFE_INTEGER;
    ranked.sort((first, second) => (held ? place(first.task) - place(second.task) : 0)
        || rank(first.task) - rank(second.task)
        || (first.task.date ?? "9999").localeCompare(second.task.date ?? "9999")
        || first.index - second.index
        || first.groupIndex - second.groupIndex);
    // Each task keeps its own line of the todo, to change or remove it there.
    return ranked.slice(0, limit).map(entry => ({ ...entry.task, line: tasks[entry.groupIndex]?.lines[entry.index] }));
}

/** A todo line's parts: `P2 · 2026-10-29 · #matteo-3 · the task (after: #elena-1, T-62) (effort: high)`, each but the words optional:
 * the id is there when other tasks wait for this one, or is the number of the project's backlog task the line is the colleague's part
 * of (`T-61`); `after` names the tasks this one waits for, todo lines or backlog tasks, in any order with the effort. Every drawing of
 * the panel reads every open line, so a line is read once and its parts kept, frozen, while it is open. */
export function taskOf(colleague: string, line: string): Task
{
    const key = `${colleague}\n${line}`;
    const kept = readTasks.get(key);

    if (kept) {
        return kept;
    }

    // Lines closed or changed leave their parts behind: past a bound, all go and the open ones are read again.
    if (readTasks.size >= readTasksLimit) {
        readTasks.clear();
    }

    const task = Object.freeze(partsOf(colleague, line));
    readTasks.set(key, task);
    return task;
}

const readTasks = new Map<string, Task>();
const readTasksLimit = 20_000;

function partsOf(colleague: string, line: string): Task
{
    const head = /^(?:(P[1-3]) · )?(?:(\d{4}-\d{2}-\d{2}) · )?(?:(#[\w-]+|[A-Z]+-\d+) · )?/.exec(line);
    let rest = line.slice(head?.[0].length ?? 0);
    let effort: string | undefined;
    let after: string[] | undefined;

    // The suffixes, read from the end, whichever comes last.
    for (let found = true; found;) {
        const effortMatch = /\s*\(effort:\s*(low|medium|high|xhigh|max)\)\s*$/i.exec(rest);
        const afterMatch = /\s*\(after:\s*([^)]*)\)\s*$/i.exec(rest);
        const match = effortMatch ?? afterMatch;
        found = Boolean(match);

        if (effortMatch) {
            effort = effortMatch[1]?.toLowerCase();
        } else if (afterMatch) {
            after = (afterMatch[1] ?? "").split(/[,\s]+/).filter(id => /^#[\w-]+$/.test(id) || isBacklogId(id));
        }

        if (match) {
            rest = rest.slice(0, match.index);
        }
    }

    return {
        colleague,
        text: rest,
        ...(head?.[1] ? { priority: head[1] } : {}),
        ...(head?.[2] ? { date: head[2] } : {}),
        ...(head?.[3] ? { id: head[3] } : {}),
        ...(effort ? { effort } : {}),
        ...(after?.length ? { after } : {}),
    };
}

/** The tasks a task still waits for: those of its `after` whose line is still open in some todo, with who holds them. */
export function blockersOf(task: Task, open: Map<string, string>): { id: string; colleague: string }[]
{
    return (task.after ?? []).flatMap(id => (open.has(id) ? [{ id, colleague: open.get(id) ?? "" }] : []));
}

/** The ids of the open tasks of every todo, with who holds each. A backlog task's number (`T-61`) is open as the project's backlog
 * says, held by whom it names, once the backlog was read; else while a todo line carries it open. */
export function openIdsOf(tasks: { colleague: string; lines: string[] }[], backlog?: BacklogTask[]): Map<string, string>
{
    const open = new Map(tasks.flatMap(group => group.lines.flatMap(line => {
        const id = taskOf(group.colleague, line).id;
        return id && !(backlog && isBacklogId(id)) ? [[id, group.colleague] as const] : [];
    })));

    for (const task of backlog ?? []) {
        open.set(task.id, task.to);
    }

    return open;
}

/** An open task of the project's backlog, the project plugin's: its number (`T-61`), who holds it (a colleague's first name or a
 * person), and what a todo line says of a task. */
export type BacklogTask = {
    id: string;
    to: string;
    priority?: string;
    date?: string;
    text?: string;
    after?: string[];
    type?: string;
    due?: string;
    by?: string;
    started?: string;
    state?: string;
    /** The project's specifications it does, by number (`S-12`), from its `see`. */
    specs?: string[];
};

/** The backlog's tasks each colleague holds, by their first name, written as todo lines (`P1 · 2026-10-28 · T-61 · the board
 * (after: T-62)`), by colleague id. A todo line that cites a task (`T-61 · retest once it is done`) is its colleague's own reminder,
 * never the task: the task shows all the same. */
export function backlogLinesOf(backlog: BacklogTask[], team: { id: string; name: string }[]): Map<string, string[]>
{
    const lines = new Map<string, string[]>();

    for (const task of backlog) {
        const holder = team.find(colleague => nameKey(colleague.name) === nameKey(task.to));

        if (!holder) {
            continue;
        }

        const head = [task.priority && /^P[1-3]$/.test(task.priority) ? task.priority : "", task.date ?? "", task.id].filter(Boolean).join(" · ");
        const after = task.after?.length ? ` (after: ${task.after.join(", ")})` : "";
        lines.set(holder.id, [...(lines.get(holder.id) ?? []), `${head} · ${task.text ?? ""}${after}`]);
    }

    return lines;
}

/** Whether an id names a task of the project's backlog, `T-61`, rather than a todo line, `#matteo-3`. */
export function isBacklogId(id: string): boolean
{
    return /^[A-Z]+-\d+$/.test(id);
}

/** A todo line with its next priority, P1 to P2 to P3 and back to P1, a line without one becoming P1; its date kept, or today's
 * when it had none. */
export function withNextPriority(line: string, today: string): string
{
    const task = taskOf("", line);
    const next = task.priority ? priorities[(priorities.indexOf(task.priority) + 1) % priorities.length] : priorities[0];
    const head = /^(?:P[1-3] · )?(?:\d{4}-\d{2}-\d{2} · )?/.exec(line)?.[0] ?? "";
    return `${next} · ${task.date ?? today} · ${line.slice(head.length)}`;
}

/** A todo line with new words, its priority, date, id and suffixes kept. */
export function withText(line: string, text: string): string
{
    const head = /^(?:P[1-3] · )?(?:\d{4}-\d{2}-\d{2} · )?(?:(?:#[\w-]+|[A-Z]+-\d+) · )?/.exec(line)?.[0] ?? "";
    return `${head}${text}${line.slice(head.length + taskOf("", line).text.length)}`;
}

/** Whole days from one day to another, both YYYY-MM-DD: negative when `to` comes first. */
export function daysBetween(from: string, to: string): number
{
    return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Whole days from a task's date to `now`; undefined without a date. */
export function ageOf(date: string | undefined, now: number): number | undefined
{
    const written = date ? Date.parse(`${date}T00:00:00`) : NaN;
    return Number.isNaN(written) ? undefined : Math.max(0, Math.floor((now - written) / 86_400_000));
}

const priorities = ["P1", "P2", "P3"];

/** The open lines of a todo, without their box. */
export function openTasks(todo: string): string[]
{
    return [...todo.replace(/\r\n/g, "\n").matchAll(/^\s*- \[ \]\s*(.+)$/gm)].map(match => match[1]?.trim() ?? "");
}

// The tools the permissions stand for; the panel's own tool goes with every colleague it draws.
const managedTools = ["Read", "Grep", "Glob", "Edit", "Write", "Bash", "WebSearch", "WebFetch"];
const stepTool = "mcp__crew__step";

function toolsOf(line: string): string[]
{
    return line.replace(/["'\[\]]/g, "").split(",").map(name => name.trim()).filter(Boolean);
}

// A key's value on its own line: never the next line's, for a key left empty.
function field(text: string, key: string): string | undefined
{
    return new RegExp(`^${key}:[ \\t]*["']?(.+?)["']?[ \\t]*$`, "m").exec(frontmatterOf(text))?.[1];
}

// A key's value on its line, or its YAML items on the lines under it, as one comma line; undefined without the key or a value.
function listField(text: string, key: string): string | undefined
{
    const lines = frontmatterOf(text).split("\n");
    const at = lines.findIndex(line => new RegExp(`^${key}[ \\t]*:`).test(line));

    if (at < 0) {
        return undefined;
    }

    const inline = (lines[at] ?? "").slice((lines[at] ?? "").indexOf(":") + 1).trim();

    if (inline) {
        return inline;
    }

    const items = listItems(lines, at + 1, lines.length);
    return items.length ? items.join(", ") : undefined;
}

// The YAML items from `start` on, up to the first line that is not one or `end`.
function listItems(lines: string[], start: number, end: number): string[]
{
    const items: string[] = [];

    for (let index = start; index < end; index++) {
        const item = /^[ \t]*-[ \t]+(.+?)[ \t]*$/.exec(lines[index] ?? "");

        if (!item) {
            break;
        }

        items.push(item[1] ?? "");
    }

    return items;
}

// A file's text without its byte order mark, with plain line ends.
function normalized(text: string): string
{
    return text.replace(/^﻿/, "").replace(/\r\n/g, "\n");
}

function frontmatterOf(text: string): string
{
    return /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? "";
}

/** Whether a profile is the coordinator's, `coordinator: true` in its frontmatter: the Claude of the chat, hired as a colleague, never
 * started as a subagent. */
export function isCoordinatorProfile(profile: string): boolean
{
    return /^coordinator:[ \t]*true[ \t]*$/m.test(frontmatterOf(normalized(profile)));
}

/** The rule on whose a memory is, for the coordinator and the colleagues alike: several people may work on the project, each with their
 * own Claude, and share the memories. */
export function whoseRule(person?: string): string
{
    return person
        ? `Several people may work on this project, each with their own Claude, and the memories are shared: write whose each preference, decision or request is, by name ("${person} prefers…"), never "the user". The person in this chat is ${person}.`
        : "Several people may work on this project, each with their own Claude, and the memories are shared: write whose each preference, decision or request is, by name when you know it, never \"the user\".";
}

/** A memory's index as Claude Code hands it to a colleague: its first 80 lines, within 10 KB. */
export function memoryIndexOf(memory: string): string
{
    const lines = normalized(memory).replace(/\n+$/, "").split("\n").slice(0, memoryLimit.lines);

    while (lines.length && memorySizeOf(lines.join("\n")).bytes > memoryLimit.bytes) {
        lines.pop();
    }

    return lines.join("\n").trim();
}

/** The coordinator's section of the chat's system prompt: who they are, from their profile without its frontmatter and heading, and
 * their memory's index, the rest read when the work needs it. */
export function coordinatorPromptOf(coordinator: { id: string; name: string; fullName: string; role: string }, profile: string, memory: string, person?: string): string
{
    const body = normalized(profile).replace(/^---\n[\s\S]*?\n---\n/, "").replace(/^\s*# [^\n]*\n/, "").trim();
    const index = memoryIndexOf(memory);
    const who = coordinator.role ? `${coordinator.fullName}, ${coordinator.role}` : coordinator.fullName;
    return [
        `# You are ${coordinator.fullName}`,
        `In this project you are ${who}: the coordinator of the team, the Claude of this chat, hired with the Crew plugin. This is who you are in every turn of this chat: your name, character and voice are below, while your tools, your rules and the user's instructions are this chat's, as always. The colleagues are subagents you hand work to; you are never started as one. In a talk or a meeting with colleagues you are still yourself: they speak in their own voices, as Crew's conversation says, and your turns, when you speak to the user, start with [${coordinator.name}], which the chat draws with your name and face. Anywhere else you write as always, with no name in front. A colleague at work, started as a subagent, is not you and leaves this section aside.`,
        body,
        "## Your memory",
        `Your memory is the folder .claude/agent-memory/${coordinator.id}/: its MEMORY.md, below, is the index, at most 80 lines; open a note it links when the work needs it. Write what you learn there as the colleagues do: edit it, never rewrite it whole, since other chats and other people write to it too. ${whoseRule(person)}`,
        index || "(Nothing yet.)",
    ].filter(Boolean).join("\n\n");
}

/** Who holds the backlog's tasks, `people` of a project's .claude/project.yaml, in order: the first is Claude. As YAML writes a list of
 * names: inline, `people: [Claude, "Ann", O'Brien]`, over one line or more; or one `- Name` a line beneath it, indented or not; or one
 * name alone. Comments are left out, a quoted name kept whole with its escapes. Empty without them. */
export function peopleOf(config: string): string[]
{
    const text = config.replace(/\r\n/g, "\n");
    const key = /^people:/m.exec(text);

    if (!key) {
        return [];
    }

    const from = key.index + key[0].length;
    const lineEnd = text.indexOf("\n", from) < 0 ? text.length : text.indexOf("\n", from);
    const value = text.slice(from, lineEnd).trim();

    if (value.startsWith("[")) {
        return flowItemsOf(text, text.indexOf("[", from) + 1);
    }

    if (value && !value.startsWith("#")) {
        return [scalarAt(value, 0, "").value].filter(Boolean);
    }

    const people: string[] = [];

    for (const line of text.slice(lineEnd + 1).split("\n")) {
        if (!line.trim() || /^[ \t]*#/.test(line)) {
            continue;
        }

        const item = /^[ \t]*-(?:[ \t]+(.*))?$/.exec(line);

        if (!item) {
            break;
        }

        people.push(scalarAt(item[1] ?? "", 0, "").value);
    }

    return people.filter(Boolean);
}

// The items of an inline list, from just past its "[": comments and line breaks between them left out.
function flowItemsOf(text: string, from: number): string[]
{
    const items: string[] = [];
    let at = pastBlanks(text, from);

    while (at < text.length && text[at] !== "]") {
        const item = scalarAt(text, at, ",]");
        items.push(item.value);
        at = pastBlanks(text, item.end);

        if (text[at] !== ",") {
            break;
        }

        at = pastBlanks(text, at + 1);
    }

    return items.filter(Boolean);
}

// Past the blanks, the line breaks and the comments from `from`.
function pastBlanks(text: string, from: number): number
{
    let at = from;

    while (at < text.length) {
        if (/\s/.test(text[at] ?? "")) {
            at += 1;
        } else if (text[at] === "#") {
            const end = text.indexOf("\n", at);
            at = end < 0 ? text.length : end;
        } else {
            break;
        }
    }

    return at;
}

// A YAML scalar at `from`: quoted, with its escapes ("Ann \"the owner\"", 'O''Brien'), or plain, up to one of `stops`, the line's end
// or a comment. The value, and where it ends.
function scalarAt(text: string, from: number, stops: string): { value: string; end: number }
{
    const quote = text[from];

    if (quote === "\"" || quote === "'") {
        let value = "";
        let at = from + 1;

        while (at < text.length) {
            const char = text[at] ?? "";

            if (quote === "'" && char === "'" && text[at + 1] === "'") {
                value += "'";
                at += 2;
            } else if (quote === "\"" && char === "\\" && at + 1 < text.length) {
                value += text[at + 1] ?? "";
                at += 2;
            } else if (char === quote) {
                return { value: value.trim(), end: at + 1 };
            } else {
                value += char;
                at += 1;
            }
        }

        return { value: value.trim(), end: at };
    }

    let at = from;

    while (at < text.length && text[at] !== "\n" && !stops.includes(text[at] ?? "") && !(text[at] === "#" && /\s/.test(text[at - 1] ?? ""))) {
        at += 1;
    }

    return { value: text.slice(from, at).trim(), end: at };
}

/** The task types a project adds or renames, `types:` of its .claude/project.yaml, by key: `types: { design: Design }`, or the
 * `key: Name` lines beneath it. Empty without them. */
export function typesOf(config: string): Record<string, string>
{
    const text = config.replace(/\r\n/g, "\n");
    const inline = /^types:[ \t]*\{([^}]*)\}/m.exec(text)?.[1];
    const pairs = inline !== undefined ? inline.split(",") : (/^types:[ \t]*(?:#.*)?\n((?:[ \t]+.*(?:\n|$))*)/m.exec(text)?.[1] ?? "").split("\n");
    const unquoted = (value: string) => value.trim().replace(/^["']|["']$/g, "");
    return Object.fromEntries(pairs.flatMap(pair => {
        const match = /^\s*([\w-]+)\s*:\s*(.*?)\s*$/.exec(pair.replace(/\s+#.*$/, ""));
        const name = unquoted(match?.[2] ?? "");
        return match?.[1] && name ? [[match[1], name] as const] : [];
    }));
}
