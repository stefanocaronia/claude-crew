// A colleague's todo changed by the panel itself: a line added, changed or removed to the archive, the file's line ends kept.
import type { EngineInterface } from "claude-code";

import { projectRoot } from "../files/index.ts";
import { dateOf } from "../text/index.ts";

// One open line of a colleague's todo changed in place, or removed when `change` gives nothing back; the file keeps its line ends.
// False when the line is no longer there: another session changed the todo meanwhile.
export async function changeTodoLine($: EngineInterface, colleague: string, line: string, change: (line: string) => string | undefined): Promise<boolean>
{
    const path = `${await projectRoot($)}/.claude/agent-memory/${colleague}/todo.md`;
    const text = await $.fs.read(path).catch(() => undefined);

    if (text === undefined) {
        return false;
    }

    const lines = text.replace(/\r\n/g, "\n").split("\n");
    const at = lines.findIndex(entry => /^\s*- \[ \]\s*(.+?)\s*$/.exec(entry)?.[1] === line);

    if (at < 0) {
        return false;
    }

    const box = /^\s*- \[ \]\s*/.exec(lines[at] ?? "")?.[0] ?? "- [ ] ";
    const changed = change(line);

    if (changed === undefined) {
        lines.splice(at, 1);
    } else {
        lines[at] = `${box}${changed}`;
    }

    await $.fs.write(path, lines.join(text.includes("\r\n") ? "\r\n" : "\n"));
    return true;
}

// A task the user removes from the panel leaves its todo for the colleague's archive, with the day: nothing is lost. A line another
// session removed meanwhile is not archived twice.
export async function removeTodoLine($: EngineInterface, colleague: string, line: string): Promise<void>
{
    if (!(await changeTodoLine($, colleague, line, () => undefined))) {
        return;
    }

    const today = dateOf(await $.clock.now());
    const archive = `${await projectRoot($)}/.claude/agent-memory/${colleague}/notes/todo-archive.md`;
    const kept = (await $.fs.exists(archive)) ? await $.fs.read(archive).catch(() => "") : "";
    const entry = `- ${today} · removed from the panel: ${line}`;
    await $.fs.write(archive, kept ? `${kept.replace(/\s*$/, "")}\n${entry}\n` : `# Todo archive\n\n${entry}\n`).catch(() => undefined);
}

// A task's words as typed in the panel: one line, without the todo's separator, with no suffix a todo line or the backlog would read
// as a part of it (`(after: T-62)` becomes `[after: T-62]`), never starting with a dash the backlog's command would read as an option.
export function taskWords(value: string): string
{
    return value.replace(/\s+/g, " ").trim().replaceAll(" · ", " - ").replace(/\((\s*[a-z]+\s*:[^)]*)\)/gi, "[$1]").replace(/^-+\s*/, "");
}

// A new open line in a colleague's todo, after its other open lines; the file keeps its line ends.
export async function addTodoLine($: EngineInterface, colleague: string, line: string): Promise<void>
{
    const path = `${await projectRoot($)}/.claude/agent-memory/${colleague}/todo.md`;
    const text = await $.fs.read(path).catch(() => "");
    const lines = text.trim() ? text.replace(/\r\n/g, "\n").replace(/\n*$/, "").split("\n") : [];
    const last = lines.reduce((found, entry, index) => (/^\s*- \[ \]/.test(entry) ? index : found), -1);
    lines.splice(last < 0 ? lines.length : last + 1, 0, `- [ ] ${line}`);
    await $.fs.write(path, `${lines.join(text.includes("\r\n") ? "\r\n" : "\n")}${text.includes("\r\n") ? "\r\n" : "\n"}`);
}
