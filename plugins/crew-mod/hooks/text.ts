// The panel's words in English and Italian, and how numbers, times and models are written.
export type Language = "en" | "it";
export type Words = (typeof words)["en"];

export const words = {
    en: {
        pane: "👥 Crew",
        working: "Working",
        finished: "Finished",
        allBack: "All on a break",
        resting: "On a coffee break",
        inMeetingSection: "In the meeting",
        team: "Team",
        week: "Weekly limit",
        hours: "5-hour limit",
        teamWork: "Team's work",
        used: (percent: number) => `${percent}% used`,
        resetsIn: (time: string) => `resets in ${time}`,
        memoryUsed: (percent: number) => `memory ${percent}%`,
        tokens: (count: string) => `${count} tokens`,
        step: (done: number, total: number, note?: string) => `step ${done} of ${total}${note ? `: ${note}` : ""}`,
        effort: (level: string) => `effort ${level}`,
        sessionEffort: "session's effort",
        portrait: "Redo the portrait",
        levels: { low: "low", medium: "medium", high: "high", xhigh: "extra high", max: "max" },
        units: { day: "d", hour: "h", thousand: "k", million: "M", decimal: "." },
        meeting: "Meeting",
        invite: "Invite",
        closeMeeting: "Close the meeting",
        inMeeting: "in the meeting",
        tasks: "To do",
        installSkill: "To talk with them, install the crew plugin: /plugin install crew@claude-crew",
        readError: (message: string) => `The panel could not read the team: ${message}`,
        drawError: (message: string) => `The panel could not draw itself: ${message}`,
        heavyPortraits: (names: string) => `Portraits too heavy for the panel: ${names}. Ask Claude to redo them light (a 128 px JPEG).`,
        backlog: "Backlog",
        meetWith: (names: string) => `Meeting with ${names}`,
        openTasks: "Open tasks",
        startRound: "Ask for a review",
        roundWith: (names: string) => `Ask ${names} for a review`,
        roundPrompt: "run a review round with the colleagues on ",
        roundPromptWith: (names: string) => `run a review round with ${names} on `,
        fire: (names: string) => `Fire ${names}`,
        firePrompt: (names: string) => `fire ${names}`,
        portraits: "Redo the portraits",
        styleLabel: "style",
        portraitsPrompt: (names: string, style: string) => `draw the portraits of ${names || "the whole team"} again, in ${style} style`,
        styles: { realistic: "realistic", anime: "80s-90s anime", pixel: "pixel art", vector: "vector cartoon" },
        meetAll: "Team meeting",
        hire: "Hire a colleague",
        hirePrompt: "hire a colleague",
        and: "and",
        memory: "Latest in their memory",
        toDo: (count: number) => (count === 1 ? "1 to do" : `${count} to do`),
        talk: "Talk with",
        empty: "No colleagues in this project yet: the colleagues skill hires them.",
        opened: "Crew panel opened.",
        closed: "Crew panel closed.",
        failed: "stopped",
        stepDone: "ok",
        stepIgnored: "ignored: only a colleague at work reports steps",
    },
    it: {
        pane: "👥 Crew",
        working: "Al lavoro",
        finished: "Hanno finito",
        allBack: "Tutti in pausa",
        resting: "In pausa caffè",
        inMeetingSection: "In riunione",
        team: "Squadra",
        week: "Limite della settimana",
        hours: "Limite delle 5 ore",
        teamWork: "Lavoro della squadra",
        used: (percent: number) => `${percent}% usato`,
        resetsIn: (time: string) => `si azzera tra ${time}`,
        memoryUsed: (percent: number) => `memoria ${percent}%`,
        tokens: (count: string) => `${count} token`,
        step: (done: number, total: number, note?: string) => `passo ${done} di ${total}${note ? `: ${note}` : ""}`,
        effort: (level: string) => `impegno ${({ low: "basso", medium: "medio", high: "alto", xhigh: "molto alto", max: "massimo" } as Record<string, string>)[level] ?? level}`,
        sessionEffort: "impegno della sessione",
        portrait: "Rifai il ritratto",
        levels: { low: "basso", medium: "medio", high: "alto", xhigh: "molto alto", max: "massimo" },
        units: { day: "g", hour: "h", thousand: " mila", million: " milioni", decimal: "," },
        meeting: "Riunione",
        invite: "Invita",
        closeMeeting: "Chiudi la riunione",
        inMeeting: "in riunione",
        tasks: "Da fare",
        installSkill: "Per parlare con loro serve il plugin crew: /plugin install crew@claude-crew",
        readError: (message: string) => `Il pannello non è riuscito a leggere la squadra: ${message}`,
        drawError: (message: string) => `Il pannello non è riuscito a disegnarsi: ${message}`,
        heavyPortraits: (names: string) => `Ritratti troppo pesanti per il pannello: ${names}. Chiedi a Claude di rifarli leggeri (un JPEG da 128 px).`,
        backlog: "Backlog",
        meetWith: (names: string) => `Riunione con ${names}`,
        openTasks: "Compiti aperti",
        startRound: "Chiedi una revisione",
        roundWith: (names: string) => `Chiedi una revisione a ${names}`,
        roundPrompt: "fai un giro di revisione con i colleghi su ",
        roundPromptWith: (names: string) => `fai un giro di revisione con ${names} su `,
        fire: (names: string) => `Licenzia ${names}`,
        firePrompt: (names: string) => `licenzia ${names}`,
        portraits: "Rifai i ritratti",
        styleLabel: "stile",
        portraitsPrompt: (names: string, style: string) => `rifai i ritratti di ${names || "tutta la squadra"} in stile ${style}`,
        styles: { realistic: "realistico", anime: "anime anni 80-90", pixel: "pixel art", vector: "vettoriale" },
        meetAll: "Riunione con tutti",
        hire: "Assumi un collega",
        hirePrompt: "assumi un collega",
        and: "e",
        memory: "Ultime righe della memoria",
        toDo: (count: number) => `${count} da fare`,
        talk: "Parla con",
        empty: "Ancora nessun collega in questo progetto: li assume la skill crew.",
        opened: "Pannello Crew aperto.",
        closed: "Pannello Crew chiuso.",
        failed: "interrotto",
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

/** "920k", "1.2M"; in Italian "920 mila", "1,2 milioni". */
export function formatTokens(count: number, units: Words["units"] = words.en.units): string
{
    return count >= 1e6 ? `${(count / 1e6).toFixed(1).replace(".", units.decimal)}${units.million}` : count >= 1e3 ? `${Math.round(count / 1e3)}${units.thousand}` : `${Math.round(count)}`;
}

/** "2 min 54 s", "1 h 05 min", "40 s". */
export function formatTime(milliseconds: number): string
{
    const seconds = Math.max(0, Math.round(milliseconds / 1000));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours ? `${hours} h ${String(minutes).padStart(2, "0")} min` : minutes ? `${minutes} min ${seconds % 60} s` : `${seconds} s`;
}

/** "Matteo, Giulia e Sara". */
export function listNames(names: string[], and: string): string
{
    return names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} ${and} ${names.at(-1)}`;
}

/** How long until a window resets: "2d 5h", "3h 10min", "12 min"; in Italian "2 g 5 h". */
export function formatUntil(resetsAt: string | undefined, now: number, units: Words["units"] = words.en.units): string
{
    const at = resetsAt ? Date.parse(resetsAt) : NaN;

    if (Number.isNaN(at)) {
        return "";
    }

    const minutes = Math.max(0, Math.round((at - now) / 60000));
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    const space = units.day.length > 1 || units.day === "g" ? " " : "";
    return days ? `${days}${space}${units.day} ${hours}${space}${units.hour}` : hours ? `${hours}${space}${units.hour} ${minutes % 60} min` : `${minutes} min`;
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
