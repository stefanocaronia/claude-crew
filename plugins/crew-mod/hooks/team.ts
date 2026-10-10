// The project's colleagues as their files describe them: .claude/agents/<id>.md, and .claude/agent-memory/<id>/ with todo.md.
import type { Card, Colleague } from "../types";

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
    };
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

function field(text: string, key: string): string | undefined
{
    const frontmatter = /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? "";
    return new RegExp(`^${key}:\\s*["']?(.+?)["']?\\s*$`, "m").exec(frontmatter)?.[1];
}
