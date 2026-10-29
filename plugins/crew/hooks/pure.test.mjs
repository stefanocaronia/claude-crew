// The mod's pure functions under Node: node --test plugins/crew/hooks/pure.test.mjs
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { segmentsOf, speakersOf } from "./meeting.ts";
import { imagePathsIn, isInside, isOwnMemory, resolvedPath } from "./paths.ts";
import { withCount } from "./progress.ts";
import { ageOf, agentSpecFrom, backlogOf, blockersOf, cardFrom, colleagueFrom, colleagueOf, memorySizeOf, openIdsOf, openTasks, permissionsOf, retestsOf, taskOf, withEffort, withNextPriority, withPermissions } from "./team.ts";
import { dateOf, formatTokens, formatUntil, isoWeek, languageOf, listNames, modelName, slugOf, words } from "./text.ts";

const profile = "---\r\nname: matteo-conti\r\ndescription: \"Matteo Conti, architetto TypeScript. Usalo per le revisioni.\"\r\ntools: Read\r\nmemory: project\r\neffort: high\r\ncolor: red\r\n---\r\n\r\n# Matteo Conti, architetto TypeScript\r\n\r\nChi sei.";
const matteo = colleagueFrom("matteo-conti", profile, "# todo\n- [ ] uno\n- [x] fatto\n- [ ] due\n", 7);
const giulia = colleagueFrom("giulia-ferri", "---\ncolor: purple\n---\n# Giulia Ferri, master\n", "", 0);

describe("colleagues from their files", () => {
    it("reads name, role, color, effort and open tasks", () => {
        assert.deepEqual(matteo, { id: "matteo-conti", name: "Matteo", fullName: "Matteo Conti", role: "architetto TypeScript", color: "#C0453A", model: undefined, effort: "high", permissions: { read: false, write: false, test: false, web: false }, openTasks: 2, avatarStamp: 7 });
    });

    it("makes an agent type from a profile Claude Code has not loaded, naming their memory folder in the prompt", () => {
        const spec = agentSpecFrom("matteo-conti", profile, "/p/.claude/agent-memory/matteo-conti");
        assert.deepEqual({ ...spec, prompt: undefined }, { name: "matteo-conti", description: "Matteo Conti, architetto TypeScript. Usalo per le revisioni.", tools: ["Read"], effort: "high", prompt: undefined });
        assert.match(spec.prompt, /^# Matteo Conti, architetto TypeScript\n\nChi sei\.\n\nYour memory is the folder \/p\/\.claude\/agent-memory\/matteo-conti\/:/);
        assert.equal(agentSpecFrom("giulia-ferri", "---\ncolor: purple\n---\n# Giulia\n", "/m").tools, undefined);
    });

    it("finds a colleague by agent type, with or without a plugin's prefix", () => {
        assert.equal(colleagueOf([matteo, giulia], "giulia-ferri"), giulia);
        assert.equal(colleagueOf([matteo, giulia], "team:matteo-conti"), matteo);
        assert.equal(colleagueOf([matteo, giulia], "general-purpose"), undefined);
    });

    it("lists the backlog: each colleague's next task in turn, with the effort a task names", () => {
        const tasks = [{ colleague: "matteo", lines: ["m1 (effort: high)", "m2", "m3"] }, { colleague: "giulia", lines: ["g1"] }, { colleague: "sara", lines: ["s1", "s2 (Effort: LOW)"] }];
        assert.deepEqual(backlogOf(tasks, 4), [
            { colleague: "matteo", text: "m1", effort: "high", line: "m1 (effort: high)" },
            { colleague: "giulia", text: "g1", line: "g1" },
            { colleague: "sara", text: "s1", line: "s1" },
            { colleague: "matteo", text: "m2", line: "m2" },
        ]);
        assert.deepEqual(backlogOf(tasks, 10).map(task => task.text), ["m1", "g1", "s1", "m2", "s2", "m3"]);
        assert.equal(backlogOf(tasks, 10)[4]?.effort, "low");
        assert.deepEqual(backlogOf([], 10), []);
    });

    it("reads a task's priority and date, and puts P1 first, then P2, P3 and the lines without a priority", () => {
        assert.deepEqual(taskOf("matteo", "P2 · 2026-10-29 · the parser (effort: high)"), { colleague: "matteo", text: "the parser", priority: "P2", date: "2026-10-29", effort: "high" });
        assert.deepEqual(taskOf("matteo", "2026-10-14 · done long ago"), { colleague: "matteo", text: "done long ago", date: "2026-10-14" });
        assert.deepEqual(taskOf("matteo", "P2 is a word here"), { colleague: "matteo", text: "P2 is a word here" });
        const tasks = [{ colleague: "matteo", lines: ["P3 · 2026-10-01 · m-later", "old line", "P1 · 2026-10-28 · m-now"] }, { colleague: "giulia", lines: ["P2 · 2026-10-20 · g-plan", "P1 · 2026-10-27 · g-now"] }];
        assert.deepEqual(backlogOf(tasks, 10).map(task => task.text), ["g-now", "m-now", "g-plan", "m-later", "old line"]);
        assert.deepEqual(retestsOf(["P1 · 2026-10-28 · Riprova il parser", "P2 · 2026-10-28 · the map"]), ["P1 · 2026-10-28 · Riprova il parser"]);
        assert.equal(ageOf("2026-10-26", Date.parse("2026-10-29T12:00:00")), 3);
        assert.equal(ageOf(undefined, 0), undefined);
        assert.equal(withNextPriority("P1 · 2026-10-07 · now (effort: high)", "2026-10-29"), "P2 · 2026-10-07 · now (effort: high)");
        assert.equal(withNextPriority("P3 · 2026-10-07 · later", "2026-10-29"), "P1 · 2026-10-07 · later");
        assert.equal(withNextPriority("old line", "2026-10-29"), "P1 · 2026-10-29 · old line");
        assert.equal(withNextPriority("2026-10-14 · dated only", "2026-10-29"), "P1 · 2026-10-14 · dated only");
        assert.equal(withNextPriority("P1 · 2026-10-28 · #matteo-3 · fix it", "2026-10-29"), "P2 · 2026-10-28 · #matteo-3 · fix it");
    });

    it("reads a task's id and the tasks it waits for, and which of those are still open", () => {
        assert.deepEqual(taskOf("matteo", "P1 · 2026-10-28 · #matteo-3 · correct lootNote"), { colleague: "matteo", text: "correct lootNote", priority: "P1", date: "2026-10-28", id: "#matteo-3" });
        assert.deepEqual(taskOf("elena", "P1 · 2026-10-28 · run loot2 again (after: #matteo-3, #andrea-1) (effort: high)"), { colleague: "elena", text: "run loot2 again", priority: "P1", date: "2026-10-28", effort: "high", after: ["#matteo-3", "#andrea-1"] });
        assert.deepEqual(taskOf("elena", "run it (effort: low) (after: #matteo-3)"), { colleague: "elena", text: "run it", effort: "low", after: ["#matteo-3"] });
        const open = openIdsOf([{ colleague: "matteo-conti", lines: ["P1 · 2026-10-28 · #matteo-3 · correct lootNote", "plain"] }, { colleague: "andrea-moretti", lines: [] }]);
        assert.deepEqual([...open], [["#matteo-3", "matteo-conti"]]);
        assert.deepEqual(blockersOf(taskOf("elena", "run it (after: #matteo-3, #andrea-1)"), open), [{ id: "#matteo-3", colleague: "matteo-conti" }]);
        assert.deepEqual(blockersOf(taskOf("elena", "run it"), open), []);
    });

    it("takes a bold name with its colon whole, leaving no stars", () => {
        assert.deepEqual(segmentsOf("**[Matteo]:** regge.", [matteo]).map(segment => segment.text), ["regge."]);
    });

    it("reads the permissions from the tools line, every one without a line; running commands writes too", () => {
        assert.deepEqual(permissionsOf("Read, Grep, Glob, Bash, mcp__crew__step"), { read: true, write: true, test: true, web: false });
        assert.deepEqual(permissionsOf("[Read, Edit, WebFetch]"), { read: false, write: true, test: false, web: true });
        assert.deepEqual(permissionsOf("Read, Grep"), { read: true, write: false, test: false, web: false });
        assert.deepEqual(permissionsOf(undefined), { read: true, write: true, test: true, web: true });
    });

    it("reads a tools list written as YAML items, and an empty key never takes the next line", () => {
        const listed = colleagueFrom("sara", "---\nname: sara\ntools:\n  - Read\n  - Grep\n- WebFetch\nmodel:\neffort: high\n---\n# Sara Lombardi, design\n", "", 0);
        assert.deepEqual(listed.permissions, { read: true, write: false, test: false, web: true });
        assert.equal(listed.model, undefined);
        assert.equal(listed.effort, "high");
        assert.deepEqual(colleagueFrom("sara", "---\ntools:\nmodel: opus\n---\n# Sara\n", "", 0).permissions, { read: true, write: true, test: true, web: true });
    });

    it("writes the tools line from the permissions, keeping Read and the other tools", () => {
        const profile = "---\r\nname: sara\r\ntools: Read, Grep, Glob, WebSearch, WebFetch, mcp__crew__step\r\n---\r\n# Sara\r\n";
        assert.equal(withPermissions(profile, { read: false, write: false, test: false, web: true }), "---\r\nname: sara\r\ntools: Read, WebSearch, WebFetch, mcp__crew__step\r\n---\r\n# Sara\r\n");
        assert.equal(withPermissions("---\nname: sara\n---\n# Sara\n", { read: true, write: true, test: true, web: false }), "---\nname: sara\ntools: Read, Grep, Glob, Edit, Write, Bash, mcp__crew__step\n---\n# Sara\n");
        assert.equal(withPermissions("# Sara, no frontmatter\n", { read: true, write: false, test: false, web: false }), "# Sara, no frontmatter\n");
        // The step tool's old name, from when the panel was its own plugin, is written with the new one.
        assert.equal(withPermissions("---\nname: sara\ntools: Read, mcp__crew-mod__step\n---\n", { read: true, write: false, test: false, web: false }), "---\nname: sara\ntools: Read, Grep, Glob, mcp__crew__step\n---\n");
    });

    it("rewrites a tools list of YAML items as one comma line, its items gone", () => {
        const profile = "---\nname: sara\ntools:\n  - Read\n  - Grep\n  - mcp__crew__step\nmodel: opus\n---\n# Sara\n";
        assert.equal(withPermissions(profile, { read: true, write: true, test: false, web: false }), "---\nname: sara\ntools: Read, Grep, Glob, Edit, Write, mcp__crew__step\nmodel: opus\n---\n# Sara\n");
    });

    it("finds the open tasks that ask to try again", () => {
        assert.deepEqual(retestsOf(["Riprova il parser", "**Retest** the map", "re-test modes", "Check again the dice", "riprovare", "test the parser", "Rivedi"]), ["Riprova il parser", "**Retest** the map", "re-test modes", "Check again the dice", "riprovare"]);
    });

    it("sets a colleague's effort in the profile, adds it, or takes it out", () => {
        const profile = "\uFEFF---\r\nname: matteo-conti\r\neffort: high\r\n---\r\n\r\n# Matteo\r\n";
        assert.equal(withEffort(profile, "low"), "\uFEFF---\r\nname: matteo-conti\r\neffort: low\r\n---\r\n\r\n# Matteo\r\n");
        assert.equal(withEffort(profile, undefined), "\uFEFF---\r\nname: matteo-conti\r\n---\r\n\r\n# Matteo\r\n");
        assert.equal(withEffort("---\nname: sara\n---\n# Sara\n", "max"), "---\nname: sara\neffort: max\n---\n# Sara\n");
        assert.equal(withEffort("# Sara, no frontmatter\n", "max"), "# Sara, no frontmatter\n");
        assert.equal(withEffort("---\nname: sara\n---\neffort: in the body\n", undefined), "---\nname: sara\n---\neffort: in the body\n");
    });

    it("finds a todo's open lines", () => {
        assert.deepEqual(openTasks("- [ ] uno\r\n- [x] fatto\r\n  - [ ] due"), ["uno", "due"]);
    });

    it("makes a card: description, open tasks, the last section of the memory", () => {
        const card = cardFrom("matteo-conti", profile, "- [ ] uno\n- [x] fatto\n", "# Matteo: memoria\n\n## 1 ottobre\nvecchio\n\n## 9 ottobre\n- nuovo\n");
        assert.equal(card.description, "Matteo Conti, architetto TypeScript. Usalo per le revisioni.");
        assert.deepEqual(card.openTasks, ["uno"]);
        assert.equal(card.memory, "## 9 ottobre\n- nuovo");
        assert.deepEqual({ ...card.memorySize, bytes: undefined }, { lines: 7, bytes: undefined, isLong: false });
    });

    it("measures a memory: past 80 lines or 10 KB it is long, counting its bytes as UTF-8", () => {
        assert.deepEqual(memorySizeOf(""), { lines: 0, bytes: 0, isLong: false });
        assert.equal(memorySizeOf("è").bytes, 2);
        assert.equal(memorySizeOf(Array.from({ length: 80 }, () => "riga").join("\n")).isLong, false);
        assert.equal(memorySizeOf(Array.from({ length: 81 }, () => "riga").join("\n")).isLong, true);
        assert.equal(memorySizeOf("x".repeat(10 * 1024 + 1)).isLong, true);
    });

    it("cuts a profile in sections: each bold-led paragraph of its opening, then each heading, without frontmatter or title", () => {
        const text = "---\r\nname: matteo-conti\r\n---\r\n\r\n# Matteo Conti, architetto\r\n\r\n**Chi sei.** Un architetto.\r\n\r\nE anche altro.\r\n\r\n**Come parli:** Breve.\r\n\r\n## Come lavori\r\n\r\n- Con calma.\r\n";
        assert.deepEqual(cardFrom("matteo-conti", text, "", "").profile, [
            { title: "Chi sei", text: "Un architetto.\n\nE anche altro." },
            { title: "Come parli", text: "Breve." },
            { title: "Come lavori", text: "- Con calma." },
        ]);
    });
});

describe("meetings in the chat", () => {
    it("cuts a reply at each speaker and splits the narrator out", () => {
        const segments = segmentsOf("[Matteo] Il parser regge.\n\n*Claude apre il file.*\n\nE i test passano.\n\n**[Giulia]**: Io partirei dalla prova.", [matteo, giulia]);
        assert.deepEqual(segments?.map(segment => [segment.speaker?.name, segment.text, segment.isContinued]), [
            ["Matteo", "Il parser regge.", undefined],
            [undefined, "*Claude apre il file.*", undefined],
            ["Matteo", "E i test passano.", true],
            ["Giulia", "Io partirei dalla prova.", undefined],
        ]);
    });

    it("gives Claude's own words a turn of its own, [Claude] or plain text before the first name, the narration still apart", () => {
        const claude = { id: "claude", name: "Claude", fullName: "Claude", role: "Your assistant", color: "#D97757" };
        assert.deepEqual(segmentsOf("*Claude legge.*\n\nConfermo.\n\n[Matteo] Regge.", [matteo, claude])?.map(segment => [segment.speaker?.name, segment.text]), [
            [undefined, "*Claude legge.*"],
            ["Claude", "Confermo."],
            ["Matteo", "Regge."],
        ]);
        assert.deepEqual(segmentsOf("[Claude] Fatto.", [matteo, claude])?.map(segment => [segment.speaker?.name, segment.text]), [["Claude", "Fatto."]]);
        // Without Claude among the speakers, plain text before the first name stays narration, as before.
        assert.equal(segmentsOf("Confermo.\n\n[Matteo] Regge.", [matteo])?.[0]?.speaker, undefined);
    });

    it("leaves alone a reply with no colleague in it, or a bracket that is not a colleague", () => {
        assert.equal(segmentsOf("Ecco il piano.", [matteo]), undefined);
        // In a meeting, a reply that names nobody is Claude's; one that carries italics is the narrator's note between tools, all of it.
        const claude = { id: "claude", name: "Claude", fullName: "Claude", role: "Your assistant", color: "#D97757" };
        assert.deepEqual(segmentsOf("*Tommaso aggiunge le scelte.*\n\nRegistro la decisione.", [matteo, claude], true)?.map(segment => [segment.speaker?.name, segment.text]), [
            [undefined, "*Tommaso aggiunge le scelte.*\n\nRegistro la decisione."],
        ]);
        assert.deepEqual(segmentsOf("Multi-line call is picked up (`\\s*`). *Claude adds the Italian by hand.*", [matteo, claude], true)?.map(segment => segment.speaker?.name), [undefined]);
        assert.deepEqual(segmentsOf("Ho registrato D-395 e fatto il push.", [matteo, claude], true)?.map(segment => segment.speaker?.name), ["Claude"]);
        // A starred word inside code is no italics.
        assert.deepEqual(segmentsOf("Il glob `src/**/*.ts` copre tutto.", [matteo, claude], true)?.map(segment => segment.speaker?.name), ["Claude"]);
        assert.equal(segmentsOf("Registro la decisione.", [matteo, claude]), undefined);
        assert.equal(segmentsOf("[Nota] niente", [matteo]), undefined);
        assert.equal(segmentsOf("[Matteo] ciao", []), undefined);
    });

    it("names the speakers once each, in order", () => {
        assert.deepEqual(speakersOf("[Giulia] a\n\n[Matteo] b\n\n[Giulia] c", [matteo, giulia]).map(speaker => speaker.name), ["Giulia", "Matteo"]);
    });
});

describe("words", () => {
    it("picks the language from the setting or the locale, by code or by name, English otherwise", () => {
        assert.equal(languageOf("auto", "italiano", undefined), "it");
        assert.equal(languageOf(undefined, undefined, "it_IT.UTF-8"), "it");
        assert.equal(languageOf("en", "italiano"), "en");
        assert.equal(languageOf(undefined, undefined, undefined), "en");
        const cases = { "es-ES": "es", "español": "es", "French": "fr", "de_DE.UTF-8": "de", "Deutsch": "de", "pt-BR": "pt", "português": "pt", "ja-JP": "ja", "日本語": "ja", "zh-CN": "zh", "中文": "zh", "ko": "ko", "korean": "ko", "ar-EG": "ar", "العربية": "ar", "ru_RU.UTF-8": "ru", "русский": "ru" };

        for (const [hint, language] of Object.entries(cases)) {
            assert.equal(languageOf(hint), language, hint);
        }

        // A hint that names none of them gives way to the next: the POSIX locale, then the system's.
        assert.equal(languageOf("C.UTF-8", "fr-FR"), "fr");
        assert.equal(languageOf("klingon"), "en");
        assert.equal(languageOf("estonian"), "en");
    });

    it("writes plurals, units and lists as each language does", () => {
        assert.deepEqual([1, 2, 5, 21, 112].map(count => words.ru.toDo(count)), ["1 задача", "2 задачи", "5 задач", "21 задача", "112 задач"]);
        assert.deepEqual([0, 1, 2, 3, 11].map(count => words.ar.toDo(count)), ["لا مهام", "مهمة واحدة", "مهمتان", "3 مهام", "11 مهمة"]);
        assert.equal(formatTokens(1_250_000, words.de.units), "1,3 Mio.");
        assert.equal(formatUntil(new Date(Date.UTC(2026, 9, 12, 5, 0)).toISOString(), Date.UTC(2026, 9, 10, 0, 0), words.ja.units), "2日 5時間");
        assert.equal(formatUntil(new Date(Date.UTC(2026, 9, 10, 3, 10)).toISOString(), Date.UTC(2026, 9, 10, 0, 0), words.ru.units), "3 ч 10 мин");
        assert.equal(listNames(["Matteo", "Giulia", "Sara"], words.ja.and, words.ja.comma), "Matteo、GiuliaとSara");
    });

    it("lists names", () => {
        assert.equal(listNames(["Matteo", "Giulia", "Sara"], " e "), "Matteo, Giulia e Sara");
        assert.equal(listNames(["Matteo"], " and "), "Matteo");
    });

    it("writes models and the time to a reset", () => {
        assert.equal(modelName("claude-opus-5-5"), "Opus 5.5");
        assert.equal(formatUntil(new Date(Date.UTC(2026, 9, 12, 5, 0)).toISOString(), Date.UTC(2026, 9, 10, 0, 0)), "2d 5h");
    });
});

describe("paths", () => {
    it("resolves a path against the root: . and .., backslashes, a drive", () => {
        assert.equal(resolvedPath("/p/.claude/agent-memory/sara/../../agents/sara.md", "/p"), "/p/.claude/agents/sara.md");
        assert.equal(resolvedPath(".claude\\agent-memory\\sara\\.\\todo.md", "F:\\work\\game"), "F:/work/game/.claude/agent-memory/sara/todo.md");
        assert.equal(resolvedPath("../../../../x", "/p"), "/x");
        assert.equal(resolvedPath("C:\\a\\..\\b", "/p"), "C:/b");
        assert.equal(resolvedPath(".claude/agent-memory/sara/**/../../x", "/p"), undefined);
    });

    it("tells a colleague's own memory folder, at any depth under the root, whatever the case", () => {
        assert.equal(isOwnMemory("/p/.claude/agent-memory/sara/todo.md", "/p", "sara"), true);
        assert.equal(isOwnMemory("/p/private/.claude/agent-memory/sara", "/p", "sara"), true);
        assert.equal(isOwnMemory("F:/Work/.Claude/Agent-Memory/SARA/notes/x.md", "f:/work", "Sara"), true);
        assert.equal(isOwnMemory("/p/.claude/agent-memory/sara-lombardi/x", "/p", "sara"), false);
        assert.equal(isOwnMemory("/q/.claude/agent-memory/sara/todo.md", "/p", "sara"), false);
        assert.equal(isInside("/pq/x", "/p"), false);
    });

    it("finds the pictures a text names, each once", () => {
        assert.deepEqual(imagePathsIn("See `shots/a.png`, ![map](F:\\maps\\b.JPG) and shots/a.png. Not a.pngx, nor c.gif; d.webp."), ["shots/a.png", "F:\\maps\\b.JPG", "d.webp"]);
    });
});

describe("the week's counts", () => {
    it("names the ISO week and the local date", () => {
        assert.equal(isoWeek(new Date(2026, 9, 11, 12).getTime()), "2026-W41");
        assert.equal(isoWeek(new Date(2027, 0, 1, 12).getTime()), "2026-W53");
        assert.equal(isoWeek(new Date(2025, 11, 29, 12).getTime()), "2026-W01");
        assert.equal(dateOf(new Date(2026, 9, 1, 12).getTime()), "2026-10-01");
    });

    it("adds a task or a refusal, keeping only the last weeks", () => {
        const counts = Object.fromEntries(Array.from({ length: 8 }, (_, index) => [`2026-W${String(30 + index).padStart(2, "0")}`, { sara: { tasks: 1, refusals: 0 } }]));
        const next = withCount(counts, "2026-W41", "sara", "refusals", 8);
        assert.deepEqual(Object.keys(next), ["2026-W31", "2026-W32", "2026-W33", "2026-W34", "2026-W35", "2026-W36", "2026-W37", "2026-W41"]);
        assert.deepEqual(next["2026-W41"], { sara: { tasks: 0, refusals: 1 } });
        assert.deepEqual(withCount(next, "2026-W41", "sara", "tasks", 8)["2026-W41"], { sara: { tasks: 1, refusals: 1 } });
        assert.deepEqual(withCount(withCount(next, "2026-W41", "sara", "tokens", 8, 1200), "2026-W41", "sara", "tokens", 8, 300)["2026-W41"], { sara: { tasks: 0, refusals: 1, tokens: 1500 } });
    });

    it("makes a file name of a task", () => {
        assert.equal(slugOf("Rivedi la città: è già fatto?"), "rivedi-la-citta-e-gia-fatto");
        assert.equal(slugOf("a".repeat(48) + " bcd"), `${"a".repeat(48)}-b`);
        assert.equal(slugOf("a".repeat(49) + " bcd"), "a".repeat(49));
        assert.equal(slugOf("!!!"), "report");
    });
});
