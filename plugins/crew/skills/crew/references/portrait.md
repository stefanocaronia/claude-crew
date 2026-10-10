# Portraits

**One style for the whole team**, chosen with the user the first time and written as one line under the team table (`Portraits: anime, plain background in each colleague's color`). The styles, and the words that describe them in the brief:

- **realistic**: a painted or photographic look;
- **anime**: the look of 1980s–90s TV anime, hand-drawn cel animation: clean ink lines, flat cel shading, a soft retro palette, large expressive eyes;
- **pixel art**: a small grid of square pixels, a few flat colors;
- **vector**: a flat cartoon of rounded, chunky geometric shapes, bright flat colors with no outlines, big expressive eyes and friendly mascot proportions, as in modern mobile games.

Realistic and anime need an image generator (a connector or Codex); pixel art and vector Claude can also draw itself.

**Doing them again**: the user may ask for new portraits in a style, for the whole team or for some colleagues (the panel's "Rifai i ritratti…" writes the request in the prompt). Make only those asked for. When the whole team changes, change the style line too; when only some change, the team mixes styles, as the user chose.

**The picture**: head and shoulders, centered, facing the viewer, on a plain background in the colleague's color, nothing important near the edges (panels crop it to a circle). Their age and look from the profile, and one detail of their craft. No text.

**Who makes it**, the first one available:

1. **An image-generation connector**, such as ElevenLabs' `creative_generate_image`. Ask the user before downloading the result into the colleague's folder.
2. **The Codex CLI**, logged in with ChatGPT (never an API key, which pays by the picture): `node <this skill's folder>/../../scripts/codex-image.mjs <out.png>`, with the brief on its standard input. About 40 seconds a picture; it spends the user's Codex plan, so one picture per colleague, and a retry only when the user asks.
3. **Claude**, as SVG in the team's style. For pixel art, `node <this skill's folder>/../../scripts/pixel-portrait.mjs <out.svg> '<traits>'` draws a 32×32 portrait from a few traits read in the profile (background in the colleague's color, skin, hair and hair style, clothes and neckline, glasses, beard, one accessory; the script's first lines list them). For a flat geometric cartoon (big rounded head, big eyes, flat colors, no outlines), `scripts/vector-portrait.mjs` takes the same traits. Both scripts need Node.js; without it, write the SVG by hand in the same spirit. Square `viewBox`, no text, no scripts, no external references, under 32 KB.

**The files**, in `.claude/agent-memory/<id>/`:

- `avatar.jpg`: the portrait, square, 128 px a side, quality about 80, under 6 KB. Generators make large pictures: scale the result down and keep only this, unless the user wants the original too (`avatar-full.png`, kept out of git). The panel carries every portrait inside its drawing, and the desktop drops a drawing that is too heavy, so a heavier portrait is drawn as initials.
- `avatar-small.jpg`: 32 px a side, under 2 KB, for the backlog's rows: one on each task. Without it the rows use a light `avatar.svg`, or initials.

Scale them with what the machine has: Python's Pillow, `sips`, ImageMagick, PowerShell's `System.Drawing`. A portrait drawn by Claude is `avatar.svg` alone, under 8 KB. A new portrait replaces the old files.
