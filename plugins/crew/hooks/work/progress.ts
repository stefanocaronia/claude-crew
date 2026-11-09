// How far a colleague's run has come: the steps they report, else how full their context is.
import type { Run, WeeklyCounts } from "../../types";

/** The tool a colleague at work reports their steps with, as the engine names it. */
export const stepTool = "mcp__crew__step";

/** The steps a colleague reported, or nothing until they report; a finished run is full. */
export function progressOf(run: Run): number | undefined
{
    if (run.status === "done") {
        return 1;
    }

    return run.stepTotal ? Math.min(1, (run.stepDone ?? 0) / run.stepTotal) : undefined;
}

/** The step in progress: the tool counts the steps done and names the next, so "0 of 5" is the first; past the last, the last. */
export function stepNow(run: Run): number
{
    return Math.min((run.stepDone ?? 0) + 1, run.stepTotal ?? 1);
}

/** How full a colleague's context is. */
export function contextShare(run: Run): number
{
    return run.contextMax ? Math.min(1, run.contextTokens / run.contextMax) : 0;
}

/** The week's counts with one more task or refusal for a colleague, or their tokens added; only the last `kept` weeks stay. */
export function withCount(counts: WeeklyCounts, week: string, id: string, kind: "tasks" | "refusals" | "tokens", kept: number, amount = 1): WeeklyCounts
{
    const current = counts[week]?.[id] ?? { tasks: 0, refusals: 0 };
    const next: WeeklyCounts = { ...counts, [week]: { ...counts[week], [id]: { ...current, [kind]: (current[kind] ?? 0) + amount } } };
    return Object.fromEntries(Object.keys(next).sort().slice(-kept).map(key => [key, next[key] ?? {}]));
}
