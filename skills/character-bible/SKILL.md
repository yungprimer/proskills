---
name: character-bible
description: "Use when the user creates, names, reuses or continues an AI character, model or influencer, or says \"keep the same face\", \"same girl every time\", \"my character looks different each render\". Writes a character bible with fixed face anchors, body, age range and a negative list, then repeats it word for word in every image or video prompt. Reads profile.md for model name, look, style, setting and camera."
---

# Character Bible

A character stays the same person only if the words describing her never change. Image models drift because every prompt re-describes the face in new words. This skill writes the description once, freezes it, and pastes it unchanged into every prompt.

## Before you start

Read `profile.md` in this folder:

| profile.md line | Use |
|---|---|
| **Model name** | The character's name. Use it as the label for the bible and every prompt. |
| **Look** | Source for the face anchors, hair, build and age range. Expand it, never contradict it. |
| **Style** | Wardrobe and mood default for each shot. |
| **Setting** | Default locations. Rotate through them. |
| **Camera** | The camera line appended to every prompt (lens, film or phone look). |

If a line says "not set", ask the user once, write the answer into profile.md, then continue.

## Workflow

1. Check whether a bible already exists (a `character-bible` section in profile.md or a file the user names). If yes, load it and skip to step 5. Never rewrite a locked bible unless the user asks.
2. Expand **Look** into face anchors. Fill all eight slots: face shape, eye colour and shape, brow shape and thickness, nose, lips, skin tone with undertone, one or two permanent marks (freckles, a mole, a small scar), hair colour, cut and length. If the user gave fewer, choose the missing ones and show them for approval.
3. Fix the body in words: height range, build, shoulder width relative to hips, and a head-to-body proportion of roughly seven and a half heads for an adult. Write it once.
4. State age as a range of five years or fewer, adult only, 21 or older ("late 20s", "26 to 30"). Never a single number. Add a negative list of 6 to 10 items that must never appear: different eye colour, heavy makeup if not wanted, extra fingers, plastic skin, text or logos, a second person, and any feature that contradicts the anchors.
5. Build each prompt in this fixed order: `[anchor block, copied verbatim] + [outfit] + [pose and expression] + [setting and light] + [Camera line] + [negative list]`. Only the middle three parts change between shots.
6. For a set of shots, change one variable at a time (outfit, or setting, or pose). Changing all three at once is the main cause of drift.
7. After the user shares results, compare each against the anchors. Name which anchor drifted and tighten that one phrase, not the whole bible.

## Rules and thresholds

- The anchor block is 60 to 110 words. Shorter leaves gaps the model fills randomly; longer gets partly ignored.
- Anchors use concrete features ("hazel eyes, slightly hooded, straight dark brows"), never vibes ("beautiful", "striking", "stunning").
- Copy the anchor block character for character. Do not paraphrase, reorder or abbreviate it.
- One imperfection per face is permanent (a mole, a gap in the brow). Faces with no asymmetry read as synthetic.
- Do not name real people or celebrities as a likeness reference.
- Keep every prompt under 200 words so later clauses are not dropped.

## Worked example

Profile: Model name Ava; Look "late 20s, freckles, dark bob, green eyes"; Camera "35mm film".

Anchor block (frozen): "Ava, adult woman aged 26 to 30. Oval face, soft jawline. Green eyes, slightly hooded. Straight dark brows, medium thickness. Small straight nose with a faint bump at the bridge. Full lips, the lower one slightly fuller. Light olive skin with a warm undertone, freckles across nose and cheeks, one small mole under the left eye. Dark brown chin-length bob with a side part. About 168 cm, slim build, narrow shoulders."

Shot prompt: anchor block + "wearing an oatmeal knit sweater, looking just off camera, half smile" + "on a tram stop at dusk, warm window light from the left" + "35mm film, 50mm lens, f/2, visible grain" + "Negative: different eye colour, heavy makeup, extra fingers, text, second person."

## Checklist

- Anchor block has all eight slots and sits between 60 and 110 words.
- Age is a range of five years or fewer, and the character is an adult.
- Every prompt contains the anchor block unchanged.
- Each shot changes one variable from the previous one.
- The negative list is attached to every prompt.
- The Camera line from profile.md is present.

For multi-character sheets, realism rules for skin and light, drift checks across a full set and captions in the character's voice, use Character Studio; for lens-level photographic realism use Photoreal Portrait, and for a 12-shot planned campaign use Campaign Shoot.

## Output

The character bible as one fenced block the user can save, followed by the first prompt (or the requested number of prompts), each as a single copy-ready block. After a render review, a short list of drifted anchors with the fixed wording.
