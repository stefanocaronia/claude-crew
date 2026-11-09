// What a colleague at work is doing, from the tool they call, and how the panel says it.
import type { Activity } from "../../types";

import { capitalized, clip, type Words } from "../text/index.ts";
import { stepTool } from "./progress.ts";

// The sign in front of what a colleague is doing, by its kind.
const activitySigns: Record<Activity["kind"], string> = { do: "▶", run: "▶", read: "📄", edit: "✎", search: "🔎", web: "🌐", tool: "⚙" };

/** What a colleague is doing, from the tool they call: the description of their command, or the kind of action and its object. */
export function activityOf(tool: string, args: Record<string, unknown>): Activity | undefined
{
    const text = (key: string) => (typeof args[key] === "string" ? args[key] as string : "");
    const file = (key: string) => text(key).replace(/\\/g, "/").split("/").pop() ?? "";
    const short = (value: string) => clip(value.replace(/\s+/g, " ").trim(), 60);

    if (tool === stepTool) {
        return undefined;
    }

    // A command says what it does in its description; without one, its program alone.
    const command = (): Activity => (text("description") ? { kind: "do", what: short(text("description")) } : { kind: "run", what: text("command").trim().split(/\s+/)[0] ?? "" });
    const actions: Record<string, () => Activity> = {
        Read: () => ({ kind: "read", what: file("file_path") }),
        Edit: () => ({ kind: "edit", what: file("file_path") }),
        Write: () => ({ kind: "edit", what: file("file_path") }),
        NotebookEdit: () => ({ kind: "edit", what: file("notebook_path") }),
        Grep: () => ({ kind: "search", what: `"${short(text("pattern"))}"` }),
        Glob: () => ({ kind: "search", what: short(text("pattern")) }),
        Bash: command,
        PowerShell: command,
        WebSearch: () => ({ kind: "web", what: short(text("query")) }),
        WebFetch: () => ({ kind: "web", what: short(text("url").replace(/^https?:\/\//, "")) }),
    };
    return actions[tool]?.() ?? { kind: "tool", what: tool.replace(/^mcp__[^_]+__/, "") };
}

/** What a colleague is doing, in the panel's words: their command's own description as written, a sentence around the rest. */
export function activityText(say: Words, activity: Activity | string | undefined): string
{
    if (!activity || typeof activity === "string") {
        return activity ?? "";
    }

    return `${activitySigns[activity.kind]} ${activity.kind === "do" ? capitalized(activity.what) : say.doing[activity.kind](activity.what)}`;
}
