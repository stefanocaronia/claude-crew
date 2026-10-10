// The panel's words in English and Italian, and how numbers, times and models are written.
export type Language = "en" | "it";
export type Words = (typeof words)["en"];

export const words = {
    en: {
        pane: "Colleagues",
        working: "Working",
        finished: "Finished",
        team: "Team",
        week: "Week",
        hours: "5 hours",
        tokens: "Tokens",
        time: "Time",
        meeting: "Meeting",
        speaking: "speaking",
        inMeeting: "in the meeting",
        tasks: "To do",
        installSkill: "To talk with them, install the colleagues plugin: /plugin install colleagues@colleagues",
        news: "From the team",
        openTasks: "Open tasks",
        startRound: "Start a round",
        roundPrompt: "run a review round with the colleagues on ",
        meetAll: "Meeting with everyone",
        hire: "Hire a colleague",
        hirePrompt: "hire a colleague for ",
        and: "and",
        justNow: "just now",
        minutesAgo: (count: number) => `${count} min ago`,
        hoursAgo: (count: number) => (count === 1 ? "an hour ago" : `${count} hours ago`),
        yesterday: "yesterday",
        daysAgo: (count: number) => `${count} days ago`,
        memory: "Latest in their memory",
        toDo: (count: number) => (count === 1 ? "1 to do" : `${count} to do`),
        talk: "Talk with",
        talkPrompt: (names: string) => `I want to talk to ${names} `,
        empty: "No colleagues in this project yet: the colleagues skill hires them.",
        opened: "Colleagues panel opened.",
        closed: "Colleagues panel closed.",
        failed: "error",
        stepDone: "ok",
        stepIgnored: "ignored: only a colleague at work reports steps",
    },
    it: {
        pane: "Colleghi",
        working: "Al lavoro",
        finished: "Hanno finito",
        team: "In squadra",
        week: "Settimana",
        hours: "5 ore",
        tokens: "Token",
        time: "Tempo",
        meeting: "Riunione",
        speaking: "parla",
        inMeeting: "in riunione",
        tasks: "Da fare",
        installSkill: "Per parlare con loro serve il plugin colleagues: /plugin install colleagues@colleagues",
        news: "Dalla squadra",
        openTasks: "Compiti aperti",
        startRound: "Avvia un giro",
        roundPrompt: "fai un giro di revisione con i colleghi su ",
        meetAll: "Riunione con tutti",
        hire: "Assumi un collega",
        hirePrompt: "assumi un collega esperto di ",
        and: "e",
        justNow: "adesso",
        minutesAgo: (count: number) => `${count} min fa`,
        hoursAgo: (count: number) => (count === 1 ? "un'ora fa" : `${count} ore fa`),
        yesterday: "ieri",
        daysAgo: (count: number) => `${count} giorni fa`,
        memory: "Ultime righe della memoria",
        toDo: (count: number) => `${count} da fare`,
        talk: "Parla con",
        talkPrompt: (names: string) => `voglio parlare con ${names} `,
        empty: "Ancora nessun collega in questo progetto: li assume la skill colleagues.",
        opened: "Pannello dei colleghi aperto.",
        closed: "Pannello dei colleghi chiuso.",
        failed: "errore",
        stepDone: "ok",
        stepIgnored: "ignorato: i passi li segna solo un collega al lavoro",
    },
};

/** Italian when the option, Claude Code's `language` setting or the locale says so; English otherwise. */
export function languageOf(...hints: unknown[]): Language
{
    for (const hint of hints) {
        if (typeof hint === "string" && hint.trim() && hint !== "auto") {
            return /^(it|ital)/i.test(hint.trim()) ? "it" : "en";
        }
    }

    return "en";
}

export function formatTokens(count: number): string
{
    return count >= 1e6 ? `${(count / 1e6).toFixed(1)}M` : count >= 1e3 ? `${Math.round(count / 1e3)}k` : `${Math.round(count)}`;
}

export function formatTime(milliseconds: number): string
{
    const seconds = Math.max(0, Math.round(milliseconds / 1000));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const rest = String(seconds % 60).padStart(2, "0");
    return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}` : `${minutes}:${rest}`;
}

/** How long ago, in words: "adesso", "5 min fa", "2 ore fa", "ieri", "3 giorni fa". */
export function formatAgo(at: number, now: number, say: Words): string
{
    const minutes = Math.max(0, Math.floor((now - at) / 60000));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    return minutes < 1 ? say.justNow : hours < 1 ? say.minutesAgo(minutes) : days < 1 ? say.hoursAgo(hours) : days < 2 ? say.yesterday : say.daysAgo(days);
}

/** "Matteo, Giulia e Sara". */
export function listNames(names: string[], and: string): string
{
    return names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} ${and} ${names.at(-1)}`;
}

/** How long until a window resets: "2d 5h", "3h 10m", "12m". */
export function formatUntil(resetsAt: string | undefined, now: number): string
{
    const at = resetsAt ? Date.parse(resetsAt) : NaN;

    if (Number.isNaN(at)) {
        return "";
    }

    const minutes = Math.max(0, Math.round((at - now) / 60000));
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    return days ? `${days}d ${hours}h` : hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

/** "claude-opus-5-5" → "Opus 5.5". */
export function modelName(id: string): string
{
    const match = /(fable|mythos|opus|sonnet|haiku)-(\d+)(?:-(\d{1,2})(?!\d))?/i.exec(id);

    if (!match) {
        return id.replace(/^claude-/, "").replace(/\[.*\]$/, "") || "—";
    }

    const [, family = "", major = "", minor] = match;
    return `${family.charAt(0).toUpperCase()}${family.slice(1).toLowerCase()} ${major}${minor ? `.${minor}` : ""}`;
}

/** The context window of a model, to show how full a colleague's context is. */
export function contextWindowOf(model: string): number
{
    return /haiku/i.test(model) ? 200_000 : 1_000_000;
}
