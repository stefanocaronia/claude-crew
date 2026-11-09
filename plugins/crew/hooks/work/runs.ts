// A colleague's task from start to end, as the panel shows it: the run, the steps they report, what they are doing, the model's
// figures, their report kept in their notes, and the coffee break after.
import { atom, read, update } from "claude-code";
import type { EngineInterface } from "claude-code";

import type { Activity, Colleague, Run } from "../../types";

import { initial, openForWork } from "../session/index.ts";
import { colleagueOf, saveReport } from "../team/index.ts";
import { contextWindowOf } from "../text/index.ts";
import { countWeek } from "./counts.ts";
import { releaseFiles } from "./guards.ts";

const runs = atom({ plugin: "crew", key: "runs" } as const, initial.runs);
const team = atom({ plugin: "crew", key: "team" } as const, initial.team);

/** How often a colleague at work redraws the panel with their latest figures. */
export const stepRedrawEvery = 15_000;
// How long a colleague who finished stays among the finished before the coffee break.
const restAfter = 5 * 60_000;
type Steps = { model: string; effort?: string; contextTokens: number; tokens: number; at: number };
// The figures of each run waiting to be shown, and when it was last shown.
const unshown = new Map<string, Steps>();
const shownAt = new Map<string, number>();
// What each colleague at work did last, shown with their next steps.
const activities = new Map<string, Activity>();
// The agents at work that are no colleague of the team.
const strangers = new Set<string>();

/** A colleague's own progress, from their step tool: the steps planned and done, the one in progress. */
export async function reportStep($: EngineInterface, agentId: string, input: { done?: number; total?: number; note?: string }): Promise<void>
{
    await update($, runs, list => list.map(run => {
        if (run.agentId !== agentId) {
            return run;
        }

        const total = Math.max(0, Math.round(input.total ?? run.stepTotal ?? 0));
        const done = Math.max(0, Math.round(input.done ?? run.stepDone ?? 0));
        const activity = activities.get(run.agentId);
        return { ...run, stepTotal: total || undefined, stepDone: total ? Math.min(total, done) : done, stepNote: input.note?.trim() || undefined, ...(activity ? { activity } : {}) };
    }));
}

/** What a colleague at work is doing now, shown with their next steps. */
export function noteActivity(agentId: string, activity: Activity): void
{
    activities.set(agentId, activity);
}

/** A model request of a colleague at work: how full their context is, the tokens, the effort. The figures move with the steps,
 * but redraw the panel at most every so often: a click on a replaced drawing is lost. */
export async function noteSteps($: EngineInterface, agentId: string, model: string, effort: string | undefined, spent: number): Promise<void>
{
    const at = await $.clock.now();
    const kept = unshown.get(agentId);
    unshown.set(agentId, {
        model,
        effort: effort ?? kept?.effort,
        contextTokens: spent,
        tokens: (kept?.tokens ?? 0) + spent,
        at,
    });

    if (at - (shownAt.get(agentId) ?? 0) >= stepRedrawEvery) {
        await showSteps($, agentId);
    }
}

/** A colleague's task ended: the files it held let go, their answer kept in their notes, the week's tokens counted, the run closed. */
export async function endRun($: EngineInterface, agentId: string, isAnswer: boolean, answer: string): Promise<void>
{
    const at = await $.clock.now();
    const steps = takeSteps(agentId);
    activities.delete(agentId);
    releaseFiles([agentId]);
    const ended = (await read($, runs)).find(other => other.agentId === agentId);
    const file = ended && isAnswer && answer.trim() ? await saveReport($, ended, answer, at).catch(() => undefined) : undefined;
    // The week counts the tokens not yet counted: a run resumed by a message ends again with all of them.
    const tokens = ended ? withSteps(ended, steps).tokens : 0;

    if (ended && tokens > (ended.countedTokens ?? 0)) {
        await countWeek($, ended.colleague, "tokens", tokens - (ended.countedTokens ?? 0));
    }

    // One write, so the panel is redrawn once: the steps not yet shown, the end, the report's file.
    await update($, runs, list => list.map(run => (run.agentId !== agentId ? run : { ...withSteps(run, steps), status: isAnswer ? "done" : "failed", endedAt: at, countedTokens: tokens, ...(file ? { report: file } : {}) })));
}

/** A colleague's task started: the run the panel shows, and the week's count. */
export async function recordRun($: EngineInterface, colleague: Colleague, task: string, agentId: string, model: string): Promise<void>
{
    const at = await $.clock.now();
    const run: Run = {
        agentId,
        colleague: colleague.id,
        task,
        model,
        status: "running",
        startedAt: at,
        contextTokens: 0,
        contextMax: contextWindowOf(model),
        tokens: 0,
    };
    await countWeek($, colleague.id, "tasks");
    // A new task sends whoever had finished back to the coffee break: the panel shows the work now going on.
    await update($, runs, list => [...list.filter(other => other.agentId !== run.agentId).map(other => (other.status !== "running" ? { ...other, isBack: true } : other)), run].slice(-100));
    await openForWork($);
}

/** A colleague who had finished and is resumed by a message (SendMessage) is at work again, on the same run: the panel shows them
 * so, and gives them no other task meanwhile. */
export async function resume($: EngineInterface, agentId: string): Promise<void>
{
    if (strangers.has(agentId)) {
        return;
    }

    const run = (await read($, runs)).find(other => other.agentId === agentId);

    if (run?.status === "running") {
        return;
    }

    const at = await $.clock.now();

    if (!run) {
        await adopt($, agentId, at);
        return;
    }

    await update($, runs, list => list.map(other => (other.agentId !== agentId
        ? other
        : { ...other, status: "running" as const, startedAt: at, steppedAt: at, endedAt: undefined, isBack: undefined, stepDone: undefined, stepTotal: undefined, stepNote: undefined, activity: undefined })));
}

/** The session starts again at /reload-plugins too, with its colleagues still at work: only a run whose agent the engine no longer
 * has stopped with what went before. Without the list, nobody is taken for stopped. */
export async function stopLostRuns($: EngineInterface): Promise<void>
{
    const agents = await $.agent.list().catch(() => undefined);
    const alive = new Set((agents ?? []).filter(agent => !["completed", "failed", "killed"].includes(agent.status)).map(agent => agent.id));
    const isLost = (run: Run) => agents !== undefined && run.status === "running" && !alive.has(run.agentId);

    if ((await read($, runs)).some(isLost)) {
        await update($, runs, list => list.map(run => (isLost(run) ? { ...run, status: "failed" as const, endedAt: run.steppedAt ?? run.startedAt } : run)));
    }
}

/** Five minutes after finishing, a colleague goes back to the coffee break. The panel is redrawn only when someone goes: a redraw
 * loses the click that lands on the drawing it replaces. */
export async function sendRestedBack($: EngineInterface): Promise<void>
{
    const at = await $.clock.now();
    const isRested = (run: Run) => run.status !== "running" && !run.isBack && (run.endedAt ?? run.startedAt) + restAfter <= at;

    if ((await read($, runs)).some(isRested)) {
        await update($, runs, list => list.map(run => (isRested(run) ? { ...run, isBack: true } : run)));
    }
}

// A colleague at work whom the panel never saw start: spawned before it loaded, or in a session whose runs a reload or the old
// panel plugin kept elsewhere. The session's agents say who they are; an agent of no colleague is never looked up again.
async function adopt($: EngineInterface, agentId: string, at: number): Promise<void>
{
    const agent = (await $.agent.list().catch(() => [])).find(other => other.id === agentId);
    const colleague = agent ? colleagueOf(await read($, team), agent.type) : undefined;

    if (!agent || !colleague) {
        strangers.add(agentId);
        return;
    }

    const run: Run = { agentId, colleague: colleague.id, task: agent.description, model: "", status: "running", startedAt: at, steppedAt: at, contextTokens: 0, contextMax: contextWindowOf(""), tokens: 0 };
    // Its start may have been recorded while the session's agents were asked: then the run is already there.
    await update($, runs, list => (list.some(other => other.agentId === agentId) ? list : [...list, run].slice(-100)));
}

// The steps of a run not yet on screen, shown now.
async function showSteps($: EngineInterface, agentId: string): Promise<void>
{
    const steps = takeSteps(agentId);
    const activity = activities.get(agentId);

    if (steps || activity) {
        await update($, runs, list => list.map(run => (run.agentId !== agentId ? run : { ...withSteps(run, steps), ...(activity ? { activity } : {}) })));
    }
}

// The steps of a run not yet on screen, taken to be shown.
function takeSteps(agentId: string): Steps | undefined
{
    const steps = unshown.get(agentId);

    if (steps) {
        unshown.delete(agentId);
        shownAt.set(agentId, steps.at);
    }

    return steps;
}

// A run with its steps: their tokens added up, the latest context and model.
function withSteps(run: Run, steps: Steps | undefined): Run
{
    if (!steps) {
        return run;
    }

    return {
        ...run,
        model: steps.model,
        effort: steps.effort ?? run.effort,
        contextTokens: steps.contextTokens,
        contextMax: contextWindowOf(steps.model),
        tokens: run.tokens + steps.tokens,
        steppedAt: steps.at,
    };
}
