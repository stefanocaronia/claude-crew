// The colleagues' folders among the project plugin's docs, where those are a repo of their own (scripts/folders.mjs): linked at once
// where the docs' folders are there and .claude's are not, as on a second machine; a team still in .claude, or in both places, is
// shown in the panel, whose press moves it.
import { atom, read, update } from "claude-code";
import type { EngineInterface } from "claude-code";

import { forgetAll, projectRoot } from "../files/index.ts";
import { initial, openOnce } from "../session/index.ts";
import { safeRefresh } from "./read.ts";

const board = atom({ plugin: "crew", key: "board" } as const, initial.board);
const coordinator = atom({ plugin: "crew", key: "coordinator" } as const, initial.coordinator);
const team = atom({ plugin: "crew", key: "team" } as const, initial.team);

/** Where the colleagues' folders are, linked where they can be at once, and what is left for the user to settle in the panel. */
export async function placeFolders($: EngineInterface): Promise<void>
{
    const root = await projectRoot($);

    if (!(await $.fs.exists(`${root}/.claude/project.yaml`))) {
        return;
    }

    let places = await runFolders($, ["status"]);

    if (places?.mode === "shared" && places.due === "link") {
        places = await runFolders($, ["link"]);
        forgetAll();
        await safeRefresh($);

        if ((await read($, team)).length || (await read($, coordinator))) {
            await openOnce($);
        }
    }

    const isDue = (value: string | undefined): value is "move" | "conflict" => value === "move" || value === "conflict";
    const due = places?.mode === "shared" && isDue(places.due) ? places.due : undefined;
    const docs = (places?.docs ?? "").replace(/\\/g, "/");
    const folders = due ? { due, docs: docs.toLowerCase().startsWith(`${root.toLowerCase()}/`) ? docs.slice(root.length + 1) : docs } : undefined;

    if (JSON.stringify(folders) !== JSON.stringify((await read($, board)).folders)) {
        await update($, board, current => ({ ...current, folders }));
    }
}

/** The folders script of this plugin, its JSON answer; a refusal (a move the user must settle first) as an error with its words. */
export async function runFolders($: EngineInterface, args: string[]): Promise<{ mode?: string; due?: string; docs?: string } | undefined>
{
    const root = await projectRoot($);
    const ran = await $.process.run(["node", `${$.plugin.root.replace(/\\/g, "/")}/scripts/folders.mjs`, ...args, "--root", root], { cwd: root, timeoutMs: 30_000 });

    if (ran.exitCode !== 0 && !ran.stdout.trim()) {
        throw new Error(ran.stderr.trim() || `folders.mjs ${args.join(" ")} failed`);
    }

    try {
        return JSON.parse(ran.stdout) as { mode?: string; due?: string; docs?: string };
    } catch {
        return undefined;
    }
}
