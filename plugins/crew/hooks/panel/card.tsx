// A colleague's card: who they are, what they are on, their tasks, memory and profile, their settings; the coordinator's, the
// same without what starts or sets a colleague.
import { atom, read, update } from "claude-code";
import type { EngineInterface } from "claude-code";

import type { Colleague } from "../../types";

import { roleOf, wideBar } from "../draw/index.ts";
import { initial } from "../session/index.ts";
import { backlogOf, nextEffort, openReport, retestsOf, setEffort, setPermissions, taskOf as todoTask, toggled } from "../team/index.ts";
import { capitalized, clip, isoWeek, modelName } from "../text/index.ts";
import { contextShare, progressOf, releaseFiles, weeklyCounts } from "../work/index.ts";
import { addMark, cardNameSize, cardTaskLimit, errorColor, permissionKinds, tinted } from "./style.ts";
import type { Drawing } from "./controls.tsx";
import { costsOf, workLines } from "./run.tsx";
import { taskRow } from "./task.tsx";

const card = atom({ plugin: "crew", key: "card" } as const, initial.card);
const runs = atom({ plugin: "crew", key: "runs" } as const, initial.runs);
const view = atom({ plugin: "crew", key: "view" } as const, initial.view);

/** The card of `selected`, in place of the team until the user goes back. */
export async function cardView($: EngineInterface, drawing: Drawing, selected: Colleague)
{
    const { addTask, askOf, at, border, busy, chat, e, face, fireButton, held, iconButton, idleButton, isDesktop, isNextStarting, latest, list, name, newTaskType, outlined, panel, portraitButton, presence, priorityMark, runCommand, running, say, send, shown, startNext, talk, talkWith, taskTypes, ui } = drawing;
    const { Box, Text, Button, Markdown } = ui;
    // The coordinator's card: who they are, their tasks, memory and profile; nothing that starts or sets a colleague.
    const isChat = selected.id === chat?.id;
    const details = (await read($, card))?.id === selected.id ? await read($, card) : null;
    // A run left at work by an event that never came keeps the colleague busy: the user can free them.
    const stuck = list.filter(run => run.colleague === selected.id && run.status === "running").map(run => run.agentId);
    const isBusy = busy.has(selected.id) || talk.members.includes(selected.id);
    const current = running.find(run => run.colleague === selected.id);
    const retests = details ? retestsOf(details.openTasks).length : 0;
    const week = (await weeklyCounts($))[isoWeek(at)]?.[selected.id];
    // Their tasks as the backlog draws them, by priority and age: the first ones, or all of them when the user asks.
    const isCardTasksOpen = Boolean(panel.isCardTasksOpen);
    const cardTasks = details ? shown(backlogOf([{ colleague: selected.id, lines: details.openTasks }], isCardTasksOpen ? details.openTasks.length : cardTaskLimit, held)) : [];
    const isAdding = panel.editing === `new:${selected.id}`;
    // How many open tasks of each priority, beside their name.
    const priorityCounts = ["P1", "P2", "P3"].flatMap(priority => {
        const count = (details?.openTasks ?? []).filter(line => todoTask("", line).priority === priority).length;
        return count ? [[priority, count] as const] : [];
    });
    // Their memory's latest section, closed until asked: its heading names it.
    const isMemoryOpen = Boolean(panel.isMemoryOpen);
    const [memoryHead = "", ...memoryRest] = (details?.memory ?? "").split("\n");
    const memoryTitle = /^##\s+(.+)$/.exec(memoryHead)?.[1]?.trim() ?? "";
    const memoryBody = memoryTitle ? memoryRest.join("\n").trim() : details?.memory ?? "";
    const markFree = async () => {
        const freedAt = await $.clock.now();
        releaseFiles(stuck);
        await update($, runs, all => all.map(run => (stuck.includes(run.agentId) && run.status === "running" ? { ...run, status: "failed" as const, endedAt: freedAt } : run)));
    };
    return (
        <Box flexDirection="column" gap={1}>
            <Button key="back" label={`← ${say.team}`} plain onPress={() => update($, view, current => ({ ...current, selected: undefined }))} />
            <Box key="who" flexDirection="row" flexWrap="nowrap" gap={2} alignItems="center">
                {face(selected, 72, Boolean(presence(selected)))}
                <Box flexDirection="column" flexShrink={1}>
                    {name("card-name", selected, cardNameSize)}
                    <Text dimColor>{roleOf(selected)}</Text>
                    {isChat ? <Text key="card-coordinator" dimColor>{capitalized(say.coordinatorAbout)}</Text> : null}
                    <Box flexDirection="row" flexWrap="wrap" alignItems="center">
                        <Text dimColor>{[presence(selected), say.toDo(selected.openTasks), selected.model ? modelName(selected.model) : ""].filter(Boolean).join(" · ")}</Text>
                    </Box>
                    {priorityCounts.length
                        ? (
                            <Box key="card-priorities" flexDirection="row" flexWrap="wrap" alignItems="center" columnGap={1}>
                                {priorityCounts.map(([priority, count]) => (
                                    <Box key={`count-${priority}`} flexDirection="row" alignItems="center" columnGap={1} marginRight={1}>
                                        {priorityMark(`count-mark-${priority}`, priority)}
                                        <Text dimColor>{String(count)}</Text>
                                    </Box>
                                ))}
                            </Box>
                        )
                        : null}
                    {week ? <Text key="week" dimColor>{say.thisWeek(week.tasks, week.refusals)}</Text> : null}
                    {details?.latestReport ? <Button key="card-report" label={`${say.latestReport(details.latestReport)} ❯`} plain dimColor onPress={() => openReport($, selected.id, details.latestReport ?? "")} /> : null}
                </Box>
            </Box>
            {current
                ? (
                    <Box key="card-work" flexDirection="column">
                        <Text bold>{say.working}</Text>
                        {outlined("card-work-box", [
                            ...workLines($, drawing, "work", current, selected),
                            <Box key="work-bar" marginTop={1}>{wideBar(ui, e.surface, progressOf(current) ?? contextShare(current), progressOf(current) === undefined ? undefined : selected.color)}</Box>,
                            costsOf(drawing, "work", current),
                        ])}
                    </Box>
                )
                : null}
            {isChat ? null : <Box key="card-actions" flexDirection="row" flexWrap="wrap" gap={1}>
                {isBusy ? null : <Button key="talk" variant="primary" label={`☰ ${say.talk(selected.name)}`} onPress={() => talkWith(selected)} />}
                <Button key="card-ask" label={`? ${say.ask(selected.name)}`} onPress={() => askOf(selected)} />
                {isBusy || !selected.openTasks
                    ? null
                    : isNextStarting([selected])
                    ? idleButton("card-next", `⏳ ${say.starting}`)
                    : <Button key="card-next" label={`▶ ${say.nextWith(selected.name)}`} onPress={() => startNext([selected])} />}
                {isBusy ? null : <Button key="card-round" label={`↻ ${say.roundWith(selected.name)}`} onPress={() => runCommand("crew:review", [selected])} />}
                {retests ? <Button key="card-retest" label={`↻ ${say.retest(retests)}`} onPress={() => send(say.retestPrompt(selected.name))} /> : null}
                {stuck.length ? <Button key="card-free" label={say.markFree} plain onPress={markFree} /> : null}
            </Box>}
            {details
                ? (
                    <Box key="card-tasks" flexDirection="column" gap={1}>
                        {/* The button that opens the new task's form sits on the heading's row, on the right, as the project plugin's. */}
                        <Box flexDirection="row" justifyContent="space-between" alignItems="center">
                            <Text bold>{say.tasks}</Text>
                            <Box flexDirection="row" columnGap={2} alignItems="center">
                                {"Input" in ui && !isAdding
                                    ? <Button key="card-new-task" label={`＋ ${say.newTask}`} plain dimColor onPress={() => update($, view, now => ({ ...now, editing: `new:${selected.id}` }))} />
                                    : null}
                                {isBusy ? null : <Button key="card-tidy" label={`✦ ${say.tidy}`} plain dimColor onPress={() => runCommand("crew:tidy", [selected])} />}
                            </Box>
                        </Box>
                        {/* The form, a card like a task's: the text box at full width, then the task's type, where the project keeps
                            a backlog, and its ✕ on the right. */}
                        {"Input" in ui && isAdding
                            ? (
                                <Box key="card-new-task-form" flexDirection="column" borderStyle="round" {...border} paddingX={1} {...(isDesktop ? tinted() : {})}>
                                    <ui.Input key="card-new-task" placeholder={say.newTaskHint} rows={2} autoFocus submitLabel={addMark} onSubmit={(value: string) => addTask(selected, value)} />
                                    <Box flexDirection="row" justifyContent={latest.backlog ? "space-between" : "flex-end"} alignItems="center" marginTop={1}>
                                        {latest.backlog
                                            ? (
                                                <Box key="card-new-task-type-row" flexDirection="row" alignItems="center" columnGap={1}>
                                                    <Text dimColor>{say.taskType}</Text>
                                                    {"Select" in ui
                                                        ? <ui.Select key="card-new-task-type" value={newTaskType} options={Object.entries(taskTypes).map(([value, label]) => ({ value, label }))} onSelect={(value: string) => update($, view, now => ({ ...now, newTaskType: value }))} />
                                                        : <Button key="card-new-task-type" label={taskTypes[newTaskType] ?? newTaskType} plain onPress={() => {
                                                            const keys = Object.keys(taskTypes);
                                                            return update($, view, now => ({ ...now, newTaskType: keys[(keys.indexOf(newTaskType) + 1) % keys.length] }));
                                                        }} />}
                                                </Box>
                                            )
                                            : null}
                                        {iconButton("card-new-task-cancel", "✕", say.cancel, () => update($, view, now => ({ ...now, editing: undefined })))}
                                    </Box>
                                </Box>
                            )
                            : null}
                        {cardTasks.length ? cardTasks.map((task, index) => taskRow($, drawing, "card-task", index, task, selected, null)) : <Text key="card-no-tasks" dimColor>{say.toDo(0)}</Text>}
                        {details.openTasks.length > cardTaskLimit
                            ? <Button key="card-tasks-all" label={isCardTasksOpen ? say.showFewer : say.showAll(details.openTasks.length)} plain dimColor onPress={() => update($, view, current => ({ ...current, isCardTasksOpen: !current.isCardTasksOpen }))} />
                            : null}
                    </Box>
                )
                : null}
            {details?.memory
                ? (
                    <Box key="card-memory" flexDirection="column">
                        <Button key="card-memory-toggle" label={`${isMemoryOpen ? "▾" : "▸"} ${say.memory}${memoryTitle ? ` · ${memoryTitle}` : ""}`} plain onPress={() => update($, view, current => ({ ...current, isMemoryOpen: !current.isMemoryOpen }))} />
                        {details.memorySize.isLong
                            ? <Text key="card-memory-long" color={errorColor}>{say.memoryLong(details.memorySize.lines, Math.round(details.memorySize.bytes / 1024))}</Text>
                            : null}
                        {isMemoryOpen ? outlined("card-memory-text", [<Markdown key="memory" text={clip(memoryBody, 1600)} dimColor />]) : null}
                    </Box>
                )
                : null}
            {details?.profile.length
                ? (
                    <Box key="card-profile" flexDirection="column">
                        <Text bold>{say.profile}</Text>
                        {outlined("card-profile-list", details.profile.map((section, index) => {
                            const sectionKey = `${selected.id}:${index}`;
                            const isOpen = (panel.openProfile ?? []).includes(sectionKey);
                            const toggle = () => update($, view, current => ({ ...current, openProfile: isOpen ? (current.openProfile ?? []).filter(key => key !== sectionKey) : [...(current.openProfile ?? []), sectionKey] }));
                            return (
                                <Box key={`profile-${index}`} flexDirection="column">
                                    <Button key={`profile-toggle-${index}`} label={`${isOpen ? "▾" : "▸"} ${section.title || say.profile}`} plain onPress={toggle} />
                                    {isOpen ? <Box key={`profile-text-${index}`} paddingLeft={2} marginBottom={1}><Markdown text={section.text} /></Box> : null}
                                </Box>
                            );
                        }))}
                    </Box>
                )
                : null}
            {isChat ? null : <Box key="card-settings" flexDirection="column">
                <Text bold>{say.settings}</Text>
                {outlined("card-settings-list", [
                    <Box key="effort-row" flexDirection="row" flexWrap="wrap" alignItems="center" columnGap={1}>
                        <Text dimColor>{say.effortTitle}</Text>
                        <Button key="card-effort" label={selected.effort ? (say.levels as Record<string, string>)[selected.effort] ?? selected.effort : say.sessionLevel} plain onPress={() => setEffort($, selected.id, nextEffort(selected.effort))} />
                    </Box>,
                    <Box key="permissions-row" flexDirection="row" flexWrap="wrap" alignItems="center" columnGap={1}>
                        <Text dimColor>{say.permissions}</Text>
                        {permissionKinds.map(kind => (
                            <Button
                                key={`permission-${kind}`}
                                label={`${selected.permissions[kind] ? "☑︎" : "☐"} ${say.permissionNames[kind]}`}
                                plain
                                onPress={() => setPermissions($, selected.id, toggled(selected.permissions, kind))}
                            />
                        ))}
                    </Box>,
                ])}
            </Box>}
            <Box key="card-manage" flexDirection="row" flexWrap="wrap" gap={1}>
                {portraitButton("card-portrait", say.portrait, [selected])}
                {fireButton("card-fire", [selected])}
            </Box>
        </Box>
    );
}
