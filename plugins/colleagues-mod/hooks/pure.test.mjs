// The mod's pure functions under Node: node --test plugins/colleagues-mod/hooks/pure.test.mjs
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isNarration, segmentsOf, speakersOf } from "./meeting.ts";
import { cardFrom, colleagueFrom, colleagueOf, latestHeading, openTasks } from "./team.ts";
import { formatAgo, formatUntil, languageOf, listNames, modelName, words } from "./text.ts";

const profile = "---\r\nname: matteo-conti\r\ndescription: \"Matteo Conti, architetto TypeScript. Usalo per le revisioni.\"\r\ntools: Read\r\nmemory: project\r\neffort: high\r\ncolor: red\r\n---\r\n\r\n# Matteo Conti, architetto TypeScript\r\n\r\nChi sei.";
const matteo = colleagueFrom("matteo-conti", profile, "# todo\n- [ ] uno\n- [x] fatto\n- [ ] due\n", 7);
const giulia = colleagueFrom("giulia-ferri", "---\ncolor: purple\n---\n# Giulia Ferri, master\n", "", 0);

describe("colleagues from their files", () => {
    it("reads name, role, color, effort and open tasks", () => {
        assert.deepEqual(matteo, { id: "matteo-conti", name: "Matteo", fullName: "Matteo Conti", role: "architetto TypeScript", color: "#C0453A", model: undefined, effort: "high", openTasks: 2, avatarStamp: 7 });
    });

    it("finds a colleague by agent type, with or without a plugin's prefix", () => {
        assert.equal(colleagueOf([matteo, giulia], "giulia-ferri"), giulia);
        assert.equal(colleagueOf([matteo, giulia], "team:matteo-conti"), matteo);
        assert.equal(colleagueOf([matteo, giulia], "general-purpose"), undefined);
    });

    it("finds the heading of a memory's last section, and a todo's open lines", () => {
        assert.equal(latestHeading("# Matteo\r\n\r\n## 1 ottobre\r\nvecchio\r\n\r\n## 9 ottobre (notte): mappa\r\n- nuovo\r\n"), "9 ottobre (notte): mappa");
        assert.equal(latestHeading("# Matteo\n\nniente"), "");
        assert.deepEqual(openTasks("- [ ] uno\r\n- [x] fatto\r\n  - [ ] due"), ["uno", "due"]);
    });

    it("makes a card: description, open tasks, the last section of the memory", () => {
        const card = cardFrom("matteo-conti", profile, "- [ ] uno\n- [x] fatto\n", "# Matteo: memoria\n\n## 1 ottobre\nvecchio\n\n## 9 ottobre\n- nuovo\n");
        assert.equal(card.description, "Matteo Conti, architetto TypeScript. Usalo per le revisioni.");
        assert.deepEqual(card.openTasks, ["uno"]);
        assert.equal(card.memory, "## 9 ottobre\n- nuovo");
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

    it("leaves alone a reply with no colleague in it, or a bracket that is not a colleague", () => {
        assert.equal(segmentsOf("Ecco il piano.", [matteo]), undefined);
        assert.equal(segmentsOf("[Nota] niente", [matteo]), undefined);
        assert.equal(segmentsOf("[Matteo] ciao", []), undefined);
    });

    it("names the speakers once each, in order", () => {
        assert.deepEqual(speakersOf("[Giulia] a\n\n[Matteo] b\n\n[Giulia] c", [matteo, giulia]).map(speaker => speaker.name), ["Giulia", "Matteo"]);
    });

    it("knows the narrator lines", () => {
        assert.ok(isNarration("*Claude legge il file.*"));
        assert.ok(!isNarration("Ecco il piano."));
    });
});

describe("words", () => {
    it("picks Italian from the setting or the locale, English otherwise", () => {
        assert.equal(languageOf("auto", "italiano", undefined), "it");
        assert.equal(languageOf(undefined, undefined, "it_IT.UTF-8"), "it");
        assert.equal(languageOf("en", "italiano"), "en");
        assert.equal(languageOf(undefined, undefined, undefined), "en");
    });

    it("says how long ago, and lists names", () => {
        const now = Date.UTC(2026, 9, 10, 12, 0);
        assert.deepEqual([0, 5, 60, 180, 1500, 4400].map(minutes => formatAgo(now - minutes * 60000, now, words.it)), ["adesso", "5 min fa", "un'ora fa", "3 ore fa", "ieri", "3 giorni fa"]);
        assert.equal(listNames(["Matteo", "Giulia", "Sara"], "e"), "Matteo, Giulia e Sara");
        assert.equal(listNames(["Matteo"], "and"), "Matteo");
    });

    it("writes models and the time to a reset", () => {
        assert.equal(modelName("claude-opus-5-5"), "Opus 5.5");
        assert.equal(formatUntil(new Date(Date.UTC(2026, 9, 12, 5, 0)).toISOString(), Date.UTC(2026, 9, 10, 0, 0)), "2d 5h");
    });
});
