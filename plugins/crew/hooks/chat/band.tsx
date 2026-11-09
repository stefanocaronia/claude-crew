// During a meeting, above the prompt: who is in it, who speaks, and the controls.
import { atom, read } from "claude-code";
import type { EngineInterface, MatchedHook } from "claude-code";

import type { Colleague } from "../../types";

import { faceOf, nameOf, outline, type Table } from "../draw/index.ts";
import { setMeeting } from "../meeting/index.ts";
import { initial, say } from "../session/index.ts";

const gallery = atom({ plugin: "crew", key: "gallery" } as const, initial.gallery);
const meeting = atom({ plugin: "crew", key: "meeting" } as const, initial.meeting);
const runs = atom({ plugin: "crew", key: "runs" } as const, initial.runs);
const team = atom({ plugin: "crew", key: "team" } as const, initial.team);

/** The band above the prompt while a meeting goes on; the engine's own otherwise, and where a survey takes the place. */
export const drawBand: MatchedHook<"ui.render", { component: "AbovePrompt" }> = async ($, e, next) => {
    try {
        const talk = await read($, meeting);
        const colleagues = await read($, team);
        const byId = new Map(colleagues.map(colleague => [colleague.id, colleague]));
        const members = talk.members.flatMap(id => byId.get(id) ?? []);

        if (!members.length || e.props.hasSurvey) {
            return next(e);
        }

        const ui = $.ui.resolve(e);
        const stamp = await read($, gallery);
        const working = new Set((await read($, runs)).filter(run => run.status === "running").map(run => run.colleague));
        return meetingBand($, ui, e.surface, members, colleagues.filter(colleague => !working.has(colleague.id)), stamp);
    } catch {
        return next(e);
    }
};

// The meeting above the prompt, on one line: its title, an outlined chip for each one in it (portrait, name, who speaks, a ✕ to let
// them go), a menu to invite whoever is free, and at the right the button that closes it. Each control sends the crew plugin's
// command, as the user would type it.
function meetingBand($: EngineInterface, ui: Table, surface: string, members: Colleague[], free: Colleague[], stamp: number)
{
    const { Box, Text, Button } = ui;
    const words = say();
    const isDesktop = surface !== "terminal" && "Svg" in ui;
    const others = free.filter(colleague => !members.includes(colleague));
    // The meeting changes at once on screen, and stays so until the command's state file says the same.
    const send = (command: string, args: string, change: (ids: string[]) => string[]) => async () => {
        const current = await read($, meeting);
        const next = change(current.members);
        await setMeeting($, next, { members: next, at: await $.clock.now() });
        await $.command.run({ command, args });
    };
    const chip = (member: Colleague) => (
        <Box key={`chip-${member.id}`} flexDirection="row" flexWrap="nowrap" alignItems="center" columnGap={1} {...(isDesktop ? { borderStyle: "round" as const, borderColor: outline, paddingLeft: 1 } : {})}>
            {faceOf(ui, surface, member, 22, stamp, true)}
            {nameOf(ui, surface, member, member.name)}
            <Button key={`leave-${member.id}`} label="✕" plain dimColor onPress={send("crew:leave", member.name, ids => ids.filter(id => id !== member.id))} />
        </Box>
    );
    return (
        <Box flexDirection="column" gap={1} {...(isDesktop ? { borderStyle: "round" as const, borderColor: outline, paddingX: 1 } : {})}>
            <Box key="header" flexDirection="row" flexWrap="wrap" alignItems="center" columnGap={2}>
                <Text key="title" bold>{`☰ ${words.meeting}`}</Text>
                <Box key="gap" flexGrow={1} />
                {others.length && "Select" in ui
                ? (
                    <ui.Select
                        key="invite"
                        value="-"
                        options={[{ value: "-", label: `+ ${words.invite}` }, ...others.map(colleague => ({ value: colleague.id, label: `${colleague.name} · ${colleague.role}` }))]}
                        onSelect={value => (value === "-" ? undefined : send("crew:invite", others.find(colleague => colleague.id === value)?.name ?? value, ids => [...ids, value])())}
                    />
                )
                : null}
                <Button key="close" label={`✕ ${words.closeMeeting}`} onPress={send("crew:end", "", () => [])} />
            </Box>
            <Box key="members" flexDirection="row" flexWrap="wrap" alignItems="center" columnGap={2} rowGap={1}>
                {members.map(chip)}
            </Box>
        </Box>
    );
}
