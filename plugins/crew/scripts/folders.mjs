// Where the colleagues' files are: .claude/agents and .claude/agent-memory of the project. Where the project plugin (Project) keeps
// its docs in a git repo of their own, Crew keeps them there, in <docs>/crew/agents and <docs>/crew/memory, private and shared with
// the docs, and the two folders of .claude are links to them (junctions on Windows), kept out of the code's repo.
//   node folders.mjs status [--root <project>]            what is where, and what is due, as JSON
//   node folders.mjs link [--create] [--root <project>]   the links made where nothing is in their place; --create makes the docs' folders
//   node folders.mjs move [--root <project>]              .claude's own folders moved into the docs' and linked: only on the user's yes
import { execFileSync } from "node:child_process";
import { appendFileSync, cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmdirSync, rmSync, symlinkSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Each folder of .claude, and its place among the docs.
const pairs = [["agents", "agents"], ["agent-memory", "memory"]];

/** Where the colleagues' files are and what is due: `local` where they stay in .claude (no Project, docs in the code's repo or in no
 * repo); `shared` with each folder's state and the one thing due, `none`, `create` (nothing yet: the first hire makes them), `link`,
 * `move` (the user's yes first) or `conflict` (both places hold files, or a link points elsewhere: the user decides). */
export function placesOf(root)
{
    const config = join(root, ".claude", "project.yaml");

    if (!existsSync(config)) {
        return { mode: "local", reason: "no-project" };
    }

    const given = /^docs:[ \t]*["']?([^"'#\r\n]*?)["']?[ \t]*(?:#.*)?$/m.exec(readFileSync(config, "utf8"))?.[1]?.trim() || "project";
    const docs = resolve(root, given);

    if (!existsSync(docs)) {
        return { mode: "local", reason: "no-docs", docs };
    }

    const docsTop = topOf(docs);

    if (!docsTop || isSame(docsTop, topOf(root) ?? "")) {
        return { mode: "local", reason: docsTop ? "same-repo" : "no-repo", docs };
    }

    const folders = pairs.map(([local, shared]) => folderState(join(root, ".claude", local), join(docs, "crew", shared)));
    return { mode: "shared", docs, folders, due: dueOf(folders) };
}

/** The links made where nothing is in their place (or an empty folder): to the docs' folders, made first with `create`. Then kept out
 * of the code's repo, and checked there. */
export function link(root, { create = false } = {})
{
    const places = placesOf(root);

    if (places.mode !== "shared") {
        return { ...places, made: [] };
    }

    const made = [];

    for (const folder of places.folders) {
        const isFree = folder.kind === "missing" || (folder.kind === "folder" && folder.isLocalEmpty);

        // A folder the code's repo tracks stays: a link in its place would show its files deleted there.
        if (!isFree || (!folder.hasShared && !create) || tracked(root, folder.local)) {
            continue;
        }

        mkdirSync(folder.shared, { recursive: true });

        if (folder.kind === "folder") {
            rmdirSync(folder.local);
        }

        mkdirSync(dirname(folder.local), { recursive: true });
        symlinkSync(folder.shared, folder.local, "junction");
        made.push(folder.local);
    }

    keepOut(root);
    const after = placesOf(root);
    return { ...after, made, visible: visibleIn(root) };
}

/** .claude's own folders moved into the docs' (empty or missing), then linked. Refused while the code's repo tracks them, or the docs'
 * already hold files: the user decides those. */
export function move(root)
{
    const places = placesOf(root);

    if (places.mode !== "shared") {
        return { ...places, moved: [], made: [] };
    }

    const moving = places.folders.filter(folder => folder.kind === "folder" && !folder.isLocalEmpty);

    for (const folder of moving) {
        if (tracked(root, folder.local)) {
            throw new Error(`The code's repo tracks ${relative(root, folder.local)}: take it out of the repo first (git rm -r --cached ${relative(root, folder.local).replace(/\\/g, "/")}), then move.`);
        }

        if (folder.hasShared && !folder.isSharedEmpty) {
            throw new Error(`${folder.shared} holds files already: merge the two folders by hand.`);
        }
    }

    const moved = [];

    // Each folder linked as soon as it is moved: a failure on the next one leaves no folder of .claude missing.
    for (const folder of moving) {
        mkdirSync(dirname(folder.shared), { recursive: true });

        if (folder.hasShared) {
            rmdirSync(folder.shared);
        }

        try {
            renameSync(folder.local, folder.shared);
        } catch (error) {
            if (error?.code !== "EXDEV") {
                throw error;
            }

            cpSync(folder.local, folder.shared, { recursive: true, verbatimSymlinks: true });
            rmSync(folder.local, { recursive: true });
        }

        symlinkSync(folder.shared, folder.local, "junction");
        moved.push(folder.local);
    }

    const linked = link(root, { create: true });
    return { ...linked, moved, made: [...moved, ...linked.made] };
}

// A folder of .claude and its place among the docs: missing, a real folder, linked there, or a link or file in the way.
function folderState(local, shared)
{
    const stat = lstatOf(local);
    const kind = !stat ? "missing" : stat.isSymbolicLink() ? (pointsTo(local, shared) ? "linked" : "elsewhere") : stat.isDirectory() ? "folder" : "file";
    const hasShared = existsSync(shared);
    return { local, shared, kind, hasShared, isSharedEmpty: hasShared && isEmpty(shared), isLocalEmpty: kind === "folder" && isEmpty(local) };
}

// The one thing due, the most pressing first.
function dueOf(folders)
{
    const isFull = folder => folder.kind === "folder" && !folder.isLocalEmpty;

    if (folders.some(folder => folder.kind === "elsewhere" || folder.kind === "file" || (isFull(folder) && folder.hasShared && !folder.isSharedEmpty))) {
        return "conflict";
    }

    if (folders.some(isFull)) {
        return "move";
    }

    const free = folders.filter(folder => folder.kind === "missing" || folder.kind === "folder");

    if (free.some(folder => folder.hasShared)) {
        return "link";
    }

    return free.length ? "create" : "none";
}

// The links named in the code's repo's own exclude file, where nothing ignores them already: a link to a folder is a path git would
// otherwise list, and the colleagues' files would reach the code's repo.
function keepOut(root)
{
    const top = topOf(root);

    if (!top) {
        return;
    }

    const exclude = resolve(root, git(root, ["rev-parse", "--git-path", "info/exclude"]) ?? join(".git", "info", "exclude"));

    for (const [local] of pairs) {
        const path = join(root, ".claude", local);

        if (git(root, ["check-ignore", "-q", "--no-index", path]) !== undefined) {
            continue;
        }

        const line = `/${relative(top, path).replace(/\\/g, "/")}`;
        const text = existsSync(exclude) ? readFileSync(exclude, "utf8") : "";

        if (!text.split(/\r?\n/).includes(line)) {
            mkdirSync(dirname(exclude), { recursive: true });
            appendFileSync(exclude, `${text && !text.endsWith("\n") ? "\n" : ""}${line}\n`);
        }
    }
}

// What git status of the code's repo shows of the two folders: nothing, once they are kept out.
function visibleIn(root)
{
    if (!topOf(root)) {
        return [];
    }

    const status = git(root, ["status", "--porcelain", "-uall", "--", ...pairs.map(([local]) => join(".claude", local))]) ?? "";
    return status.split(/\r?\n/).filter(Boolean);
}

// Whether the code's repo tracks a file under a folder.
function tracked(root, folder)
{
    return Boolean(topOf(root) && (git(root, ["ls-files", "--", relative(root, folder)]) ?? "").trim());
}

// The top folder of the git repo a folder is in, or undefined outside one.
function topOf(folder)
{
    const top = git(folder, ["rev-parse", "--show-toplevel"]);
    return top ? resolve(top) : undefined;
}

// A git command's output, trimmed; undefined when it fails.
function git(folder, args)
{
    try {
        return execFileSync("git", ["-C", folder, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch {
        return undefined;
    }
}

function lstatOf(path)
{
    try {
        return lstatSync(path);
    } catch {
        return undefined;
    }
}

function pointsTo(link, target)
{
    try {
        return isSame(realpathSync(link), realpathSync(target));
    } catch {
        return false;
    }
}

function isEmpty(folder)
{
    try {
        return readdirSync(folder).length === 0;
    } catch {
        return false;
    }
}

// Two paths the same, as the file system compares them: without case on Windows.
function isSame(one, other)
{
    const plain = path => resolve(path).replace(/[\\/]+$/, "");
    return process.platform === "win32" ? plain(one).toLowerCase() === plain(other).toLowerCase() : plain(one) === plain(other);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    const args = process.argv.slice(2);
    const at = args.indexOf("--root");
    const root = resolve(at >= 0 ? args[at + 1] ?? "." : process.env.CLAUDE_PROJECT_DIR ?? ".");
    const command = args.find(arg => !arg.startsWith("--") && args[args.indexOf(arg) - 1] !== "--root") ?? "status";

    try {
        const result = command === "link" ? link(root, { create: args.includes("--create") }) : command === "move" ? move(root) : placesOf(root);
        console.log(JSON.stringify(result, null, 2));
        process.exitCode = result.visible?.length ? 1 : 0;
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    }
}
