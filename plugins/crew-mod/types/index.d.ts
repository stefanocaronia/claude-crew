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
    openTasks: number;
    /** Changes when the portrait file changes, so drawings that show it are redrawn. */
    avatarStamp: number;
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
};

/** Who is in the conversation now, by colleague id, and who spoke last. */
export type Meeting = {
    members: string[];
    last?: string;
};

/** A rate-limit window as the status line has it: five_hour, seven_day. */
export type Budget = {
    kind: string;
    percentUsed: number;
    resetsAt?: string;
};

/** The last section of a colleague's memory, and when their memory last changed. */
export type News = {
    colleague: string;
    heading: string;
    at: number;
};

/** The team's latest news and open tasks, read from their files at every turn. */
export type Board = {
    news: News[];
    tasks: { colleague: string; lines: string[] }[];
    /** Whether the crew plugin's commands are installed: without them nobody can talk with the team. */
    hasCommands: boolean;
    /** The characters of all portraits, as data URIs. */
    portraitWeight?: number;
    /** Why the last reading of the team failed, shown in the panel. */
    error?: string;
    checkedAt: number;
};

export type PanelView = {
    isFinishedCollapsed: boolean;
    autoOpened: boolean;
    /** The colleagues whose open tasks the panel shows, by id. */
    expanded?: string[];
    /** The colleague whose card the panel shows, by id. */
    selected?: string;
};

/** A colleague's card: what their profile says of them, their open tasks and the latest lines of their memory. */
export type Card = {
    id: string;
    description: string;
    openTasks: string[];
    memory: string;
};

declare module "claude-code" {
    interface PluginState {
        "crew-mod": {
            team: Colleague[];
            runs: Run[];
            meeting: Meeting;
            budget: Budget[];
            view: PanelView;
            card: Card | null;
            board: Board;
            /** Changes when the portraits are read again, so the drawings that show them are redrawn. */
            gallery: number;
            now: number;
        };
    }
}
