// The project's files as the panel reads them: a folder's files with their time and size, a file read again only when those change,
// the project's root and the system's temp folder.
import type { EngineInterface } from "claude-code";

// The files the refresh has read, by path, with the time and size they had: read again only when those change.
const readFiles = new Map<string, { stamp: string; text: string }>();
let temporaryFolder: string | undefined;

/** Everything read forgotten, as at a new load of the module. */
export function forgetAll(): void
{
    readFiles.clear();
    temporaryFolder = undefined;
}

export type FileStamp = { mtimeMs: number; size: number };

// The files of a folder by name, with their time and size; a link with those of the file it leads to.
export async function filesIn($: EngineInterface, folder: string): Promise<Map<string, FileStamp>>
{
    const files = new Map<string, FileStamp>();

    for (const entry of await $.fs.list(folder)) {
        const file = entry.isLink ? await $.fs.stat(`${folder}/${entry.name}`).catch(() => undefined) : entry;

        if (file?.kind === "file") {
            files.set(entry.name, { mtimeMs: file.mtimeMs, size: file.size });
        }
    }

    return files;
}

// A file's text, or what `load` makes of it, read again only when its time or size changed.
export async function cached(path: string, file: FileStamp, load: () => Promise<string>): Promise<string>
{
    const stamp = `${file.mtimeMs}:${file.size}`;
    const kept = readFiles.get(path);

    if (kept?.stamp === stamp) {
        return kept.text;
    }

    const text = await load();
    readFiles.set(path, { stamp, text });
    return text;
}

// A colleague's files read again at the next refresh: the panel has just written one of them.
export function forgetFiles(root: string, id: string): void
{
    for (const path of readFiles.keys()) {
        if (path === `${root}/.claude/agents/${id}.md` || path.startsWith(`${root}/.claude/agent-memory/${id}/`)) {
            readFiles.delete(path);
        }
    }
}

// A file as a data URI of the given media type.
export async function dataUri($: EngineInterface, path: string, type: string): Promise<string>
{
    return `data:${type};base64,${(await $.fs.read(path, { as: "bytes" })).base64}`;
}

export async function projectRoot($: EngineInterface): Promise<string>
{
    return (await $.session.root()).replace(/\\/g, "/");
}

// Where Node's os.tmpdir() points, which is where the hook writes; read once a load.
export async function tempFolder($: EngineInterface): Promise<string>
{
    temporaryFolder ??= await systemTemp($);
    return temporaryFolder;
}

async function systemTemp($: EngineInterface): Promise<string>
{
    const isWindows = (await $.env.get("OS")) === "Windows_NT";
    const temp = await $.env.get("TEMP");
    const tmp = await $.env.get("TMP");
    const found = isWindows ? temp || tmp : (await $.env.get("TMPDIR")) || tmp || temp;

    if (found) {
        return found.replace(/\\/g, "/").replace(/\/+$/, "");
    }

    return isWindows ? `${((await $.env.get("SystemRoot")) ?? "C:/Windows").replace(/\\/g, "/")}/temp` : "/tmp";
}
