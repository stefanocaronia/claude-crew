// What the session holds for the panel and the chat: the state's values, which a reload keeps, and what this load of the module
// keeps beside them, which a reload starts over.
import type { PluginState } from "claude-code";

import type { Language } from "../text/index.ts";

/** Each value of the state before anything writes it. A file declares the atoms it uses itself, from these: the engine takes a value
 * only through an atom written in the file that reads or writes it. */
export const initial: PluginState["crew"] = {
    team: [],
    coordinator: null,
    speakers: [],
    runs: [],
    elsewhere: [],
    meeting: { members: [] },
    view: { isFinishedCollapsed: false, autoOpened: false },
    card: null,
    report: null,
    preferences: { language: "auto", autoOpen: true },
    gallery: 0,
    board: { tasks: [], checkedAt: 0, hasCommands: true },
    agentsWatched: null,
};

/** This load's own values, set again at every load: the portraits as data URIs (too large for the state, whose `gallery` says when
 * they changed), the panel's language, and the coordinator's section of the chat's system prompt. */
export const loaded = {
    portraits: new Map<string, string>(),
    /** The 32 px portraits of the backlog's rows, light enough for one on every row. */
    smallPortraits: new Map<string, string>(),
    language: "en" as Language,
    /** The language the options, Claude Code and the system ask for: what "automatic" means in the panel's settings. */
    detectedLanguage: "en" as Language,
    /** Written at every reading of the team; undefined without a coordinator. */
    coordinatorText: undefined as string | undefined,
    /** Whether this load has read the team yet: after /reload-plugins the session does not start again. */
    isTeamRead: false,
};
