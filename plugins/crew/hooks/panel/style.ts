// The panel's colors, sizes and limits.
import { pickedTint } from "../draw/index.ts";

// The sections' icons, drawn as text (U+FE0E) so they stay monochrome like the buttons' symbols.
export const sectionIcons = { meeting: "☰", working: "⚒︎", finished: "✓", resting: "☕︎" };
// The error color, readable on both themes: the firing buttons.
export const errorColor = "#D0453F";
// A task's priority on the terminal, as the desktop draws it: two arrows up in red, an equals in orange, an arrow down in blue.
export const priorityGlyphs: Record<string, { glyph: string; color: string }> = { P1: { glyph: "⇈", color: "#E5493A" }, P2: { glyph: "=", color: "#E2852B" }, P3: { glyph: "↓", color: "#4C8FE0" } };
// The priority after each, as a press on the mark turns it.
export const nextPriorities: Record<string, string> = { P1: "P2", P2: "P3", P3: "P1" };
// How long the lists keep their order after a priority turns, and how long Remove waits for its second press.
export const frozenFor = 4000;
export const removeAskFor = 4000;
// A backlog task's number in its own color, as the project plugin draws it; a due day near or a task stuck in progress, in a warning's.
export const taskColor = "#2E9AA6";
export const warningColor = "#E2852B";
// A ▶ that cannot be pressed now: gray, fainter than a dim one.
export const idleColor = "#80808040";
// A chip's text where it has no color of its own.
export const quietColor = "#888780";
// A field's button is a mark, as the project plugin's: save, add.
export const saveMark = "✓";
export const addMark = "+";
// Days in progress with nobody at work on it after which a backlog task is stuck, as the project plugin's default.
export const staleDays = 3;
// The dashboard's tiles of who is at work and of the week.
export const workingColor = "#4E9A6B";
export const weekColor = "#8A63C9";
// A task that waits for another's: its chain mark and its words.
export const blockedColor = "#C9A227";
// Material's hover state layer, in a gray that reads on light and dark themes.
export const stateLayer = "#80808014";
// Every card's faint gray, the same for all, and the state layer under the pointer; a picked colleague's in their color.
const cardTint = "#80808003";
export const tinted = (picked?: string) => (picked ? { backgroundColor: pickedTint(picked), hover: { backgroundColor: pickedTint(picked) } } : { backgroundColor: cardTint, hover: { backgroundColor: stateLayer } });
// The name larger still in a colleague's own card.
export const cardNameSize = 18;
// The permissions, in the order the card shows them.
export const permissionKinds = ["read", "write", "test", "web"] as const;
// How many open tasks the backlog shows.
export const backlogSize = 20;
// The tasks a colleague's card shows before "show all".
export const cardTaskLimit = 10;
// The open lines a colleague's todo keeps, as the skill says; past them, the tidy button picks it when nobody is picked.
export const todoLimit = 15;
// The backlog's effort column and a colleague's card at its narrowest, in cells.
export const effortWidth = 4;
export const cardWidth = 30;
// How long a start the user asked for shows on its button, at most, while Claude starts the colleague.
export const startingFor = 120_000;
// A tooltip in Material's inverse colors, which read on both themes.
export const tooltipBackground = "#2b2b29";
export const tooltipText = "#f4f4f1";

/** The effort a task needs as four marks, low to max; a level it does not know, as written. */
export function meterOf(level: string): string
{
    const filled = ({ low: 1, medium: 2, high: 3, xhigh: 4, max: 4 } as Record<string, number>)[level.toLowerCase()];
    return filled ? "▮".repeat(filled) + "▯".repeat(4 - filled) : level;
}
