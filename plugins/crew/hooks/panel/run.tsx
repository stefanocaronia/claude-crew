// A colleague's run on their card: what they are on, the step of their plan and what they are doing, then what it costs.
import type { EngineInterface } from "claude-code";

import type { Colleague, Run } from "../../types";

import { effortSvg, iconSvg } from "../draw/index.ts";
import { openReport } from "../team/index.ts";
import { capitalized, formatTime, formatTokens, modelName, withoutName } from "../text/index.ts";
import { activityText, contextShare, stepNow } from "../work/index.ts";
import type { Drawing } from "./controls.tsx";

/** What a colleague is on, one thing a line: the task; at work, the step of their plan, its number in their color, and what they
 * are doing now, its sign first; finished, how long it took or that it stopped, and their report. */
export function workLines($: EngineInterface, drawing: Drawing, key: string, run: Run, colleague: Colleague)
{
    const { at, say, ui } = drawing;
    const { Box, Text, Button } = ui;
    const row = (rowKey: string, children: (JSX.Element | null)[]) => (
        <Box key={rowKey} flexDirection="row" flexWrap="nowrap" alignItems="center" columnGap={1} minWidth={0} overflow="hidden">
            {children}
        </Box>
    );

    if (run.status !== "running") {
        return [
            <Text key={`task-${key}`} bold wrap="truncate-end">{withoutName(run.task, colleague)}</Text>,
            row(`end-${key}`, [
                <Text key="end" dimColor>{capitalized(run.status === "done" ? say.doneIn(formatTime((run.endedAt ?? at) - run.startedAt)) : say.failed)}</Text>,
                run.report ? <Button key={`report-${run.agentId}`} label={`${say.report} ❯`} plain dimColor onPress={() => openReport($, colleague.id, run.report ?? "")} /> : null,
            ]),
        ];
    }

    return [
        <Text key={`task-${key}`} bold wrap="truncate-end">{withoutName(run.task, colleague)}</Text>,
        run.stepTotal
            ? row(`step-${key}`, [
                <Box key="count" flexShrink={0}><Text color={colleague.color}>{capitalized(say.step(stepNow(run), run.stepTotal))}</Text></Box>,
                run.stepNote ? <Box key="note" flexShrink={1} minWidth={0} overflow="hidden"><Text dimColor wrap="truncate-end">{run.stepNote}</Text></Box> : null,
            ])
            : null,
        run.activity ? <Text key={`activity-${key}`} dimColor italic wrap="truncate-end">{activityText(say, run.activity)}</Text> : null,
    ];
}

/** What a task costs: on the desktop the model and its effort meter at the left, memory, tokens and while at work the time at the
 * right, each behind its sign with its words in a hint; the terminal says them in words. */
export function costsOf(drawing: Drawing, key: string, run: Run)
{
    const { at, isDesktop, say, tip, ui } = drawing;
    const { Box, Text } = ui;
    const isRunning = run.status === "running";
    const memory = say.memoryUsed(Math.round(contextShare(run) * 100));
    const tokens = say.tokens(formatTokens(run.tokens, say.units));
    const elapsed = isRunning ? formatTime((run.steppedAt ?? at) - run.startedAt) : "";

    if (!isDesktop || !("Svg" in ui)) {
        return <Text key={`stats-${key}`} dimColor wrap="truncate-end">{[modelName(run.model), run.effort ? say.effort(run.effort) : "", memory, tokens, elapsed].filter(Boolean).join(" · ")}</Text>;
    }

    const effortMeter = run.effort ? effortSvg(run.effort) : undefined;
    const figure = (icon: "memory" | "bolt" | "clock", value: string, hint?: string) => {
        const drawn = (
            <Box key={`${icon}-${key}`} flexDirection="row" alignItems="center" columnGap={1} flexShrink={0}>
                <ui.Svg source={iconSvg(icon, 12)} alt={hint ?? value} width={12} height={12} />
                <Text dimColor>{value}</Text>
            </Box>
        );
        return hint ? tip(`${icon}-${key}`, hint, drawn, { isAbove: true }) : drawn;
    };
    return (
        <Box key={`stats-${key}`} flexDirection="row" flexWrap="wrap" alignItems="center" justifyContent="space-between" columnGap={2} minWidth={0}>
            <Box flexDirection="row" alignItems="center" columnGap={1} flexShrink={0}>
                <Text dimColor>{modelName(run.model)}</Text>
                {run.effort && effortMeter ? tip(`effort-of-${key}`, say.effort(run.effort), <ui.Svg key="meter" source={effortMeter} alt={say.effort(run.effort)} width={16} height={12} />, { isAbove: true }) : null}
                {run.effort && !effortMeter ? <Text dimColor>{say.effort(run.effort)}</Text> : null}
            </Box>
            <Box flexDirection="row" alignItems="center" columnGap={2} flexShrink={0}>
                {figure("memory", `${Math.round(contextShare(run) * 100)}%`, memory)}
                {figure("bolt", formatTokens(run.tokens, say.units), tokens)}
                {elapsed ? figure("clock", elapsed) : null}
            </Box>
        </Box>
    );
}
