// The colleagues' panel and their meetings: the team with their portraits, who is at work and the steps they report, a colleague's
// card, and a meeting drawn as a group chat with its controls above the prompt. The meeting itself is the crew plugin's
// commands: the controls send them, and its state file says who is in the conversation. This file only wires the engine's events
// to the areas that answer them; docs/structure.md says what each folder holds.
import { atom, read } from "claude-code";
import type { Register } from "claude-code";

import { drawBand, drawMessage } from "./chat/index.ts";
import { forgetAll, tempFolder } from "./files/index.ts";
import { noteSpeakers, refreshMeeting } from "./meeting/index.ts";
import { drawPane } from "./panel/index.ts";
import { initial, loaded, openOnce, readLanguage, say, takeOption } from "./session/index.ts";
import { forgetTeam, lateType, noteAgentsFolder, placeFolders, safeRefresh } from "./team/index.ts";
import { activityOf, endRun, forgetShared, noteActivity, noteSteps, refusalOf, reportStep, resume, sendRestedBack, shareEvery, shareWork, startColleague, stopLostRuns } from "./work/index.ts";

const coordinator = atom({ plugin: "crew", key: "coordinator" } as const, initial.coordinator);
const team = atom({ plugin: "crew", key: "team" } as const, initial.team);
// The matchers' pane and tools are written here, not imported: the engine's scan reads a matcher only when it is a literal of this
// file. The pane is session/pane.ts's, the step tool work/progress.ts's.
const pane = "crew";
const panelTool = "mcp__crew__panel";
const stepTool = "mcp__crew__step";
// The panel's timers: a session that starts again (at /reload-plugins) stops those it started before.
let timers: { cancel: () => void }[] = [];

export const register: Register = (on, options) => {
    // The option alone, at once: after /reload-plugins the session does not start again.
    takeOption(options.language);
    // A load that reuses the module (a test) reads the files again.
    forgetAll();
    forgetTeam();
    forgetShared();

    on("session.start", async ($, e, next) => {
        const started = await next(e);
        // When this session last loaded the panel's code, at its start, at /reload-plugins or at a hot reload: what tells a load that took.
        await $.fs.write(`${await tempFolder($)}/claude-crew/loaded-${(await $.session.id()).replace(/[^\w-]/g, "_")}.txt`, `${new Date(await $.clock.now()).toISOString()}\n`).catch(() => undefined);
        await stopLostRuns($);
        await readLanguage($, options.language);
        await $.tool.register({
            name: "step",
            description: "For a colleague at work on a round or a task: report your progress to the Crew panel. Right after reading the brief, call it with "
                + "`total` (your plan in 3 to 8 steps) and `done: 0`; then call it again as each step finishes, with `note` naming the step now in "
                + "progress. Silent and cheap: it only draws a bar.",
            inputSchema: {
                type: "object",
                properties: {
                    done: { type: "integer", minimum: 0, description: "Steps finished so far." },
                    total: { type: "integer", minimum: 1, description: "Steps planned; it may change with the plan." },
                    note: { type: "string", description: "The step in progress, in a few words." },
                },
                required: ["done"],
            },
            isDeferred: false,
        });
        await $.tool.register({
            name: "panel",
            description: "Open the Crew panel beside the chat: the team with portraits, roles and open tasks, who is at work, the meeting. Call it when the user asks to see the colleagues, the team or their panel, in any words.",
            inputSchema: { type: "object", properties: {} },
        });
        await $.command.register({ name: "crew-panel", description: "Show or hide the Crew panel: the team with their cards, who is at work, the steps they report" });
        await noteAgentsFolder($);
        await safeRefresh($);
        // Where the docs are a repo of their own, the colleagues' folders among them: linked on a machine that has them there, and the
        // move of a team still in .claude offered in the panel. In the background: git and a process take a moment.
        void placeFolders($).catch(() => undefined);

        for (const timer of timers) {
            timer.cancel();
        }

        // Once a minute, who finished five minutes ago goes back to the coffee break; and who works in the project's other chats is
        // shared through the temp folder, as a session's state is its own.
        const rest = $.clock.every(60_000, () => {
            void sendRestedBack($).catch(() => undefined);
        });
        const share = $.clock.every(shareEvery, () => {
            void shareWork($).catch(() => undefined);
        });
        timers = [rest, share];
        void shareWork($).catch(() => undefined);

        // The team is there to be seen from the start: the panel opens once, where the surface docks it beside the chat.
        if ((await read($, team)).length || (await read($, coordinator))) {
            await openOnce($);
        }

        return started;
    });

    on("command.run", { command: "crew-panel" }, async $ => {
        const isOpen = (await $.ui.panes()).some(open => open.id === pane);

        if (isOpen) {
            await $.ui.close({ id: pane });
            return { text: say().closed };
        }

        // The panel opens first: what it could not read, it says inside.
        await $.ui.open({ id: pane, title: say().pane });
        await safeRefresh($);
        return { text: say().opened };
    });

    // Claude opens the panel when the user asks for it in words: a way that does not depend on the surface knowing slash commands.
    on("tool.call", { tool: panelTool }, async $ => {
        await $.ui.open({ id: pane, title: say().pane });
        await safeRefresh($);
        return { result: say().opened };
    });

    // A colleague's own progress: the call runs in their loop, so agentId names the run.
    on("tool.call", { tool: stepTool }, async ($, e) => {
        if (!e.agentId) {
            return { result: say().stepIgnored };
        }

        await reportStep($, e.agentId, e as unknown as { done?: number; total?: number; note?: string });
        return { result: say().stepDone };
    });

    // A colleague without reading or writing works only in their own memory folder, and never changes a file another colleague at
    // work is changing: the panel refuses the rest. A command of the main loop never brings a colleague at work into a meeting.
    on("tool.call", async ($, e, next) => {
        const args = e as unknown as Record<string, unknown>;
        const reason = await refusalOf($, e.tool, e.agentId, args);

        if (reason) {
            return { deny: reason };
        }

        if (e.agentId) {
            const activity = activityOf(e.tool, args);
            await resume($, e.agentId);

            if (activity) {
                noteActivity(e.agentId, activity);
            }
        }

        const result = await next(e);

        // The conversation script (talk, invite, leave, end) changes the meeting now, not at the next prompt.
        if (!e.agentId && typeof args.command === "string" && args.command.includes("conversation.mjs")) {
            await refreshMeeting($).catch(() => undefined);
        }

        return result;
    });

    // A colleague hired in this session, in a project that had no .claude/agents/ at its start, is the panel's agent type: called by
    // their id, as every colleague is.
    on("tool.call", { tool: "Agent" }, async ($, e, next) => {
        const late = lateType(String((e as unknown as { subagent_type?: unknown }).subagent_type ?? ""));
        return next(late ? ({ ...e, subagent_type: late } as typeof e) : e);
    });

    on("agent.spawn", startColleague);

    // The coordinator in the chat's system prompt, at every turn and past a compaction: who they are and their memory's index, the
    // notes read when the work needs them. Only the chat's own prompt, which offers the Agent tool: a colleague at work has none, and a
    // teammate's render of it is the teammate's.
    on("prompt.compose", async ($, e, next) => {
        const composed = await next(e);

        if (!e.tools.includes("Agent") || e.traits.includes("teammate")) {
            return composed;
        }

        if (!loaded.isTeamRead) {
            await safeRefresh($);
        }

        return loaded.coordinatorText ? { sections: [...composed.sections, { id: "crew:coordinator", text: loaded.coordinatorText, scope: "session" as const }] } : composed;
    });

    // Each model request of a colleague at work: how full their context is, the tokens, the effort.
    on("turn.step", async function* ($, e, next) {
        if (e.agentId) {
            await resume($, e.agentId);
        }

        const result = yield* next(e);
        const usage = result.usage;

        if (!e.agentId || !usage) {
            return result;
        }

        const spent = (usage.input_tokens || 0) + (usage.cache_read_input_tokens || 0) + (usage.cache_creation_input_tokens || 0) + (usage.output_tokens || 0);
        await noteSteps($, e.agentId, usage.model || e.model, typeof e.effort === "string" ? e.effort : undefined, spent);
        return result;
    });

    // The main loop has read the prompt, and the crew plugin's hook has run: who is in the conversation now.
    on("turn.start", async ($, e, next) => {
        const started = await next(e);
        await refreshMeeting($);
        return started;
    });

    on("turn.complete", async ($, e, next) => {
        if (!e.agentId) {
            // The team is read again once the turn has ended, so the reading never delays it.
            const completed = await next(e);
            await safeRefresh($);
            return completed;
        }

        await endRun($, e.agentId, e.reason === "answer", e.reason === "answer" ? e.answer : "");
        return next(e);
    });

    // Who spoke last, from the reply as it is stored; a reply with no colleague in it means Claude is back.
    on("session.append", async ($, e, next) => {
        const stored = await next(e);

        if (e.agentId || e.door !== "response" || e.message.role !== "assistant") {
            return stored;
        }

        const text = e.message.content.flatMap(block => (block.type === "text" && typeof block.text === "string" ? [block.text] : [])).join("\n\n");

        if (text.trim()) {
            await noteSpeakers($, text);
        }

        return stored;
    });

    // The panel beside the chat; during a meeting, the band above the prompt; a reply where colleagues speak, as a group chat.
    on("ui.render", { component: "Pane", requestId: pane }, drawPane);
    on("ui.render", { component: "AbovePrompt" }, drawBand);
    on("ui.render", { component: "AssistantMessage" }, drawMessage);
};
