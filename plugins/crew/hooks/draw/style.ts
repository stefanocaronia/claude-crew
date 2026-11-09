// What the panel and the chat draw alike: the outline's gray, the names' and the chat's portraits' sizes, and how much a drawing
// may carry.

/** Material's outline, in a gray that reads on light and dark themes. */
export const outline = "#8080803d";
/** A name 2 px larger than the panel's text (13 px). */
export const nameSize = 15;
/** The portrait beside a colleague's turn in the chat. */
export const chatFace = 32;
/** The desktop drops a drawing that carries more than about 110 KB: all the pictures of one drawing (the panel, a message) together
 * stay under this. */
export const drawingBudget = 100_000;
