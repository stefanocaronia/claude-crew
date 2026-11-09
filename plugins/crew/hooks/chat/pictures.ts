// The pictures a colleague names in the chat, drawn small under their turn: light enough files only, and few, since the desktop
// drops a drawing that carries too much.
import type { EngineInterface } from "claude-code";

import { dataUri, imagePathsIn, imageTypeOf, isInside, projectRoot, resolvedPath } from "../files/index.ts";

export const thumbnailWidth = 320;
export const thumbnailHeight = 180;
const thumbnailFileLimit = 60_000;
const thumbnailsPerMessage = 2;
const thumbnails = new Map<string, { mtimeMs: number; uri: string | undefined }>();

/** The pictures each colleague's turn names, under the project's root: a thumbnail for the light ones, while the message can carry
 * them within `budget` characters; the path alone for the rest. */
export async function picturesOf($: EngineInterface, texts: string[], budget: number): Promise<{ path: string; uri?: string }[][]>
{
    const root = await projectRoot($);
    let count = 0;
    let weight = 0;
    const pictures: { path: string; uri?: string }[][] = [];

    for (const text of texts) {
        const found: { path: string; uri?: string }[] = [];

        for (const path of imagePathsIn(text)) {
            const resolved = resolvedPath(path, root);
            const thumbnail = resolved && isInside(resolved, root) ? await thumbnailOf($, resolved) : undefined;

            if (!thumbnail) {
                continue;
            }

            const fits = thumbnail.uri !== undefined && count < thumbnailsPerMessage && weight + thumbnail.uri.length <= budget;
            count += fits ? 1 : 0;
            weight += fits ? thumbnail.uri?.length ?? 0 : 0;
            found.push({ path, uri: fits ? thumbnail.uri : undefined });
        }

        pictures.push(found);
    }

    return pictures;
}

// A picture file as a data URI when it is light enough, read again only when it changes; undefined when there is no such file.
async function thumbnailOf($: EngineInterface, path: string): Promise<{ uri: string | undefined } | undefined>
{
    const stat = await $.fs.stat(path).catch(() => undefined);

    if (!stat || stat.kind !== "file") {
        return undefined;
    }

    const kept = thumbnails.get(path);

    if (kept?.mtimeMs === stat.mtimeMs) {
        return kept;
    }

    const uri = stat.size <= thumbnailFileLimit ? await dataUri($, path, imageTypeOf(path)) : undefined;
    thumbnails.set(path, { mtimeMs: stat.mtimeMs, uri });
    return { uri };
}
