// A colleague's reports, kept in their notes so a round outlives the session, and opened in the panel.
import { atom, read, update } from "claude-code";
import type { EngineInterface } from "claude-code";

import type { Run } from "../../types";

import { projectRoot } from "../files/index.ts";
import { initial } from "../session/index.ts";
import { dateOf, slugOf, withoutName } from "../text/index.ts";
import { readCard } from "./card.ts";

const card = atom({ plugin: "crew", key: "card" } as const, initial.card);
const report = atom({ plugin: "crew", key: "report" } as const, initial.report);
const team = atom({ plugin: "crew", key: "team" } as const, initial.team);
const view = atom({ plugin: "crew", key: "view" } as const, initial.view);

// The longest report the panel draws, in characters: what is left of a drawing's 100,000 after the portraits.
const reportLimit = 40_000;

/** A colleague's answer kept in their notes, so the round's report outlives the session: notes/<date>-<task>.md, never over another. */
export async function saveReport($: EngineInterface, run: Run, answer: string, at: number): Promise<string | undefined>
{
    const colleague = (await read($, team)).find(member => member.id === run.colleague);

    if (!colleague) {
        return undefined;
    }

    const task = withoutName(run.task, colleague);
    const date = dateOf(at);
    const folder = `${await projectRoot($)}/.claude/agent-memory/${colleague.id}/notes`;
    const base = `${date}-${slugOf(task)}`;
    let file = `${base}.md`;

    for (let copy = 2; await $.fs.exists(`${folder}/${file}`); copy++) {
        file = `${base}-${copy}.md`;
    }

    await $.fs.write(`${folder}/${file}`, `# ${task} (${date})\n\n${answer.trim()}\n`);

    if ((await read($, card))?.id === colleague.id) {
        await readCard($, colleague.id);
    }

    return file;
}

/** A report of a colleague's notes shown in the panel, over the team or the card until the user goes back. A drawing carries at
 * most 100,000 characters: a long report is cut, the rest left to the file. */
export async function openReport($: EngineInterface, colleague: string, file: string): Promise<void>
{
    const path = `${await projectRoot($)}/.claude/agent-memory/${colleague}/notes/${file}`;
    const text = (await $.fs.exists(path)) ? await $.fs.read(path) : "";
    const isCut = text.length > reportLimit;
    await update($, report, () => ({ colleague, file, text: isCut ? text.slice(0, reportLimit) : text, ...(isCut ? { isCut } : {}) }));
    await update($, view, current => ({ ...current, reading: { colleague, file } }));
}
