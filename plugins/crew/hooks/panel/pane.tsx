// The panel beside the chat: one drawing a time, its scene and controls, then the view the user is on.
import type { MatchedHook } from "claude-code";

import { type pane, say } from "../session/index.ts";
import { cardView } from "./card.tsx";
import { controlsOf } from "./controls.tsx";
import { reportView } from "./report.tsx";
import { sceneOf } from "./scene.ts";
import { settingsView } from "./settings.tsx";
import { warningColor } from "./style.ts";
import { teamView } from "./team.tsx";

/** The panel: the settings, a colleague's report or card, or the team; with no team yet, how to set one up. */
export const drawPane: MatchedHook<"ui.render", { component: "Pane"; requestId: typeof pane }> = async ($, e) => {
    try {
        const scene = await sceneOf($, e);
        const drawing = { ...scene, ...controlsOf($, scene) };
        const { ui, say: words, colleagues, chat, latest, panel, byId, selected, settingsButton } = drawing;
        const { Box, Text, Button } = ui;

        if (panel.isSettingsOpen) {
            return settingsView($, drawing);
        }

        if (!colleagues.length && !chat) {
            return (
                <Box flexDirection="column" gap={1} alignItems="flex-start">
                    {latest.folders?.due === "conflict" ? <Text key="folders" color={warningColor}>{words.foldersConflict(latest.folders.docs)}</Text> : null}
                    <Text key="empty" dimColor>{words.empty}</Text>
                    {latest.hasCommands
                        ? <Button key="act-init" label={`+ ${words.setUp}`} onPress={() => $.command.run({ command: "crew:init", args: "" })} />
                        : <Text key="install" dimColor>{words.installSkill}</Text>}
                    {settingsButton}
                </Box>
            );
        }

        const reading = panel.reading ? byId.get(panel.reading.colleague) : undefined;

        if (panel.reading && reading) {
            return await reportView($, drawing, reading, panel.reading.file);
        }

        if (selected) {
            return await cardView($, drawing, selected);
        }

        return await teamView($, drawing);
    } catch (error) {
        const { Text } = $.ui.resolve(e);
        return <Text dimColor>{say().drawError(error instanceof Error ? error.message : String(error))}</Text>;
    }
};
