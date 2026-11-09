// The panel's words in eleven languages, one file each, and how numbers, times and models are written (format.ts).
import { ar } from "./ar.ts";
import { de } from "./de.ts";
import { en, type Words } from "./en.ts";
import { es } from "./es.ts";
import { fr } from "./fr.ts";
import { it } from "./it.ts";
import { ja } from "./ja.ts";
import { ko } from "./ko.ts";
import { pt } from "./pt.ts";
import { ru } from "./ru.ts";
import { zh } from "./zh.ts";

export type { Words } from "./en.ts";
export * from "./format.ts";

export type Language = "en" | "it" | "es" | "fr" | "de" | "pt" | "ja" | "zh" | "ko" | "ar" | "ru";

export const words: Record<Language, Words> = { en, it, es, fr, de, pt, ja, zh, ko, ar, ru };

/** Each language by its own name, as the settings list them. */
export const languageNames: Record<Language, string> = {
    en: "English",
    it: "Italiano",
    es: "Español",
    fr: "Français",
    de: "Deutsch",
    pt: "Português",
    ja: "日本語",
    zh: "中文",
    ko: "한국어",
    ar: "العربية",
    ru: "Русский",
};

/** The language the option, Claude Code's `language` setting or the locale asks for, as a code or a name; English when none of
 * them names one of the eleven. A hint that names none ("C.UTF-8", "korean" before Korean existed) gives way to the next. */
export function languageOf(...hints: unknown[]): Language
{
    for (const hint of hints) {
        if (typeof hint !== "string" || !hint.trim() || hint === "auto") {
            continue;
        }

        const found = namesOfLanguages.find(([, pattern]) => pattern.test(hint.trim()));

        if (found) {
            return found[0];
        }
    }

    return "en";
}

// Each language by its code (it, it-IT, it_IT.UTF-8) or its name in English and in itself.
const namesOfLanguages: [Language, RegExp][] = [
    ["it", /^(it([-_.]|$)|ital)/i],
    ["es", /^(es([-_.]|$)|span|espa)/i],
    ["fr", /^(fr([-_.]|$)|fren|fran)/i],
    ["de", /^(de([-_.]|$)|germ|deut)/i],
    ["pt", /^(pt([-_.]|$)|port)/i],
    ["ja", /^(ja([-_.]|$)|japa|日本)/i],
    ["zh", /^(zh([-_.]|$)|chin|中文|汉语|简体)/i],
    ["ko", /^(ko([-_.]|$)|kore|한국)/i],
    ["ar", /^(ar([-_.]|$)|arab|العربية)/i],
    ["ru", /^(ru([-_.]|$)|russ|русск)/i],
    ["en", /^(en([-_.]|$)|engl)/i],
];
