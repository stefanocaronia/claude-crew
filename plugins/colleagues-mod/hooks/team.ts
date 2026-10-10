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
    const text = profile.replace(/\r\n/g, "\n");
    const heading = /^# (.+)$/m.exec(text)?.[1]?.trim() ?? id;
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
export function latestHeading(memory: string): string
{
    const headings = [...memory.replace(/\r\n/g, "\n").matchAll(/^## (.+)$/gm)].map(match => match[1]?.trim() ?? "");
    return headings.at(-1) ?? "";
}

/** The open lines of a todo, without their box. */
export function openTasks(todo: string): string[]
{
    return [...todo.replace(/\r\n/g, "\n").matchAll(/^\s*- \[ \]\s*(.+)$/gm)].map(match => match[1]?.trim() ?? "");
}

function field(text: string, key: string): string | undefined
{
    const frontmatter = /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? "";
    return new RegExp(`^${key}:\\s*["']?(.+?)["']?\\s*$`, "m").exec(frontmatter)?.[1];
}
