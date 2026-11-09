// A reply with colleagues speaking, drawn as a group chat: each turn under its speaker's portrait and name.
import { atom, read } from "claude-code";
import type { MatchedHook } from "claude-code";

import type { Speaker } from "../../types";

import { caption, chatFace, drawingBudget, faceOf, nameOf, roleOf, spacer, thumbnailSvg } from "../draw/index.ts";
import { recentlyAsked, segmentsOf, withoutClaudeMark } from "../meeting/index.ts";
import { initial, loaded, say } from "../session/index.ts";
import { listNames } from "../text/index.ts";
import { picturesOf, thumbnailHeight, thumbnailWidth } from "./pictures.ts";

const gallery = atom({ plugin: "crew", key: "gallery" } as const, initial.gallery);
const meeting = atom({ plugin: "crew", key: "meeting" } as const, initial.meeting);
const speakers = atom({ plugin: "crew", key: "speakers" } as const, initial.speakers);

// Plain Claude in a meeting's chat, where the team gave it no personality (no coordinator): its id among the speakers, and its color.
const claudeId = "claude";
const claudeOrange = "#D97757";

/** A reply where colleagues speak, as a group chat; a reply of Claude's alone, a plain message without a name in front. */
export const drawMessage: MatchedHook<"ui.render", { component: "AssistantMessage" }> = async ($, e, next) => {
    if (e.props.isSummary) {
        return next(e);
    }

    try {
        // Claude speaks too, with [Claude], when it answers the user in a meeting: the one Claude of this chat, the coordinator when
        // the team gave it a personality (among the speakers, with their name, face and color), else plain Claude.
        const voices = await read($, speakers);
        const team: Speaker[] = voices.some(voice => voice.isClaude) ? voices : [...voices, { id: claudeId, name: "Claude", fullName: "Claude", role: say().claudeRole, color: claudeOrange, isClaude: true }];
        // In a meeting, a reply that names nobody is still Claude's, drawn as such.
        const segments = segmentsOf(e.props.text, team, (await read($, meeting)).members.length > 0);

        // Claude's reply alone is a plain message, as always, without a name it may have put in front.
        if (!segments) {
            const plain = withoutClaudeMark(e.props.text, team);
            return await next(plain === e.props.text ? e : { ...e, props: { ...e.props, text: plain } });
        }

        const ui = $.ui.resolve(e);
        const { Box, Text, Markdown, Button } = ui;
        const words = say();
        // A quick answer (/crew:ask, not a meeting) carries a button that opens a meeting with whoever answered.
        const asked = (await read($, meeting)).members.length ? [] : await recentlyAsked($);
        const answered = [...new Map(segments.flatMap(segment => (segment.speaker && asked.includes(segment.speaker.id) ? [[segment.speaker.id, segment.speaker] as const] : []))).values()];
        const [firstAnswered] = answered;
        const stamp = await read($, gallery);
        // One weight for the whole message: the speakers' portraits first, in order, then the thumbnails with what is left.
        let left = drawingBudget;
        const hasPortrait = segments.map(segment => {
            const weight = segment.speaker && !segment.isContinued ? loaded.portraits.get(segment.speaker.id)?.length ?? 0 : 0;
            const fits = weight <= left;
            left -= fits ? weight : 0;
            return fits;
        });
        const pictures = e.surface !== "terminal" && "Svg" in ui ? await picturesOf($, segments.map(segment => (segment.speaker ? segment.text : "")), left) : [];
        return (
            <Box flexDirection="column" gap={1}>
                {segments.map((segment, index) => {
                    const speaker = segment.speaker;

                    if (!speaker) {
                        return <Markdown key={`n${index}`} text={segment.text} dimColor />;
                    }

                    // The portrait at the left; name, role and message in one column, so they start at the same place.
                    return (
                        <Box key={`s${index}`} flexDirection="row" flexWrap="nowrap" gap={1} alignItems="flex-start">
                            {segment.isContinued ? spacer(ui, e.surface, speaker) : faceOf(ui, e.surface, speaker, chatFace, stamp, false, false, hasPortrait[index] ? "main" : "initials")}
                            <Box flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0}>
                                {segment.isContinued ? null : nameOf(ui, e.surface, speaker, speaker.fullName)}
                                {segment.isContinued ? null : caption(ui, e.surface, roleOf(speaker))}
                                <Markdown text={segment.text} />
                                {(pictures[index] ?? []).map(picture => (
                                    <Box key={`picture-${picture.path}`} flexDirection="column" marginTop={1}>
                                        {picture.uri && "Svg" in ui ? <ui.Svg source={thumbnailSvg(picture.uri, thumbnailWidth, thumbnailHeight)} alt={picture.path} width={thumbnailWidth} height={thumbnailHeight} /> : null}
                                        <Text dimColor wrap="truncate-end">{picture.path}</Text>
                                    </Box>
                                ))}
                            </Box>
                        </Box>
                    );
                })}
                {firstAnswered
                    ? (
                        <Box key="ask-meeting-row" flexDirection="row" flexWrap="nowrap" gap={1}>
                            {spacer(ui, e.surface, firstAnswered)}
                            <Button
                                key="ask-meeting"
                                label={`☰ ${words.meetWith(listNames(answered.map(speaker => speaker.name), words.and, words.comma))}`}
                                onPress={() => $.command.run({ command: "crew:talk", args: answered.map(speaker => speaker.name).join(" ") })}
                            />
                        </Box>
                    )
                    : null}
            </Box>
        );
    } catch {
        return next(e);
    }
};
