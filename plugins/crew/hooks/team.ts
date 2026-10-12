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
    const text = profile.replace(/^﻿/, "").replace(/\r\n/g, "\n");
    const heading = /^# (.+)$/m.exec(text.replace(/^---\n[\s\S]*?\n---\n/, ""))?.[1]?.trim() ?? id;
    const [fullName = id, ...role] = heading.split(",");
    const color = field(text, "color");
    return {
        id,
        name: fullName.trim().split(/\s+/)[0] ?? id,
        fullName: fullName.trim(),
        role: role.join(",").trim(),
        color: (color && colors[color.toLowerCase()]) ?? (color?.startsWith("#") ? color : gray),
        model: field(text, "model"),
        effort: field(text, "effort"),
        permissions: permissionsOf(listField(text, "tools")),
        openTasks: openTasks(todo).length,
        avatarStamp,
    };
}

/** A colleague's card: the profile's description, the open lines of their todo, the last section of their memory. */
export function cardFrom(id: string, profile: string, todo: string, memory: string): Card
{
    const text = memory.replace(/\r\n/g, "\n");
    const sections = text.split(/^(?=## )/m).filter(section => section.startsWith("## "));
    return {
        id,
        description: field(profile.replace(/\r\n/g, "\n"), "description") ?? "",
        openTasks: openTasks(todo),
        memory: (sections.at(-1) ?? text.split("\n").slice(-12).join("\n")).trim(),
        profile: profileSections(profile),
    };
}

/** A profile's body in sections: each paragraph of its opening led by a bold title ("**Who you are.** …"), then each "## " section;
 * the frontmatter and the heading left out. */
export function profileSections(profile: string): Card["profile"]
{
    const body = profile.replace(/\r\n/g, "\n").replace(/^\uFEFF?---\n[\s\S]*?\n---\n/, "").replace(/^\s*# [^\n]*\n/, "");
    const sections: Card["profile"] = [];

    for (const part of body.split(/^(?=## )/m)) {
        if (part.startsWith("## ")) {
            const [heading = "", ...lines] = part.split("\n");
            sections.push({ title: heading.replace(/^##\s*/, "").trim(), text: lines.join("\n").trim() });
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

/** The colleague behind an agent type: "matteo-conti", or "plugin:matteo-conti" for an agent a plugin ships. */
export function colleagueOf(team: Colleague[], subagentType: string): Colleague | undefined
{
    const bare = subagentType.replace(/^[^:]*:/, "");
    return team.find(colleague => colleague.id === bare);
}

/** The heading of the last section of a memory, without its marks: "9 ottobre (notte): mappa del mondo". */
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

/** The open tasks that ask to try something again: those starting with Riprova, Retest, Re-test or Check again. */
export function retestsOf(tasks: string[]): string[]
{
    return tasks.filter(task => /^(?:riprov|re-?test|check again)/i.test(task.replace(/^[\s*_`]+/, "")));
}

/** Up to `limit` open tasks, each colleague's next one in turn; a task ending in "(effort: high)" names the effort it needs. */
export function backlogOf(tasks: { colleague: string; lines: string[] }[], limit: number): { colleague: string; text: string; effort?: string }[]
{
    const picked: { colleague: string; text: string; effort?: string }[] = [];

    for (let round = 0; picked.length < limit && tasks.some(group => group.lines.length > round); round++) {
        for (const group of tasks.filter(candidate => candidate.lines.length > round).slice(0, limit - picked.length)) {
            picked.push(taskOf(group.colleague, group.lines[round] ?? ""));
        }
    }

    return picked;
}

/** The open lines of a todo, without their box. */
export function openTasks(todo: string): string[]
{
    return [...todo.replace(/\r\n/g, "\n").matchAll(/^\s*- \[ \]\s*(.+)$/gm)].map(match => match[1]?.trim() ?? "");
}

function taskOf(colleague: string, line: string): { colleague: string; text: string; effort?: string }
{
    const match = /\s*\(effort:\s*(low|medium|high|xhigh|max)\)\s*$/i.exec(line);
    return match ? { colleague, text: line.slice(0, match.index), effort: match[1]?.toLowerCase() } : { colleague, text: line };
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

function frontmatterOf(text: string): string
{
    return /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? "";
}
