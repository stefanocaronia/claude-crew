// What the panel and the chat are drawn with: the pictures as SVG (svg.ts), a colleague's portrait, name and role, a progress bar
// (parts.tsx), and the sizes and colors they share (style.ts).
export * from "./svg.ts";
export { caption, faceOf, nameOf, roleOf, spacer, type Table, wideBar } from "./parts.tsx";
export { chatFace, drawingBudget, nameSize, outline } from "./style.ts";
