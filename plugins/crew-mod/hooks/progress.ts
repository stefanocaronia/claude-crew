// How far a colleague's run has come: the steps they report, else how full their context is.
import type { Run } from "../types";

/** The steps a colleague reported, or nothing until they report; a finished run is full. */
export function progressOf(run: Run): number | undefined
{
    if (run.status === "done") {
        return 1;
    }

    return run.stepTotal ? Math.min(1, (run.stepDone ?? 0) / run.stepTotal) : undefined;
}

export function contextShare(run: Run): number
{
    return run.contextMax ? Math.min(1, run.contextTokens / run.contextMax) : 0;
}

/** From the first run's start to the last one's end, or to now while one still works. */
export function totalTime(runs: Run[], now: number): number
{
    if (!runs.length) {
        return 0;
    }

    const start = Math.min(...runs.map(run => run.startedAt));
    const end = Math.max(...runs.map(run => run.endedAt ?? Math.max(now, run.startedAt)));
    return end - start;
}
