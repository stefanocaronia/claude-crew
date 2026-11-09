// The pieces the panel and the chat draw a colleague with: their portrait, their name, their role, a progress bar; on the terminal,
// which draws no pictures, text in their place.
import type { EngineInterface } from "claude-code";

import type { Speaker } from "../../types";

import { loaded, say } from "../session/index.ts";
import { capitalized } from "../text/index.ts";
import { chatFace, nameSize } from "./style.ts";
import { avatarSvg, barEndSvg, blankSvg, captionSvg, claudeSvg, nameSvg, wideBarSvg } from "./svg.ts";

/** The elements of the surface a drawing is for. */
export type Table = ReturnType<EngineInterface["ui"]["resolve"]>;

/** The role under a name in the chat: small and gray, with a little room before the message; on the terminal, dim text. */
export function caption(ui: Table, surface: string, text: string)
{
    if (surface === "terminal" || !("Svg" in ui)) {
        return <ui.Text key="role" dimColor wrap="truncate-end">{text}</ui.Text>;
    }

    const drawn = captionSvg(text, 12, 6);
    return <ui.Svg key="role" source={drawn.source} alt={text} width={drawn.width} height={drawn.height} />;
}

/** The room of a portrait, for a speaker going on after a narrator line. */
export function spacer(ui: Table, surface: string, colleague: Speaker)
{
    if (surface === "terminal" || !("Svg" in ui)) {
        return <ui.Text key={`face-${colleague.id}`}> </ui.Text>;
    }

    return <ui.Svg key={`face-${colleague.id}`} source={blankSvg(chatFace, 1)} alt={colleague.name} width={chatFace} height={1} />;
}

/** A colleague's role as the panel and the chat write it, with a capital. Claude's, the coordinator's without one in their heading
 * included, is "your assistant". */
export function roleOf(colleague: Speaker): string
{
    return capitalized(colleague.role || (colleague.isClaude ? say().claudeRole : ""));
}

/** A colleague's name in their color, a little larger than the text around it; on the terminal, bold text. */
export function nameOf(ui: Table, surface: string, colleague: Speaker, text: string, size = nameSize)
{
    if (surface === "terminal" || !("Svg" in ui)) {
        return <ui.Text key={`name-${colleague.id}`} bold color={colleague.color} wrap="truncate-end">{text}</ui.Text>;
    }

    const drawn = nameSvg(text, colleague.color, size);
    return <ui.Svg key={`name-${colleague.id}`} source={drawn.source} alt={text} width={drawn.width} height={drawn.height} />;
}

/** A colleague's portrait at a fixed size; the terminal draws no pictures, so a dot in their color stands for it there. */
export function faceOf(ui: Table, surface: string, colleague: Speaker, size: number, stamp: number, isRinged = false, isWorking = false, picture: "main" | "small" | "initials" = "main")
{
    const { Text } = ui;

    if (surface === "terminal" || !("Svg" in ui)) {
        return <Text key={`face-${colleague.id}`} color={colleague.color}>{isWorking ? "◉" : isRinged ? "◎" : "●"}</Text>;
    }

    const portrait = picture === "initials" ? undefined : (picture === "small" ? loaded.smallPortraits : loaded.portraits).get(colleague.id);

    // The Claude of this chat, with the coordinator's personality or none, has Claude's face wherever no portrait of theirs is drawn.
    if (colleague.isClaude && !portrait) {
        return <ui.Svg key={`face-claude-${colleague.id}`} source={claudeSvg(size, isRinged ? colleague.color : undefined)} alt={colleague.fullName} width={size} height={size} />;
    }

    return <ui.Svg key={`face-${colleague.id}-${stamp}`} source={avatarSvg(colleague, portrait, size, isRinged, isWorking)} alt={colleague.fullName} width={size} height={size} />;
}

/** A progress bar as wide as the card: its square middle stretches to the room the surface gives it, between two rounded ends of
 * a fixed size, which stretching would flatten. */
export function wideBar(ui: Table, surface: string, share: number, color: string | undefined)
{
    const { Box, Text } = ui;

    if (surface === "terminal" || !("Svg" in ui)) {
        const filled = Math.round(24 * Math.max(0, Math.min(1, share)));
        return <Text key="bar" color={color} dimColor={!color}>{"█".repeat(filled) + "░".repeat(24 - filled)}</Text>;
    }

    // The filled part a pill of its share of the width, at least its two ends; the track the rest, a pill whose start the filled part covers.
    const part = Math.max(0, Math.min(1, share));
    const alt = `${Math.round(part * 100)}%`;
    const end = (key: string, side: "start" | "end", isFilled: boolean, isOverTrack = false) => <ui.Svg key={key} source={barEndSvg(side, color, isFilled, isOverTrack)} alt={alt} width={3} height={6} />;
    const middle = (key: string, isFilled: boolean) => (
        <Box key={key} flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden">
            <ui.Svg key={`${key}-drawn`} source={wideBarSvg(color, isFilled)} alt={alt} height={6} />
        </Box>
    );
    return (
        <Box key="bar" flexDirection="row" flexWrap="nowrap" flexGrow={1} minWidth={0}>
            {part > 0
                ? (
                    <Box key="bar-filled" flexDirection="row" flexWrap="nowrap" flexShrink={0} width={part < 1 ? `${Math.max(3, Math.round(part * 100))}%` : "100%"}>
                        {end("bar-filled-start", "start", true)}
                        {middle("bar-filled-middle", true)}
                        {end("bar-filled-end", "end", true, part < 1)}
                    </Box>
                )
                : null}
            {part < 1
                ? (
                    <Box key="bar-track" flexDirection="row" flexWrap="nowrap" flexGrow={1} flexShrink={1} minWidth={0}>
                        {part > 0 ? null : end("bar-track-start", "start", false)}
                        {middle("bar-track-middle", false)}
                        {end("bar-track-end", "end", false)}
                    </Box>
                )
                : null}
        </Box>
    );
}
