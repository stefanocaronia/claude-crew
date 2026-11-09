// A task of a todo or of the project's backlog, in the backlog and in a colleague's card.
import { atom, update } from "claude-code";
import type { EngineInterface } from "claude-code";

import type { Colleague } from "../../types";

import { typeColor, typeSvg } from "../draw/index.ts";
import { initial } from "../session/index.ts";
import { ageOf, blockersOf, daysBetween, isBacklogId, type Task, taskWords, withText } from "../team/index.ts";
import { listNames, plainText, taskParts } from "../text/index.ts";
import { blockedColor, errorColor, idleColor, nextPriorities, removeAskFor, saveMark, staleDays, taskColor, tinted, warningColor, workingColor } from "./style.ts";
import type { Drawing } from "./controls.tsx";

const view = atom({ plugin: "crew", key: "view" } as const, initial.view);

/** A task as a row: its priority as an issue tracker draws it, its words on one line that open in place to read them whole, its
 * age, the effort it needs and a ▶ that starts it. */
export function taskRow($: EngineInterface, drawing: Drawing, prefix: string, index: number, task: Task, colleague: Colleague, face: JSX.Element | null)
{
    const { border, busy, byId, changeBacklogTask, changeTodo, chat, chip, cyclePriority, dayCount, effortCell, freeze, iconButton, isDesktop, isFree, isStarting, latest, openIds, panel, priorityMark, removeTask, running, say, startTask, tip, today, todayDate, ui } = drawing;
    const { Box, Text, Button, Link } = ui;
    const line = task.line;
    // Its words, and its links whole: on its row their words, open a link each.
    const parts = taskParts(task.text);
    const text = parts.map(part => (typeof part === "string" ? part : part.label)).join("");
    const effort = task.effort ?? colleague.effort ?? "";
    const age = ageOf(task.date, today);
    const days = age === undefined ? "" : dayCount(age);
    const taskKey = `${colleague.id}:${task.text}`;
    const isOpen = panel.openTask === taskKey;
    const toggleTask = () => update($, view, current => ({ ...current, openTask: current.openTask === taskKey ? undefined : taskKey, editing: undefined }));
    // The tasks it still waits for, from their ids: who holds them, in place of its age.
    const blockers = blockersOf(task, openIds);
    const waits = blockers.length ? say.waitsFor(listNames([...new Set(blockers.map(blocker => byId.get(blocker.colleague)?.name ?? blocker.colleague))], say.and, say.comma)) : "";
    // A task of the project's backlog, as the backlog says it: its type, its due day, who created it, since when it is in progress.
    const number = task.id && isBacklogId(task.id) ? task.id : undefined;
    const listed = number ? latest.backlog?.find(one => one.id === number) : undefined;
    const dueDays = listed?.due ? daysBetween(todayDate, listed.due) : undefined;
    const isDueNear = dueDays !== undefined && dueDays <= 7;
    const isInProgress = Boolean(listed?.started && listed.state === "doing");
    const stuckDays = isInProgress && listed?.started && isFree(colleague) ? daysBetween(listed.started, todayDate) : 0;
    const isStalled = stuckDays > staleDays;
    const priorityName = task.priority ? `${task.priority} ${say.priorityNames[task.priority as "P1"] ?? ""}`.trim() : "";
    // The open task's facts, as the project plugin draws a task's: chips of what its row does not show already. Who holds it,
    // its type and its priority are its marks, each named under the pointer; its effort and its age are on the row.
    const facts = [
        task.id && !number ? chip(`${prefix}-id-${index}`, task.id) : null,
        listed?.due ? chip(`${prefix}-due-chip-${index}`, isDueNear && dueDays !== undefined ? `⏰ ${say.dueOn(listed.due)} (${say.due(dueDays)})` : say.dueOn(listed.due), isDueNear && dueDays !== undefined ? (dueDays < 0 ? errorColor : warningColor) : undefined) : null,
        isInProgress && listed?.started ? chip(`${prefix}-started-${index}`, say.inProgress(listed.started, isStalled), isStalled ? warningColor : workingColor) : null,
        listed?.specs?.length ? chip(`${prefix}-specs-${index}`, say.does(listed.specs.join(say.comma))) : null,
        task.date ? chip(`${prefix}-born-${index}`, listed?.by ? say.createdBy(listed.by, task.date) : say.createdOn(task.date)) : null,
    ].filter((one): one is JSX.Element => one !== null);
    // A task of the project's backlog, not a line of the todo: the backlog's command changes it, and ▶ names its number.
    const backlogId = line && latest.fromBacklog?.includes(`${colleague.id}:${line}`) ? task.id : undefined;
    const startText = number ? `${number} · ${task.text}` : task.text;
    const cycle = async (current: string) => {
        await freeze();
        await (backlogId ? changeBacklogTask(colleague, ["set", backlogId, "--p", nextPriorities[task.priority ?? ""] ?? "P1"]) : cyclePriority(colleague, current));
    };
    // Remove asks first: a second press within a few seconds removes the task, archives it when it is the backlog's.
    const isRemoving = panel.removing === taskKey;
    const askRemove = async () => {
        await update($, view, current => ({ ...current, removing: taskKey }));
        $.clock.after(removeAskFor, () => void update($, view, current => (current.removing === taskKey ? { ...current, removing: undefined } : current)));
    };
    const remove = async (current: string) => {
        await update($, view, now => ({ ...now, removing: undefined }));
        await (backlogId ? changeBacklogTask(colleague, ["archive", backlogId]) : removeTask(colleague, current));
    };
    // Its words written again, in the open task: by the backlog's command, or in the todo line, its other parts kept.
    const isEditing = panel.editing === taskKey;
    const saveText = async (current: string, value: string) => {
        const written = taskWords(value);
        const isChanged = Boolean(written) && written !== task.text;
        await update($, view, now => ({ ...now, editing: undefined, openTask: isChanged ? `${colleague.id}:${written}` : now.openTask }));

        if (isChanged) {
            await (backlogId ? changeBacklogTask(colleague, ["set", backlogId, "--text", written]) : changeTodo(colleague, current, now => withText(now, written)));
        }
    };
    const runningTask = running.find(run => run.colleague === colleague.id)?.task ?? "";
    const idleReason = busy.has(colleague.id) ? say.busyTip(colleague.name, plainText(runningTask)) : say.meetingTip(colleague.name);
    const status = waits
        ? <Box key={`${prefix}-waits-${index}`} flexShrink={0}><Text color={blockedColor} wrap="truncate">{`⛓︎ ${waits}`}</Text></Box>
        : isDueNear && dueDays !== undefined && listed?.due
        ? tip(`${prefix}-due-${index}`, say.dueOn(listed.due), <Box key={`${prefix}-due-${index}`} flexShrink={0}><Text color={dueDays < 0 ? errorColor : warningColor} wrap="truncate">{`⏰ ${say.due(dueDays)}`}</Text></Box>, { isAbove: true })
        : isStalled && listed?.started
        ? tip(`${prefix}-stuck-${index}`, say.inProgress(listed.started, true), <Box key={`${prefix}-stuck-${index}`} flexShrink={0}><Text color={warningColor} wrap="truncate">{`⏸ ${dayCount(stuckDays)}`}</Text></Box>, { isAbove: true })
        : days
        ? <Box key={`${prefix}-age-${index}`} flexShrink={0}><Text dimColor wrap="truncate">{days}</Text></Box>
        : null;
    const typeMark = listed?.type
        ? tip(`${prefix}-type-${index}`, listed.type, isDesktop && "Svg" in ui
            ? <ui.Svg key={`${prefix}-type-${index}`} source={typeSvg(listed.type)} alt={listed.type} width={14} height={14} />
            : <Text key={`${prefix}-type-${index}`} color={typeColor(listed.type)}>■</Text>, { isAbove: true, isFromLeft: true })
        : null;
    // A press on the mark turns the priority, P1, P2, P3 and P1 again; a task without one shows a dim circle to start from. Its
    // name under the pointer.
    const priorityCell = line
        ? (
            <Box key={`${prefix}-priority-${index}`} flexShrink={0}>
                {task.priority ? priorityMark(`priority-${index}`, task.priority) : <Text dimColor>○</Text>}
                <Box position="absolute" top={0} left={0}>
                    <Button key={`${prefix}-cycle-${index}`} label={" "} plain onPress={() => cycle(line)} />
                </Box>
            </Box>
        )
        : null;
    return (
        <Box key={`${prefix}-${index}`} flexDirection="column" borderStyle="round" {...border} paddingX={1} {...(isDesktop ? tinted() : {})}>
            <Box flexDirection="row" flexWrap="nowrap" gap={1} alignItems="center">
                {face ? tip(`${prefix}-face-${index}`, colleague.fullName, face, { isAbove: true, isFromLeft: true }) : null}
                {typeMark}
                {priorityName && priorityCell ? tip(`${prefix}-priority-${index}`, priorityName, priorityCell, { isAbove: true, isFromLeft: true }) : priorityCell}
                {number ? <Box key={`${prefix}-number-${index}`} flexShrink={0}><Text color={taskColor} bold>{number}</Text></Box> : null}
                <Box flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden">
                    <Button key={`${prefix}-open-${index}`} plain onPress={toggleTask}>
                        <Text wrap="truncate-end">{`${isOpen ? "▾" : "▸"} ${text}`}</Text>
                    </Button>
                </Box>
                {status}
                {effortCell(`${prefix}-effort-${index}`, effort)}
                {colleague.id === chat?.id
                    ? null
                    : !isFree(colleague)
                    // A ▶ that cannot be pressed now keeps its place, gray, its reason under the pointer.
                        ? tip(`${prefix}-idle-${index}`, idleReason, <Box key={`${prefix}-idle-${index}`} flexShrink={0}><Text color={isDesktop ? idleColor : undefined} dimColor={!isDesktop}>▶</Text></Box>, { isAbove: true })
                        : isStarting(`${colleague.id}:${startText}`, [colleague.id])
                        ? <Box key={`${prefix}-starting-${index}`} flexShrink={0}><Text dimColor wrap="truncate">{`⏳ ${say.starting}`}</Text></Box>
                        : <Button key={`${prefix}-start-${index}`} label="▶" plain dimColor onPress={() => startTask(colleague, startText)} />}
            </Box>
            {isOpen
                ? (
                    <Box key={`${prefix}-details-${index}`} flexDirection="column" gap={1} paddingLeft={face ? 4 : 2}>
                        {isEditing && line && "Input" in ui
                            ? <ui.Input key={`${prefix}-edit-${index}`} value={task.text} rows={2} autoFocus submitLabel={saveMark} onSubmit={(value: string) => saveText(line, value)} />
                            : <Text>{parts.map((part, at) => (typeof part === "string" ? part : <Link key={`${prefix}-link-${index}-${at}`} href={part.href} label={part.label} />))}</Text>}
                        {facts.length ? <Box key={`${prefix}-facts-${index}`} flexDirection="row" flexWrap="wrap" gap={1}>{facts}</Box> : null}
                        {blockers.length
                            ? <Text key={`${prefix}-blockers-${index}`} color={blockedColor}>{`⛓︎ ${say.waitsFor(blockers.map(blocker => `${blocker.id} (${byId.get(blocker.colleague)?.name ?? blocker.colleague})`).join(say.comma))}`}</Text>
                            : null}
                        {line
                            ? (
                                <Box key={`${prefix}-actions-${index}`} flexDirection="row" flexWrap="wrap" columnGap={2}>
                                    {"Input" in ui
                                        ? iconButton(`${prefix}-edit-text-${index}`, isEditing ? "✕" : "✎", isEditing ? say.cancel : say.editText, () => update($, view, now => ({ ...now, editing: now.editing === taskKey ? undefined : taskKey })))
                                        : null}
                                    {/* Removing archives it, the todo line or the backlog task: the second press asks in words. */}
                                    {isRemoving
                                        ? <Button key={`${prefix}-remove-${index}`} plain onPress={() => remove(line)}><Text color={errorColor}>{`🗄 ${say.removeSure(backlogId ?? "")}`}</Text></Button>
                                        : iconButton(`${prefix}-remove-${index}`, "🗄", say.removeTask, askRemove, errorColor)}
                                </Box>
                            )
                            : null}
                    </Box>
                )
                : null}
        </Box>
    );
}
