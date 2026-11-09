// The panel's language and settings: the option, Claude Code's language or the system's, unless the user chose one in the panel.
import { atom, read, update } from "claude-code";
import type { EngineInterface } from "claude-code";

import type { Preferences } from "../../types";

import { type Language, languageOf, type Words, words } from "../text/index.ts";
import { initial, loaded } from "./state.ts";

const preferences = atom({ plugin: "crew", key: "preferences" } as const, initial.preferences);

/** The panel's words, in its language now. */
export function say(): Words
{
    return words[loaded.language];
}

/** The language the plugin's option names, at once: after /reload-plugins the session does not start again. */
export function takeOption(option: unknown): void
{
    loaded.language = languageOf(option);
}

/** At the session's start: the language the settings and the system ask for, then the panel's settings as the store keeps them. */
export async function readLanguage($: EngineInterface, option: unknown): Promise<void>
{
    loaded.detectedLanguage = languageOf(option, await settingsLanguage($), await $.env.get("LANG"), systemLocale());
    const chosen = await storedPreferences($);
    await update($, preferences, () => chosen);
    loaded.language = languageChosen(chosen);
}

/** A change of the panel's settings: kept across sessions, and drawn at once in the language it names. */
export async function choosePreferences($: EngineInterface, change: (current: Preferences) => Preferences): Promise<void>
{
    const chosen = change(await read($, preferences));
    await $.store.set("preferences", chosen).catch(() => undefined);
    loaded.language = languageChosen(chosen);
    await update($, preferences, () => chosen);
}

// The panel's settings as the store keeps them, over the defaults; the defaults when the store cannot be read.
async function storedPreferences($: EngineInterface): Promise<Preferences>
{
    const defaults: Preferences = { language: "auto", autoOpen: true };

    try {
        const stored = await $.store.get("preferences");
        return stored && typeof stored === "object" ? { ...defaults, ...(stored as Partial<Preferences>) } : defaults;
    } catch {
        return defaults;
    }
}

function languageChosen(chosen: Preferences): Language
{
    return chosen.language === "auto" ? loaded.detectedLanguage : languageOf(chosen.language);
}

// The language the settings ask for: the plugin's own option, as written there, then Claude Code's language.
async function settingsLanguage($: EngineInterface): Promise<string | undefined>
{
    try {
        const settings = (await $.settings.read()) as { language?: unknown; pluginConfigs?: Record<string, { options?: { language?: unknown } }> };
        const own = settings.pluginConfigs?.["crew@claude-crew"]?.options?.language;
        const usable = [own, settings.language].filter(hint => typeof hint === "string" && hint !== "auto");
        return usable[0] as string | undefined;
    } catch {
        return undefined;
    }
}

// The system's locale, where no LANG says it (Windows).
function systemLocale(): string | undefined
{
    try {
        return Intl.DateTimeFormat().resolvedOptions().locale;
    } catch {
        return undefined;
    }
}
