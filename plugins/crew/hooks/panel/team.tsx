// The team: the counts at a glance and the coordinator, then who is in the meeting, at work, finished or on a coffee break, the
// team's actions and the backlog.
import { atom, update } from "claude-code";
import type { EngineInterface } from "claude-code";

import type { Colleague, Run } from "../../types";

import { drawingBudget, faceOf, iconSvg, roleOf, wideBar } from "../draw/index.ts";
import { initial, loaded } from "../session/index.ts";
import { backlogOf, openReport, placeFolders, runFolders, safeRefresh, taskOf as todoTask } from "../team/index.ts";
import { isoWeek, listNames } from "../text/index.ts";
import { contextShare, progressOf, weeklyCounts } from "../work/index.ts";
import { backlogSize, priorityGlyphs, sectionIcons, todoLimit, warningColor, weekColor, workingColor } from "./style.ts";
import type { Drawing } from "./controls.tsx";
import { costsOf, workLines } from "./run.tsx";
import { taskRow } from "./task.tsx";

const view = atom({ plugin: "crew", key: "view" } as const, initial.view);

/** The panel's main view. */
export async function teamView($: EngineInterface, drawing: Drawing)
{
    const { about, byId, canMeet, chat, colleagueCard, colleagues, e, effortButton, face, finished, fireButton, free, heading, held, idle, idleButton, isAnyNextStarting, isDesktop, isFree, latest, meetingMembers, nameRow, opener, openSettings, outlined, panel, pick, picked, pickedNames, pickedTeam, portraitButton, priorityMark, runCommand, running, say, sendBack, shown, stamp, startNext, tip, today, ui, writeMark } = drawing;
    const { Box, Text, Button } = ui;
    const runRow = (run: Run) => {
        const colleague = byId.get(run.colleague);

        if (!colleague) {
            return null;
        }

        const progress = progressOf(run);
        const isRunning = run.status === "running";
        const mark = isRunning ? "●" : run.status === "done" ? "✓" : "✗";
        return colleagueCard(run.agentId, [
            face(colleague, 40, true, isRunning),
            <Box key={`lines-${run.agentId}`} flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden">
                {nameRow(isRunning ? `open-${colleague.id}` : `open-run-${run.agentId}`, colleague, [
                    isRunning
                        ? <Text key={`mark-${run.agentId}`} color={colleague.color}>{mark}</Text>
                        : tip(`back-${run.agentId}`, say.sendBack, <Button key={`back-${run.agentId}`} label={mark} plain onPress={() => sendBack([colleague.id])} />),
                    writeMark(colleague),
                    // Once finished, the opener shows what they answered.
                    isRunning || !run.report ? opener(isRunning ? `open-${colleague.id}` : `open-run-${run.agentId}`, colleague) : opener(`open-run-${run.agentId}`, colleague, () => openReport($, colleague.id, run.report ?? ""), say.readReport),
                ])}
                <Text key={`role-${run.agentId}`} dimColor wrap="truncate-end">{run.isElsewhere ? `${roleOf(colleague)} · ${say.elsewhere}` : roleOf(colleague)}</Text>
                {workLines($, drawing, run.agentId, run, colleague)}
                <Box key={`progress-${run.agentId}`} marginTop={1}>
                    {wideBar(ui, e.surface, progress ?? contextShare(run), progress === undefined ? undefined : colleague.color)}
                </Box>
                {costsOf(drawing, run.agentId, run)}
            </Box>,
        ], colleague.color);
    };
    // A free colleague's card, tinted in their color once picked.
    const teamRow = (colleague: Colleague, canPick = true) => colleagueCard(`idle-${colleague.id}`, [
        face(colleague, 40, true),
        <Box key={`lines-${colleague.id}`} flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden">
            {nameRow(`open-${colleague.id}`, colleague, [writeMark(colleague), effortButton(`effort-${colleague.id}`, colleague), opener(`open-${colleague.id}`, colleague)])}
            <Text key={`role-${colleague.id}`} dimColor wrap="truncate-end">{roleOf(colleague)}</Text>
            <Box key={`about-${colleague.id}`} flexDirection="row" flexWrap="nowrap" alignItems="center" columnGap={1} minWidth={0} overflow="hidden">
                <Box flexShrink={1} minWidth={0} overflow="hidden">
                    <Text dimColor wrap="truncate-end">{about(colleague)}</Text>
                </Box>
                <Box flexGrow={1} />
                {canPick ? pick(colleague) : null}
            </Box>
        </Box>,
    ], colleague.color, canPick && picked.includes(colleague.id));
    // A section that folds: who is at work, who has finished, the rest of the team; each opens and closes by its title.
    const fold = (key: string, icon: string, title: string, items: (JSX.Element | null)[], isClosed: boolean, toggle: (current: typeof panel) => typeof panel, extra: JSX.Element | null = null) => (items.length
        ? (
            <Box key={key} flexDirection="column" gap={1}>
                <Box flexDirection="row" flexWrap="wrap" columnGap={2} alignItems="center">
                    {heading(key === "finished-section" ? "finished" : `${key}-toggle`, !isClosed, `${icon} ${title} (${items.length})`, () => update($, view, toggle))}
                    {extra}
                </Box>
                {isClosed ? null : <Box key={`${key}-grid`} flexDirection="row" flexWrap="wrap" gap={1}>{items}</Box>}
            </Box>
        )
        : null);
    // The team at a glance, in a few colored tiles: who is at work, the open tasks by priority, the tasks given this week. The
    // plan's limits are the app's to show.
    const thisWeek = (await weeklyCounts($))[isoWeek(today)] ?? {};
    const weekCounts = colleagues.map(colleague => thisWeek[colleague.id]);
    const weekTasks = weekCounts.reduce((sum, counts) => sum + (counts?.tasks ?? 0), 0);
    const openByPriority = new Map<string, number>();

    for (const line of latest.tasks.flatMap(group => group.lines)) {
        const task = todoTask("", line);
        openByPriority.set(task.priority ?? "", (openByPriority.get(task.priority ?? "") ?? 0) + 1);
    }

    const tile = (key: string, value: number, label: string, color: string, mark: JSX.Element | null = null) => (
        <Box key={key} flexDirection="column" flexGrow={1} borderStyle="round" paddingX={1} {...(isDesktop ? { borderColor: `${color}66`, backgroundColor: `${color}1a` } : { borderDimColor: true })}>
            <Box flexDirection="row" alignItems="center" columnGap={1}>
                {mark}
                <Text bold color={color}>{String(value)}</Text>
            </Box>
            <Text dimColor wrap="truncate-end">{label}</Text>
        </Box>
    );
    const tiles = [
        tile("dash-working", running.length, say.dashWorking, workingColor, isDesktop ? <Text color={workingColor}>●</Text> : null),
        ...["P1", "P2", "P3"].map(priority => tile(`dash-${priority}`, openByPriority.get(priority) ?? 0, say.priorityNames[priority as "P1"], priorityGlyphs[priority]?.color ?? "#888780", priorityMark(`dash-mark-${priority}`, priority))),
        ...(openByPriority.get("") ? [tile("dash-unranked", openByPriority.get("") ?? 0, say.unranked, "#888780")] : []),
        tile("dash-week", weekTasks, say.thisWeekShort, weekColor, isDesktop && "Svg" in ui ? <ui.Svg key="dash-week-mark" source={iconSvg("calendar", 14, 0, weekColor)} alt={say.thisWeekShort} width={14} height={14} /> : null),
    ];
    const backlog = shown(backlogOf(latest.tasks, backlogSize, held));
    // The colleagues whose todo is past the 15 open lines it keeps: with nobody picked, the tidy button gives them the task.
    // The coordinator among them, whom Claude tidies itself.
    const longTodos = [...colleagues, ...(chat ? [chat] : [])].filter(colleague => latest.tasks.some(group => group.colleague === colleague.id && group.lines.length > todoLimit)
        || (colleague.id === chat?.id && (latest.chatTasks?.length ?? 0) > todoLimit) || (latest.longMemories ?? []).includes(colleague.id));
    // Who the team's Next task button starts: the colleagues picked, or everyone free with something to do.
    const nextTeam = pickedTeam.length ? pickedTeam : colleagues.filter(colleague => isFree(colleague) && colleague.openTasks);
    // One weight for the whole panel: the team's portraits first, then one small portrait a row with what is left; past that,
    // initials.
    const portraitWeight = colleagues.reduce((sum, colleague) => sum + (loaded.portraits.get(colleague.id)?.length ?? 0), 0);
    const isBacklogLight = backlog.reduce((sum, task) => sum + (loaded.smallPortraits.get(task.colleague)?.length ?? 0), 0) <= drawingBudget - portraitWeight;
    // Its rows are drawn only while it is open.
    const backlogRows = !panel.isBacklogOpen ? [] : backlog.map((task, index) => {
        const colleague = byId.get(task.colleague);
        return colleague ? taskRow($, drawing, "backlog", index, task, colleague, faceOf(ui, e.surface, colleague, 24, stamp, false, false, isBacklogLight ? "small" : "initials")) : null;
    });
    const openCount = latest.tasks.reduce((sum, group) => sum + group.lines.length, 0);
    const heavy = (latest.heavy ?? []).map(id => byId.get(id)?.name ?? id);
    // The team still in .claude where the docs are a repo of their own: moved among them at the user's press.
    const moveFolders = async () => {
        try {
            await runFolders($, ["move"]);
        } catch (error) {
            await $.ui.toast(error instanceof Error ? error.message : String(error));
        }

        await placeFolders($);
        await safeRefresh($);
    };
    const folders = latest.folders?.due === "move"
        ? outlined("folders", [
            <Text key="folders-text">{say.foldersMove(latest.folders.docs)}</Text>,
            <Box key="folders-actions" flexDirection="row" marginTop={1}><Button key="folders-move" label={`⇢ ${say.foldersMoveButton}`} onPress={moveFolders} /></Box>,
        ])
        : latest.folders?.due === "conflict"
        ? <Text key="folders" color={warningColor}>{say.foldersConflict(latest.folders.docs)}</Text>
        : null;
    // The coordinator, under the counts, the whole width and no heading: the Claude of this chat, whose card opens as a
    // colleague's.
    const chatCard = chat
        ? colleagueCard(`coordinator-${chat.id}`, [
            face(chat, 40, true),
            <Box key={`lines-${chat.id}`} flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden">
                {nameRow(`open-${chat.id}`, chat, [opener(`open-${chat.id}`, chat)])}
                <Text key={`role-${chat.id}`} dimColor wrap="truncate-end">{roleOf(chat)}</Text>
                <Text key={`about-${chat.id}`} dimColor wrap="truncate-end">{about(chat)}</Text>
            </Box>,
        ], chat.color, false, true)
        : null;
    return (
        <Box flexDirection="column" gap={1}>
            {latest.error ? <Text key="error" dimColor>{say.readError(latest.error)}</Text> : null}
            {folders}
            {heavy.length ? <Text key="heavy" dimColor>{say.heavyPortraits(listNames(heavy, say.and, say.comma))}</Text> : null}
            {latest.hasCommands ? null : <Text key="install" dimColor>{say.installSkill}</Text>}
            {colleagues.length ? <Box key="dash" flexDirection="row" flexWrap="wrap" gap={1}>{tiles}</Box> : null}
            {chatCard}
            {fold("meeting", sectionIcons.meeting, say.inMeetingSection, meetingMembers.map(colleague => teamRow(colleague, false)), Boolean(panel.isMeetingCollapsed), current => ({ ...current, isMeetingCollapsed: !current.isMeetingCollapsed }))}
            {fold("working", sectionIcons.working, say.working, running.map(runRow), Boolean(panel.isWorkingCollapsed), current => ({ ...current, isWorkingCollapsed: !current.isWorkingCollapsed }))}
            {fold("finished-section", sectionIcons.finished, say.finished, finished.map(runRow), panel.isFinishedCollapsed, current => ({ ...current, isFinishedCollapsed: !current.isFinishedCollapsed }), <Button key="all-back" label={`↩ ${say.allBack}`} plain dimColor onPress={() => sendBack(finished.map(run => run.colleague))} />)}
            {fold("team", sectionIcons.resting, say.resting, idle.map(colleague => teamRow(colleague)), Boolean(panel.isTeamCollapsed), current => ({ ...current, isTeamCollapsed: !current.isTeamCollapsed }))}
            <Box key="actions" flexDirection="row" flexWrap="wrap" gap={1}>
                <Button key="act-round" variant="primary" label={`↻ ${pickedNames ? say.roundWith(pickedNames) : say.startRound}`} onPress={() => runCommand("crew:review", pickedTeam)} />
                {canMeet ? <Button key="act-meeting" label={`☰ ${pickedNames ? say.meetWith(pickedNames) : say.meetAll}`} onPress={() => runCommand("crew:meeting", pickedTeam.length ? pickedTeam : free)} /> : null}
                {pickedNames ? null : <Button key="act-hire" label={`+ ${say.hire}`} onPress={() => runCommand("crew:hire", [])} />}
                {pickedNames ? fireButton("act-fire", pickedTeam) : null}
                {portraitButton("act-portraits", say.portraits, pickedTeam)}
                <Button key="act-tidy" label={`✦ ${pickedNames ? say.tidyWith(pickedNames) : say.tidy}`} onPress={() => runCommand("crew:tidy", pickedTeam.length ? pickedTeam : longTodos)} />
                {pickedNames || colleagues.some(colleague => isFree(colleague) && colleague.openTasks)
                    ? isAnyNextStarting
                        ? idleButton("act-next", `⏳ ${say.starting}`)
                        : <Button key="act-next" label={`▶ ${pickedNames ? say.nextWith(pickedNames) : say.next}`} onPress={() => startNext(nextTeam)} />
                    : null}
                {tip("open-settings", say.panelSettings, <Button key="open-settings" label={"⚙︎"} onPress={openSettings} />)}
            </Box>
            {backlog.length
                ? (
                    <Box key="backlog" flexDirection="column" gap={1}>
                        <Box flexDirection="row" justifyContent="space-between" alignItems="center">
                            {heading("backlog-toggle", Boolean(panel.isBacklogOpen), say.backlog, () => update($, view, current => ({ ...current, isBacklogOpen: !current.isBacklogOpen })))}
                            <Text dimColor>{`${Math.min(backlogSize, openCount)}/${openCount}`}</Text>
                        </Box>
                        {panel.isBacklogOpen ? backlogRows : null}
                    </Box>
                )
                : null}
        </Box>
    );
}
