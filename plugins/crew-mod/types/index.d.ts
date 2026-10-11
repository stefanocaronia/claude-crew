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
};

/** Who is in the conversation now, by colleague id, and who spoke last. */
export type Meeting = {
    members: string[];
    /** What the band's controls just set, until the command's state file says the same. */
    pending?: { members: string[]; at: number };
};

/** A rate-limit window as the status line has it: five_hour, seven_day. */
export type Budget = {
    kind: string;
    percentUsed: number;
    resetsAt?: string;
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
    /** The style new portraits are asked in. */
    style?: string;
    /** The colleagues picked on their cards for a meeting, by id. */
    picked?: string[];
    /** The colleague whose card the panel shows, by id. */
    selected?: string;
};

/** A colleague's card: what their profile says of them, their open tasks and the latest lines of their memory. */
export type Card = {
    id: string;
    description: string;
    openTasks: string[];
    memory: string;
    /** The newest round report in their notes folder, by name: "2026-10-11-review-the-parser.md". */
    latestReport?: string;
};

/** What the colleagues did in each ISO week, kept across sessions in the plugin's store: by week ("2026-W41"), then by id. */
export type WeeklyCounts = Record<string, Record<string, { tasks: number; refusals: number }>>;

declare module "claude-code" {
    interface PluginState {
        "crew-mod": {
            team: Colleague[];
            speakers: Speaker[];
            runs: Run[];
            meeting: Meeting;
            budget: Budget[];
            view: PanelView;
            card: Card | null;
            board: Board;
            /** Changes when the portraits are read again, so the drawings that show them are redrawn. */
            gallery: number;
        };
    }
}
