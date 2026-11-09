// A colleague's report, from their notes, in place of the team or the card until the user goes back.
import { atom, read, update } from "claude-code";
import type { EngineInterface } from "claude-code";

import type { Colleague } from "../../types";

import { initial } from "../session/index.ts";
import type { Drawing } from "./controls.tsx";

const report = atom({ plugin: "crew", key: "report" } as const, initial.report);
const view = atom({ plugin: "crew", key: "view" } as const, initial.view);

/** The report `file` of `reading`'s notes. */
export async function reportView($: EngineInterface, drawing: Drawing, reading: Colleague, file: string)
{
    const { nameRow, opener, say, ui } = drawing;
    const { Box, Text, Button, Markdown } = ui;
    const shown = await read($, report);
    const text = shown?.colleague === reading.id && shown.file === file ? shown : null;
    return (
        <Box flexDirection="column" gap={1}>
            <Button key="report-back" label={`← ${say.back}`} plain onPress={() => update($, view, current => ({ ...current, reading: undefined }))} />
            {nameRow(`report-${reading.id}`, reading, [opener(`report-open-${reading.id}`, reading)])}
            <Text key="report-file" dimColor wrap="truncate-end">{`notes/${file}`}</Text>
            {text?.text ? <Markdown key="report-text" text={text.text} /> : <Text key="report-missing" dimColor>{say.reportMissing}</Text>}
            {text?.isCut ? <Text key="report-cut" dimColor>{say.reportCut(file)}</Text> : null}
        </Box>
    );
}
