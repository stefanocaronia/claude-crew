// Paths as the guards compare them: made absolute against the project's root, with `.` and `..` resolved and forward slashes.

/** The path absolute against `root`, `.` and `..` resolved, with forward slashes; undefined for a `..` after a wildcard, whose
 * folder a glob cannot tell. */
export function resolvedPath(path: string, root: string): string | undefined
{
    const slashed = path.replace(/\\/g, "/");
    const absolute = /^([a-z]:)?\//i.test(slashed) ? slashed : `${root.replace(/\\/g, "/").replace(/\/+$/, "")}/${slashed}`;
    const [head = "", ...rest] = absolute.split("/");
    const parts: string[] = [];
    let isWild = false;

    for (const part of rest) {
        if (part === "..") {
            if (isWild) {
                return undefined;
            }

            parts.pop();
        } else if (part && part !== ".") {
            isWild ||= /[*?[{]/.test(part);
            parts.push(part);
        }
    }

    return `${head}/${parts.join("/")}`;
}

/** Whether a resolved path is `folder` or under it, ignoring case. */
export function isInside(path: string, folder: string): boolean
{
    const inner = path.toLowerCase();
    const outer = folder.toLowerCase().replace(/\/+$/, "");
    return inner === outer || inner.startsWith(`${outer}/`);
}

/** Whether a resolved path, under the project's root, lies in a colleague's own memory folder: `.claude/agent-memory/<id>/` at any
 * depth, so a link's target such as `private/.claude/agent-memory/<id>/` counts too. */
export function isOwnMemory(path: string, root: string, id: string): boolean
{
    return isInside(path, root) && `${path.toLowerCase()}/`.includes(`/.claude/agent-memory/${id.toLowerCase()}/`);
}

/** The image files a text names: paths ending in .png, .jpg, .jpeg or .webp, each once, in order. */
export function imagePathsIn(text: string): string[]
{
    const found = [...text.matchAll(/[^\s`'"()<>[\]*]+\.(?:png|jpe?g|webp)(?![\w/-])/gi)].map(match => match[0]);
    return found.filter((path, index) => found.indexOf(path) === index);
}

/** The media type of an image by its extension. */
export function imageTypeOf(path: string): string
{
    const extension = path.toLowerCase().replace(/^.*\./, "");
    return extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";
}
