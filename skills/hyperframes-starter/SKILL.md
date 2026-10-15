---
name: hyperframes-starter
description: "Use when the user wants to make a video from HTML with HyperFrames, asks for \"a launch video\", \"a short promo\" or \"my first composition\", or needs a scene plan for one. Plans three to six scenes sized and timed to the chosen format and length, writes the composition, previews it, then renders. Reads profile.md for brand, format, length and colours."
---

# Hyperframes Starter

HyperFrames builds video from HTML: each composition is a web page with timing attributes, rendered to video by its command line. A good first composition is mostly a planning problem. Decide the scenes, their durations and the reading time before writing any markup.

## Before you start

Read `profile.md` in this folder:

| profile.md line | Use |
|---|---|
| **Brand** | Name, and the wording on the opening and closing scenes. |
| **Format** | Canvas size and layout: 16:9 is 1920x1080, 9:16 is 1080x1920, 1:1 is 1080x1080, 4:5 is 1080x1350. |
| **Length** | Total running time, which sets the scene count. |
| **Colours** | The only colours used: background, text, accent. |

If a line says "not set", ask the user once, write the answer into profile.md, then continue.

For exact HyperFrames syntax (attribute names, how clips and tracks nest, how to start a preview and render), follow the installed HyperFrames skill or its docs. Do not guess an attribute from memory; read the docs first and match them.

## Workflow

1. Get the single message. One sentence: what the viewer should know or do at the end. If the user cannot state it, ask for it before planning.
2. Choose scene count from Length: 15s gives 3 scenes, 30s gives 4 or 5, 60s gives 5 or 6. One idea per scene.
3. Write the plan as a table before any code: scene, seconds, on-screen text, visual, motion.
4. Time each scene by reading time. Allow 0.3 seconds per word plus 1 second of hold, and never fewer than 2 seconds. A seven-word line therefore needs 3.1 seconds, so round up to 3.5.
5. Lock the structure: scene 1 is the hook and states the promise in 8 words or fewer, the middle scenes prove it, the last scene is one call to action with the brand name.
6. Apply the Colours: dark or light background, text at 4.5:1 contrast, the accent used for one element per scene.
7. Write the composition following the installed HyperFrames docs for timing and structure. Keep scene durations as named values at the top so retiming is a one-line change.
8. Render a preview first, check it frame by frame at each scene change, fix, and only then ask before the final render. Rendering can be slow, so do not start it unasked.

## Rules and thresholds

- Text on screen: at most 12 words per scene and one line of motion at a time.
- Minimum text size: 48px on 1080-wide canvases, 40px on 16:9.
- Keep text inside the safe area: for 9:16 leave the bottom fifth and top tenth clear of text, since platform buttons cover them.
- Transitions last 0.3 to 0.5 seconds. Pick one transition style for the whole video.
- Total of scene durations equals Length within 0.5 seconds. Check the sum.
- Use brand fonts only if the user supplied them; otherwise one system sans family.
- No remote assets or scripts unless the user names them. Keep everything local so the render is repeatable.

## Worked example

Profile: Brand Northwind, Format 9:16, Length 15s, Colours #111111, #FF5A2E.

| Scene | Seconds | Text | Visual |
|---|---|---|---|
| 1 | 0 to 4 | "Invoices in 10 seconds" | Dark background, large white type, accent underline |
| 2 | 4 to 9 | "Paste a client. Hit send." | Mock form, cursor hits accent button |
| 3 | 9 to 12.5 | "Paid 2x faster" only if the user supplied the figure; otherwise "No more chasing" | Single line, accent word |
| 4 | 12.5 to 15 | "Northwind. Try it free." | Wordmark centred, accent |

Total 15 seconds, 4 scenes, none above 8 words.

## Checklist

- The one message is written down and scene 1 delivers it.
- Scene count and durations match the Length, and the durations sum to it.
- Every scene holds long enough to read at 0.3 seconds per word plus 1 second.
- Only profile Colours appear.
- Text stays inside the safe area for the Format.
- A preview was rendered and checked before the final.

For a launch film that extracts promise, proof and action from your product and runs timed beat structures with scene recipes, use Launch Film; for projects built in React, use Remotion Scenes.

## Output

The scene table, then the composition files, then the exact preview command from the HyperFrames docs. After the user approves the preview, the final render command and the output file path.
