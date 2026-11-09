// The panel's pane beside the chat: opened once a session, and again when a colleague starts working.
import { atom, read, update } from "claude-code";
import type { EngineInterface } from "claude-code";

import { say } from "./language.ts";
import { initial } from "./state.ts";

const preferences = atom({ plugin: "crew", key: "preferences" } as const, initial.preferences);
const view = atom({ plugin: "crew", key: "view" } as const, initial.view);

export const pane = "crew";

/** A colleague who starts a task or joins a meeting brings the panel back, closed or not, to follow them there. */
export async function openForWork($: EngineInterface): Promise<void>
{
    if ((await $.ui.panes().catch(() => [])).some(open => open.id === pane)) {
        return;
    }

    // A session with nowhere to draw (headless) has no pane to open.
    void $.ui.open({ id: pane, title: say().pane }).catch(() => undefined);
}

/** The team is there to be seen from the start: the panel opens once, where the surface docks it beside the chat. */
export async function openOnce($: EngineInterface): Promise<void>
{
    if ((await read($, view)).autoOpened || !(await read($, preferences)).autoOpen) {
        return;
    }

    await update($, view, current => ({ ...current, autoOpened: true }));
    // A session with nowhere to draw (headless) has no pane to open.
    void $.ui.open({ id: pane, title: say().pane }).catch(() => undefined);
}
