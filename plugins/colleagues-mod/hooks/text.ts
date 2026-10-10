// The panel's words in English and Italian, and how numbers, times and models are written.
export type Language = "en" | "it";

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
        cards: "Open a card:",
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
        cards: "Apri la scheda:",
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
