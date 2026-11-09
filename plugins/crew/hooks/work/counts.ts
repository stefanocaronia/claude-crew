// The week's counts of each colleague, kept across sessions in the plugin's store: tasks given, refusals, tokens.
import type { EngineInterface } from "claude-code";

import type { WeeklyCounts } from "../../types";

import { isoWeek } from "../text/index.ts";
import { withCount } from "./progress.ts";

const weeksKept = 8;
// The week's counts are written one after the other, so two at once both count.
let counting: Promise<void> = Promise.resolve();

/** The counts of the weeks kept, from the plugin's store; nothing when it cannot be read. */
export async function weeklyCounts($: EngineInterface): Promise<WeeklyCounts>
{
    try {
        const stored = await $.store.get("weekly");
        return stored && typeof stored === "object" ? stored as WeeklyCounts : {};
    } catch {
        return {};
    }
}

/** One more task or refusal for a colleague this week, or their tokens, kept across sessions; only the last weeks stay. */
export async function countWeek($: EngineInterface, id: string, kind: "tasks" | "refusals" | "tokens", amount = 1): Promise<void>
{
    counting = counting.then(async () => {
        await $.store.set("weekly", withCount(await weeklyCounts($), isoWeek(await $.clock.now()), id, kind, weeksKept, amount));
    }).catch(() => undefined);
    await counting;
}
