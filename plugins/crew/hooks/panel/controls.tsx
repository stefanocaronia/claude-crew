// The panel's controls, drawn the same on every view: hints, chips, headings, buttons, names, portraits and cards; on the desktop
// drawings, on the terminal text.
import type { EngineInterface } from "claude-code";

import type { Colleague } from "../../types";

import { checkboxSvg, chipSvg, effortSvg, faceOf, headingSvg, iconSvg, idleButtonSvg, nameSize, nameSvg, outline, prioritySvg } from "../draw/index.ts";
import { nextEffort, setEffort } from "../team/index.ts";
import { capitalized, listNames } from "../text/index.ts";
import { cardWidth, effortWidth, errorColor, idleColor, meterOf, priorityGlyphs, quietColor, stateLayer, tinted, tooltipBackground, tooltipText } from "./style.ts";
import type { Scene } from "./scene.ts";

/** The controls of one drawing of the panel. */
export function controlsOf($: EngineInterface, scene: Scene)
{
    const { e, open, openSettings, picked, runCommand, say, stamp, togglePick, ui } = scene;
    const { Box, Text, Button } = ui;
    const isDesktop = e.surface !== "terminal" && "Svg" in ui;
    const face = (colleague: Colleague, size: number, isRinged = false, isWorking = false) => faceOf(ui, e.surface, colleague, size, stamp, isRinged, isWorking);
    // A hint under the pointer, for the controls that are only a sign: the desktop shows it on hover, the terminal draws none.
    // Below the control, or above it at the foot of a card, which cuts what overflows it; from the control's left at a card's left.
    const tip = (key: string, hint: string, control: JSX.Element, place: { isAbove?: boolean; isFromLeft?: boolean } = {}) => (isDesktop
        ? (
            <Box key={`tip-${key}`} flexShrink={0}>
                {control}
                <Box position="absolute" {...(place.isAbove ? { bottom: 1 } : { top: 1 })} {...(place.isFromLeft ? { left: 0 } : { right: 0 })} display="none" hover={{ display: "flex" }} backgroundColor={tooltipBackground} borderStyle="round" borderColor={outline} paddingX={1}>
                    <Text color={tooltipText} wrap="truncate-end">{hint}</Text>
                </Box>
            </Box>
        )
        : control);
    // A button that cannot be pressed now, as one whose command is starting: no Button, which would still take the pointer, the
    // hover and the focus (a Button has no disabled). On the desktop a drawing of its buttons, as high and as round, on the gray
    // ground; the terminal draws a Button "[ label ]".
    const idleButton = (key: string, label: string) => {
        const pill = isDesktop ? idleButtonSvg(label, stateLayer, idleColor) : undefined;
        return pill && "Svg" in ui
            ? <Box key={key} flexShrink={0}><ui.Svg source={pill.source} alt={label} width={pill.width} height={pill.height} /></Box>
            : <Box key={key} flexShrink={0}><Text dimColor>{`[ ${label} ]`}</Text></Box>;
    };
    // A chip, as the project plugin draws a task's facts: on the desktop a drawing whole, its text small on a tint, gray or of its
    // color, with round corners; in brackets on the terminal.
    const chip = (key: string, text: string, color?: string) => {
        if (!isDesktop || !("Svg" in ui)) {
            return <Box key={key} flexShrink={0}><Text color={color} dimColor={!color}>{`[${text}]`}</Text></Box>;
        }

        const drawn = chipSvg(text, color ? `${color}26` : stateLayer, color ?? quietColor);
        return <Box key={key} flexShrink={0} alignSelf="center"><ui.Svg source={drawn.source} alt={text} width={drawn.width} height={drawn.height} /></Box>;
    };
    // A section's heading: on the desktop its arrow, the button that opens and closes it, then a drawing, larger and bold, as a
    // Button draws its label in its own color and size; the drawing takes no press, so no state layer lights under the pointer
    // but the arrow's, as the project plugin's. The terminal, the button itself.
    const heading = (key: string, isOpen: boolean, label: string, onPress: () => unknown) => {
        const arrow = isOpen ? "▾" : "▸";
        const drawn = isDesktop ? headingSvg(label) : undefined;
        return drawn && "Svg" in ui
            ? (
                <Box key={`heading-${key}`} flexDirection="row" alignItems="center" columnGap={1} flexShrink={1} minWidth={0}>
                    <Button key={key} plain label={arrow} onPress={() => void onPress()} />
                    <ui.Svg source={drawn.source} alt={`${arrow} ${label}`} width={drawn.width} height={drawn.height} />
                </Box>
            )
            : <Button key={key} plain label={`${arrow} ${label}`} onPress={() => void onPress()} />;
    };
    // On the desktop a button is its mark alone, its words under the pointer; the terminal, which shows no hint, keeps them.
    const iconButton = (key: string, mark: string, words: string, onPress: () => unknown, color?: string) => {
        const label = isDesktop ? mark : `${mark} ${words}`;
        const button = color
            ? <Button key={key} plain onPress={() => void onPress()}><Text color={color}>{label}</Text></Button>
            : <Button key={key} plain dimColor label={label} onPress={() => void onPress()} />;
        return isDesktop ? tip(key, words, button) : button;
    };
    const border = isDesktop ? { borderColor: outline } : { borderDimColor: true };
    // Material's outlined card, with the state layer under the pointer.
    const outlined = (key: string, children: (JSX.Element | null)[]) => (
        <Box key={key} flexDirection="column" borderStyle="round" {...border} paddingX={1}>
            {children}
        </Box>
    );
    // On the desktop a small bordered button, empty or with a check, the surface's own checkbox look; on the terminal a box glyph.
    const pick = (colleague: Colleague) => {
        const isPicked = picked.includes(colleague.id);
        // On the desktop a square drawn at its size, a clear button laid over it takes the press; the terminal a box glyph.
        const box = isDesktop && "Svg" in ui
            ? (
                <Box key={`pick-box-${colleague.id}`} flexShrink={0}>
                    <ui.Svg source={checkboxSvg(isPicked, colleague.color)} alt={say.pickTip} width={14} height={14} />
                    <Box position="absolute" top={0} left={0}>
                        <Button key={`pick-${colleague.id}`} label={"\u2003"} plain onPress={() => togglePick(colleague)} />
                    </Box>
                </Box>
            )
            : <Button key={`pick-${colleague.id}`} label={isPicked ? "☑\uFE0E" : "☐"} plain onPress={() => togglePick(colleague)} />;
        // Above it: the box sits on the card's last row, and the card cuts what overflows it.
        return tip(`pick-${colleague.id}`, say.pickTip, box, { isAbove: true });
    };
    // A click on a colleague's effort moves it to the next level, round to the session's own.
    // On the desktop the effort's meter, as on a card at work, its words in a hint; the terminal says the words.
    const effortButton = (key: string, colleague: Colleague) => {
        const words = colleague.effort ? say.effort(colleague.effort) : say.sessionEffort;
        const onPress = () => setEffort($, colleague.id, nextEffort(colleague.effort));
        const meter = effortSvg(colleague.effort ?? "");

        if (!isDesktop || !meter || !("Svg" in ui)) {
            return <Button key={key} label={words} plain dimColor onPress={onPress} />;
        }

        // A Button holds only text: the meter is drawn, and a clear button of its size laid over it takes the press.
        return tip(key, words, (
            <Box key={`${key}-meter`} flexShrink={0} alignItems="center">
                <ui.Svg source={meter} alt={words} width={16} height={12} />
                <Box position="absolute" top={0} left={0}>
                    <Button key={key} label={"\u2003\u2003"} plain onPress={onPress} />
                </Box>
            </Box>
        ));
    };
    const portraitButton = (key: string, label: string, members: Colleague[]) => <Button key={key} label={`◐ ${label}`} onPress={() => runCommand("crew:portraits", members)} />;
    // A colleague's name, and at its right what belongs to the whole card: a mark of their work, the box that picks them.
    const nameRow = (key: string, colleague: Colleague, extras: (JSX.Element | null)[]) => (
        <Box key={`row-${key}`} flexDirection="row" flexWrap="nowrap" alignItems="center" columnGap={1} minWidth={0}>
            <Box flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden">
                {name(`name-${key}`, colleague)}
            </Box>
            {extras}
        </Box>
    );
    // In the error color: a firing is the one action that takes someone away. The command asks for a yes first.
    const fireButton = (key: string, members: Colleague[]) => (
        <Button key={key} onPress={() => runCommand("crew:fire", members)}><Text color={errorColor}>{`✕ ${say.fire(listNames(members.map(member => member.name), say.and, say.comma))}`}</Text></Button>
    );
    // The name opens the colleague's card. A button, not a link: on the desktop most clicks on a Markdown link never reach the panel.
    // The name drawn in the colleague's color, larger than the text around it; on the terminal, bold text.
    const name = (key: string, colleague: Colleague, size = nameSize) => {
        if (!isDesktop) {
            return <Text key={key} bold color={colleague.color} wrap="truncate-end">{colleague.fullName}</Text>;
        }

        const drawn = nameSvg(colleague.fullName, colleague.color, size);
        return <ui.Svg key={key} source={drawn.source} alt={colleague.fullName} width={drawn.width} height={drawn.height} />;
    };
    // The button that opens a colleague's card.
    const opener = (key: string, colleague: Colleague, onPress = open(colleague), hint = say.openCard) => tip(key, hint, <Button key={key} label="❯" plain onPress={onPress} />);
    // A pencil beside the opener, only for a colleague who may change the project's files; its meaning in a hint.
    const writeMark = (colleague: Colleague) => {
        if (!colleague.permissions.write) {
            return null;
        }

        return isDesktop
            ? tip(`write-${colleague.id}`, capitalized(say.canWrite), <ui.Svg key={`write-${colleague.id}`} source={iconSvg("pencil", 14)} alt={say.canWrite} width={14} height={14} />)
            : <Text key={`write-${colleague.id}`} dimColor>✎</Text>;
    };
    // Each colleague in an outlined card, the portrait at its top left; the cards make a grid that takes a second column when the
    // pane is wide.
    // A card is faintly gray, tinted in the colleague's color once picked; a wide one takes the panel's whole width.
    const colleagueCard = (key: string, children: (JSX.Element | null)[], color: string, isPicked = false, isWide = false) => (
        <Box key={key} flexDirection="row" flexWrap="nowrap" gap={1} alignItems="flex-start" flexGrow={1} flexShrink={1} {...(isWide ? {} : { width: cardWidth })} overflow="hidden" borderStyle="round" {...border} paddingX={1} {...(isDesktop ? tinted(isPicked ? color : undefined) : {})}>
            {children}
        </Box>
    );
    const settingsButton = <Button key="open-settings" label={`⚙\uFE0E ${say.panelSettings}`} plain dimColor onPress={openSettings} />;
    // A task of a todo, in the backlog and in a colleague's card: its priority as an issue tracker draws it, its words on one line
    // that open in place to read them whole, its age, the effort it needs and a ▶ that starts it.
    const effortCell = (key: string, level: string) => (
        <Box key={key} width={effortWidth} flexShrink={0} justifyContent="flex-end" alignItems="center">
            {isDesktop && effortSvg(level) ? <ui.Svg source={effortSvg(level) ?? ""} alt={say.effort(level)} width={16} height={12} /> : <Text dimColor>{meterOf(level)}</Text>}
        </Box>
    );
    const priorityMark = (key: string, priority: string) => {
        const drawn = isDesktop ? prioritySvg(priority) : undefined;
        const glyph = priorityGlyphs[priority];
        return drawn && "Svg" in ui
            ? <ui.Svg key={key} source={drawn} alt={say.priorityNames[priority as "P1"] ?? priority} width={14} height={14} />
            : <Text key={key} bold color={glyph?.color}>{glyph?.glyph ?? priority}</Text>;
    };
    return { face, tip, idleButton, chip, heading, iconButton, border, outlined, pick, effortButton, portraitButton, nameRow, fireButton, name, opener, writeMark, colleagueCard, settingsButton, effortCell, priorityMark };
}

export type Controls = ReturnType<typeof controlsOf>;
/** A drawing of the panel: its scene and its controls. */
export type Drawing = Scene & Controls;
