# Portraits

**One style for the whole team**, chosen with the user the first time and written as one line under the team table (`Portraits: flat vector, warm palette, plain background in each colleague's color`). Offer two or three styles with a word on each: a painted illustration, flat vector, pixel art.

**The picture**: head and shoulders, centered, facing the viewer, on a plain background in the colleague's color, nothing important near the edges (panels crop it to a circle). Their age and look from the profile, and one detail of their craft. No text.

**Who makes it**, the first one available:

1. **An image-generation connector**, such as ElevenLabs' `creative_generate_image`. Ask the user before downloading the result into the colleague's folder.
2. **The Codex CLI**, logged in with ChatGPT (never an API key, which pays by the picture): `node <this skill's folder>/../../scripts/codex-image.mjs <out.png>`, with the brief on its standard input. About 40 seconds a picture; it spends the user's Codex plan, so one picture per colleague, and a retry only when the user asks.
3. **Claude**, as SVG in the team's style: pixel art (a square grid of `<rect>`s, 32 or 48 cells a side, `shape-rendering="crispEdges"`) or flat vector (few shapes, flat colors). Square `viewBox`, no text, no scripts, no external references, under 32 KB.

**The file**: `.claude/agent-memory/<id>/avatar.png`, square, 128 px a side and under 64 KB (scale it with what the machine has: `sips`, ImageMagick, PowerShell's `System.Drawing`, Python's Pillow; keep the original as `avatar-full.png` if the user wants it), or `avatar.svg`. One of the two: a new portrait replaces the old one.
