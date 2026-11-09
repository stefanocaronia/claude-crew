// The panel's settings: its language, and whether it opens by itself.
import { atom, update } from "claude-code";
import type { EngineInterface } from "claude-code";

import { choosePreferences, initial, loaded } from "../session/index.ts";
import { type Language, languageNames } from "../text/index.ts";
import type { Drawing } from "./controls.tsx";

const view = atom({ plugin: "crew", key: "view" } as const, initial.view);

/** The panel's settings, in place of the team until the user goes back. */
export function settingsView($: EngineInterface, drawing: Drawing)
{
    const { chosen, outlined, say, ui } = drawing;
    const { Box, Text, Button } = ui;
    const codes = Object.keys(languageNames) as Language[];
    const current = codes.includes(chosen.language as Language) ? chosen.language : "auto";
    const order = ["auto", ...codes];
    const labelOf = (value: string) => (value === "auto" ? say.automatic(languageNames[loaded.detectedLanguage]) : languageNames[value as Language]);
    const choose = (value: string) => choosePreferences($, now => ({ ...now, language: value }));
    return (
        <Box flexDirection="column" gap={1}>
            <Button key="settings-back" label={`← ${say.back}`} plain onPress={() => update($, view, current => ({ ...current, isSettingsOpen: false }))} />
            <Text key="settings-title" bold>{say.panelSettings}</Text>
            {outlined("settings-list", [
                <Box key="language-row" flexDirection="row" flexWrap="wrap" alignItems="center" columnGap={1}>
                    <Text dimColor>{say.language}</Text>
                    {"Select" in ui
                        ? <ui.Select key="settings-language" value={current} options={order.map(value => ({ value, label: labelOf(value) }))} onSelect={choose} />
                        : <Button key="settings-language" label={labelOf(current)} plain onPress={() => choose(order[(order.indexOf(current) + 1) % order.length] ?? "auto")} />}
                </Box>,
                <Button key="settings-auto-open" label={`${chosen.autoOpen ? "☑\uFE0E" : "☐"} ${say.autoOpen}`} plain onPress={() => choosePreferences($, now => ({ ...now, autoOpen: !now.autoOpen }))} />,
            ])}
        </Box>
    );
}
