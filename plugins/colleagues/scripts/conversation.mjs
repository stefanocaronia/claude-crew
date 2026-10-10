// The colleagues' conversations: "voglio parlare con Matteo" or "I want to talk to Matteo" hands the chat to Matteo, with
// their file, memory and todo; two names open a meeting; "torna Claude" or "back to Claude" gives the chat back to Claude.
// Claude Code runs it on every prompt (UserPromptSubmit) and at session start (SessionStart, to survive a compaction or a
// resume) and puts what it prints into Claude's context. Who is speaking is kept per session in the system's temp folder.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(process.env.CLAUDE_PROJECT_DIR ?? process.cwd());
const stateFolder = join(tmpdir(), "claude-colleagues");
// Claude Code moves an additionalContext above 10,000 characters to a file: what does not fit is left to Read.
const contextBudget = 9800;
const calls = [
    /\b((?:voglio|vorrei|fammi|posso|devo)\s+(?:anche\s+)?parlare|parliamo|riunione)(\s+anche)?\s+con\s+(.{0,120})/gi,
    /\b((?:i(?:\s+also)?(?:\s+(?:want|need|would\s+like)|['’]d\s+like)\s+to|let\s+me|can\s+i|could\s+i)\s+(?:also\s+)?(?:talk|speak)|let['’]?s\s+(?:talk|speak)|(?:a\s+)?meeting)(\s+also)?\s+(?:to|with)\s+(.{0,120})/gi,
];
const ends = [
    /\b(?:torna(?:re)?\s+claude|riunione\s+finita|fine\s+(?:della\s+)?riunione|chiud\w*\s+(?:la\s+)?riunione|riunione\b[^.?!\n]{0,40}\bchiud\w*la)\b/i,
    /\b(?:back\s+to\s+claude|claude[,\s]+(?:come\s+)?back|(?:the\s+)?meeting(?:['’]s|\s+is)?\s+over|(?:end|close)\s+(?:the\s+|this\s+)?meeting)\b/i,
];
const nameJoiners = new Set(["e", "ed", "anche", "con", "and", "also", "with", "too", "&"]);
// "Sara può andare avanti", "Sara can go ahead", "Sara leaves a note": the words that make a leave phrase mean something else.
const notLeaving = "(?![ \\t]+(?:avanti|oltre|bene|a|ad|al|alla|allo|in|nel|nella|su|sul|con|da|dal|dalla|per|ahead|on|over|through|back|to|with|for|into|an?|the|it|this|that|out)\\b)";
// Sections of a colleague's file that only serve the review rounds: in a conversation the rules below take their place.
const roundOnlySections = /^## (?:What you return|Your memory|Cosa restituisci|La tua memoria)\b[^\n]*\n[\s\S]*?(?=^## |(?![\s\S]))/gm;
const backToClaude = "Then Claude is back, with no prefix: two or three lines on what was decided and what remains. From here on the "
    + "colleagues' instructions still in the context no longer apply. Suggest /compact only after a long conversation, when moving on "
    + "to something else.";
const leaveLine = "The user leaves with \"torna Claude\" / \"back to Claude\" or \"riunione finita\" / \"meeting over\".";

main();

function main()
{
    // A broken hook must never block a prompt: it says why on stderr and lets the prompt through.
    try {
        const input = JSON.parse(readFileSync(0, "utf8") || "{}");
        const colleagues = loadColleagues();
        const event = input.hook_event_name ?? (input.source ? "SessionStart" : "UserPromptSubmit");
        const context = event === "SessionStart" ? onSessionStart(input, colleagues) : onPrompt(input, colleagues);

        if (context) {
            process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: context } }));
        }
    } catch (error) {
        process.stderr.write(`colleagues: ${error.message}\n`);
    }
}

function onPrompt(input, colleagues)
{
    const byId = new Map(colleagues.map(colleague => [colleague.id, colleague]));
    const people = ids => ids.map(id => byId.get(id));
    const active = readActive(input.session_id).filter(id => byId.has(id));
    const prompt = input.prompt ?? input.prompt_text ?? "";
    const call = findCall(prompt, colleagues);
    const present = findPresent(prompt, colleagues);
    const sent = findLeaving(prompt, colleagues).filter(id => active.includes(id));

    if (call || (present.length && active.length) || sent.length) {
        const called = [...(call?.ids ?? []), ...present];
        const next = [...new Set(call && !call.isAdding ? called : [...active, ...called])].filter(id => !sent.includes(id) || called.includes(id));
        const leaving = active.filter(id => !next.includes(id));
        const joining = next.filter(id => !active.includes(id));
        writeActive(input.session_id, next);

        if (!next.length) {
            return `${dismiss(people(active))} ${backToClaude}`;
        }

        if (!called.length) {
            return `${dismiss(people(leaving))} ${remind(people(next))}`;
        }

        // Calling again whoever is already here gives them their files again.
        return introduce(people(next), people(joining.length ? joining : next), leaving.length ? dismiss(people(leaving)) : "");
    }

    if (ends.some(end => end.test(prompt))) {
        if (!active.length) {
            return "";
        }

        writeActive(input.session_id, []);
        return `${dismiss(people(active))} ${backToClaude}`;
    }

    return active.length ? remind(people(active)) : "";
}

function onSessionStart(input, colleagues)
{
    if (input.source === "clear") {
        writeActive(input.session_id, []);
        return "";
    }

    if (input.source !== "compact" && input.source !== "resume") {
        return "";
    }

    const present = readActive(input.session_id).map(id => colleagues.find(colleague => colleague.id === id)).filter(Boolean);

    if (!present.length) {
        return "";
    }

    const opening = `[Colleagues] ${input.source === "compact" ? "The context was compacted" : "The session resumes"}: the conversation goes on.`;
    return introduce(present, present, opening);
}

// A colleague is an agent of .claude/agents/ with a todo.md in its memory folder; the first word of its heading is its name.
function loadColleagues()
{
    const agentsFolder = join(root, ".claude", "agents");

    if (!existsSync(agentsFolder)) {
        return [];
    }

    return readdirSync(agentsFolder)
        .filter(file => file.endsWith(".md") && existsSync(join(root, memoryPath(file.slice(0, -".md".length)), "todo.md")))
        .map(file => {
            const id = file.slice(0, -".md".length);
            const heading = /^# (.+)$/m.exec(read(agentPath(id)))?.[1].trim() ?? id;
            return { id, name: heading.split(/[\s,]/)[0] };
        });
}

// "voglio parlare con Matteo e Giulia del registro" → { ids: ["matteo-conti", "giulia-ferri"], isAdding: false }
function findCall(prompt, colleagues)
{
    for (const pattern of calls) {
        for (const match of prompt.matchAll(pattern)) {
            const ids = namesIn(match[3], colleagues);

            if (ids.length) {
                return { ids, isAdding: /\b(?:anche|also)\b/i.test(match[1] + (match[2] ?? "")) };
            }
        }
    }

    return null;
}

// "…con Sara presente", "with Sara present": whoever has to be there joins too.
function findPresent(prompt, colleagues)
{
    const ids = [...prompt.matchAll(/\bpresent[ei]?\s+(?:anche\s+|also\s+)?(.{0,80})/gi)].flatMap(match => namesIn(match[1], colleagues));

    for (const colleague of colleagues) {
        if (new RegExp(`\\b${escapeRegExp(colleague.name)}\\s+present[ei]?\\b`, "i").test(prompt)) {
            ids.push(colleague.id);
        }
    }

    return [...new Set(ids)];
}

// "Sara può andare", "congeda Sara", "Sara can go", "dismiss Sara": they leave the conversation, the others stay.
function findLeaving(prompt, colleagues)
{
    if (!colleagues.length) {
        return [];
    }

    const names = colleagues.map(colleague => escapeRegExp(colleague.name)).join("|");
    const list = `((?:${names})(?:\\s*(?:,|&|\\be\\b|\\bed\\b|\\band\\b)\\s*(?:${names}))*)`;
    const patterns = [
        `\\b${list}\\s+(?:può|puoi|possono|potete)\\s+(?:andare|uscire)\\b${notLeaving}`,
        `\\b${list}\\s+(?:esce|escono)\\b${notLeaving}`,
        `\\b(?:congeda|congedo|saluta|lascia\\s+andare|fai\\s+uscire|esce|escono)\\s+${list}`,
        `\\b${list}\\s+(?:can|may)\\s+(?:go|leave)\\b${notLeaving}`,
        `\\b${list}\\s+leaves?\\b${notLeaving}`,
        `\\b(?:dismiss|excuse)\\s+${list}`,
        `\\blet\\s+${list}\\s+go\\b`,
    ];
    const ids = patterns.flatMap(pattern => [...prompt.matchAll(new RegExp(pattern, "gi"))].flatMap(match => namesIn(match[1], colleagues)));
    return [...new Set(ids)];
}

// The names at the start of a text: "Matteo e Giulia del registro" → ["matteo-conti", "giulia-ferri"]
function namesIn(text, colleagues)
{
    const ids = [];

    for (const word of text.split(/[\s,;:.!?()"«»]+/)) {
        const colleague = colleagues.find(candidate => candidate.name.toLowerCase() === word.toLowerCase());

        if (colleague) {
            if (!ids.includes(colleague.id)) {
                ids.push(colleague.id);
            }
        } else if (word && !nameJoiners.has(word.toLowerCase())) {
            break;
        }
    }

    return ids;
}

function rules(people)
{
    const names = people.map(person => person.name);
    const isMeeting = people.length > 1;
    return [
        isMeeting ? `[Colleagues] Meeting with ${listNames(names)}. The rules:` : `[Colleagues] From here on ${names[0]} speaks. The rules:`,
        `- You speak as ${isMeeting ? "each of them" : names[0]}: their voice, craft and memories below, not Claude telling about them.`,
        isMeeting
            ? `- Every turn starts with the speaker's name (${names.map(name => `[${name}]`).join(", ")}). Whoever has something to say speaks, `
                + "disagreement included; when the user addresses one of them, that one answers."
            : `- Every message starts with [${names[0]}].`,
        "- Talk, don't report: this is a conversation, not a review round. Read-only holds in rounds; here each one also writes the files "
            + "of their own field, under the project's rules (discuss first, then change; commit only when the user asks).",
        "- What falls outside one's field is said, and the right colleague is named.",
        "- Memory and todo: the lines ticked [x] in an earlier session are removed; both are edited, never rewritten, because other "
            + "sessions write to them too.",
        "- Claude stays out of the dialogue as a narrator: its lines are in italics, with no name in front, and say what happens (tools, "
            + "files, errors), never the colleagues' opinions.",
        "- Answer in the language the user writes in.",
        `- ${leaveLine}`,
    ].join("\n");
}

// The rules, then the file, the memory and the todo of whoever joins; when they don't all fit, the memories and the todos win
// (they change, the persona files hardly), and the rest is named to be read.
function introduce(people, joining, opening = "")
{
    const header = [opening, rules(people)].filter(Boolean).join("\n\n");
    const blocks = joining.flatMap(person => [
        { rank: 2, title: `${person.name}, who they are`, path: agentPath(person.id), text: persona(person.id) },
        { rank: 1, title: `${person.name}, memory`, path: `${memoryPath(person.id)}/MEMORY.md` },
        { rank: 1, title: `${person.name}, todo`, path: `${memoryPath(person.id)}/todo.md` },
    ]).map(block => {
        const text = block.text ?? read(block.path);
        return { ...block, rendered: `\n\n=== ${block.title} (${block.path}) ===\n${text || "(empty)"}` };
    });
    let room = contextBudget - header.length - 120 - blocks.reduce((sum, block) => sum + block.path.length + 2, 0);

    for (const block of [...blocks].sort((first, second) => first.rank - second.rank)) {
        block.isIncluded = block.rendered.length <= room;

        if (block.isIncluded) {
            room -= block.rendered.length;
        }
    }

    const missing = blocks.filter(block => !block.isIncluded).map(block => block.path);
    const readLine = missing.length ? `\n\nNot everything fits: before answering, read in full, with Read, ${missing.join(", ")}.` : "";
    return header + readLine + blocks.filter(block => block.isIncluded).map(block => block.rendered).join("");
}

function remind(people)
{
    const names = people.map(person => person.name);
    const who = people.length > 1
        ? `Still a meeting with ${listNames(names)}: every turn starts with the speaker's name.`
        : `${names[0]} is still speaking: the message starts with [${names[0]}].`;
    const files = people.map(person => `${agentPath(person.id)} and ${memoryPath(person.id)}/`).join("; ");
    return `[Colleagues] ${who} If their file, memory or todo are no longer in the context, read them again before answering (${files}). ${leaveLine}`;
}

function dismiss(people)
{
    const names = people.map(person => person.name);
    const isMany = people.length > 1;
    const files = people.map(person => `${memoryPath(person.id)}/MEMORY.md and todo.md`).join("; ");
    return `[Colleagues] ${isMany ? `${listNames(names)} leave` : `${names[0]} leaves`}. First of all ${isMany ? "each of them updates" : `${names[0]} updates`}, `
        + "in a few lines and in their own voice, the memory (the date, what was discussed, what the user decided and why, what they "
        + `understood) and the todo (- [x] what is done, - [ ] what remains), editing them, never rewriting them: ${files}.`;
}

// The persona without the frontmatter and without the sections that only serve the rounds.
function persona(id)
{
    return read(agentPath(id)).replace(/^---\n[\s\S]*?\n---\n/, "").replace(roundOnlySections, "").trim();
}

function readActive(sessionId)
{
    try {
        return JSON.parse(readFileSync(statePath(sessionId), "utf8")).active ?? [];
    } catch {
        return [];
    }
}

function writeActive(sessionId, active)
{
    if (!active.length) {
        rmSync(statePath(sessionId), { force: true });
        return;
    }

    mkdirSync(stateFolder, { recursive: true });
    writeFileSync(statePath(sessionId), JSON.stringify({ active, project: root, updated: new Date().toISOString() }));
}

function statePath(sessionId)
{
    return join(stateFolder, `${String(sessionId ?? "default").replace(/[^\w-]/g, "_")}.json`);
}

function agentPath(id)
{
    return `.claude/agents/${id}.md`;
}

function memoryPath(id)
{
    return `.claude/agent-memory/${id}`;
}

function read(path)
{
    const file = join(root, path);
    return existsSync(file) ? readFileSync(file, "utf8").replace(/\r\n/g, "\n").trim() : "";
}

function listNames(names)
{
    return names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

function escapeRegExp(text)
{
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
