/** A colleague of the project: an agent of .claude/agents/ with a todo.md in its memory folder. */
export type Colleague = {
    id: string;
    /** The first name, how the user calls them. */
    name: string;
    fullName: string;
    role: string;
    /** A CSS color, from the profile's `color`. */
    color: string;
    model?: string;
    effort?: string;
    /** What they may do beyond their own memory and todo, from the profile's tools. */
    permissions: Permissions;
    openTasks: number;
    /** Changes when the portrait file changes, so drawings that show it are redrawn. */
    avatarStamp: number;
};

/** What the chat draws of a colleague who speaks, kept apart from the team: a change of tasks or settings redraws no message. */
export type Speaker = Pick<Colleague, "id" | "name" | "fullName" | "role" | "color">;

/** A colleague's permissions: reading the project, changing its files, running commands, searching the web. */
export type Permissions = {
    read: boolean;
    write: boolean;
    test: boolean;
    web: boolean;
};

export type RunStatus = "running" | "done" | "failed";

/** One subagent run of a colleague in this session. */
export type Run = {
    /** At work in another chat of the project, shown here as its panel shares it. */
    isElsewhere?: boolean;
    /** The tokens already added to the week's counts, for a run that ends again after a message resumes it. */
    countedTokens?: number;
    agentId: string;
    colleague: string;
    task: string;
    model: string;
    effort?: string;
    status: RunStatus;
    startedAt: number;
    endedAt?: number;
    contextTokens: number;
    contextMax: number;
    tokens: number;
    /** Reported by the colleague through the step tool. */
    stepDone?: number;
    stepTotal?: number;
    stepNote?: string;
    /** When the colleague last took a step: the time of a run at work moves with it. */
    steppedAt?: number;
    /** Sent back to the team by the user: the run no longer shows among the finished ones. */
    isBack?: boolean;
    /** The file of the colleague's notes their answer was kept in, by name. */
    report?: string;
    /** What they are doing now, from their latest tool; a plain text in runs kept by 0.8.0. */
    activity?: Activity | string;
};

/** What a colleague does with a tool: `do` is the description their command carries, shown as written; the rest are told in the
 * panel's language around `what`, a file, a pattern or a query. */
export type Activity = {
    kind: "do" | "read" | "edit" | "search" | "run" | "web" | "tool";
    what: string;
};

/** Who is in the conversation now, by colleague id, and who spoke last. */
export type Meeting = {
    members: string[];
    /** What the band's controls just set, until the command's state file says the same. */
    pending?: { members: string[]; at: number };
};

/** The team's open tasks, read from their files at every turn. */
export type Board = {
    tasks: { colleague: string; lines: string[] }[];
    /** Whether the crew plugin's commands are installed: without them nobody can talk with the team. */
    hasCommands: boolean;
    /** The colleagues whose portrait is too heavy for the drawings, by id: they are drawn with initials. */
    heavy?: string[];
    /** Why the last reading of the team failed, shown in the panel. */
    error?: string;
    checkedAt: number;
};

export type PanelView = {
    isFinishedCollapsed: boolean;
    /** Whether the sections of the colleagues in the meeting, at work and on a coffee break are folded. */
    isMeetingCollapsed?: boolean;
    isWorkingCollapsed?: boolean;
    isTeamCollapsed?: boolean;
    autoOpened: boolean;
    /** Whether the backlog shows its tasks; closed until the user opens it. */
    isBacklogOpen?: boolean;
    /** The colleagues picked on their cards for a meeting, by id. */
    picked?: string[];
    /** The colleague whose card the panel shows, by id. */
    selected?: string;
    /** Whether the panel shows its own settings. */
    isSettingsOpen?: boolean;
    /** The report the panel shows instead of the team or the card: whose, and its file in their notes. */
    reading?: { colleague: string; file: string };
    /** The sections of a colleague's profile open on their card, as "id:index". */
    openProfile?: string[];
};

/** A colleague's card: what their profile says of them, their open tasks and the latest lines of their memory. */
export type Card = {
    id: string;
    description: string;
    openTasks: string[];
    memory: string;
    /** Their profile in sections, as their card shows them folded: each bold-led paragraph of its opening, then each "## " section. */
    profile: { title: string; text: string }[];
    /** The newest round report in their notes folder, by name: "2026-10-11-review-the-parser.md". */
    latestReport?: string;
};

/** The panel's own settings, kept across sessions in the plugin's store: its language ("auto" or a code) and whether it opens at
 * the start of a session with colleagues. */
export type Preferences = {
    language: string;
    autoOpen: boolean;
};

/** A report read from a colleague's notes for the panel, cut when it is longer than a drawing can carry. */
export type Report = {
    colleague: string;
    file: string;
    text: string;
    isCut?: boolean;
};

/** What the colleagues did in each ISO week, kept across sessions in the plugin's store: by week ("2026-W41"), then by id. */
export type WeeklyCounts = Record<string, Record<string, { tasks: number; refusals: number; tokens?: number }>>;

declare module "claude-code" {
    interface PluginState {
        "crew": {
            team: Colleague[];
            speakers: Speaker[];
            runs: Run[];
            /** The colleagues at work in the project's other chats, as their panels share them. */
            elsewhere: Run[];
            meeting: Meeting;
            view: PanelView;
            card: Card | null;
            report: Report | null;
            preferences: Preferences;
            board: Board;
            /** Changes when the portraits are read again, so the drawings that show them are redrawn. */
            gallery: number;
            /** Whether .claude/agents/ was there when the session started, so Claude Code loads the profiles written in it later on its own;
             * null until the session first starts. */
            agentsWatched: boolean | null;
        };
    }
}
