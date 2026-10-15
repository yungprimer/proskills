---
name: wardrobe-sets
description: "Use when the user needs outfit ideas, wardrobe, styling, a lookbook, or location and scene ideas for an AI character or model, or asks \"what should she wear\", \"where should I shoot this\". Produces outfit and setting pairs matched to the style in profile.md, described by fabric, fit and colour instead of brands. Reads profile.md for model name, look, style, setting and camera."
---

# Wardrobe & Sets

An outfit only looks right in the right place, and an image model only renders what the words describe. This skill pairs each outfit with a setting from the profile, and describes clothing as fabric, cut and colour so the result is consistent and brand-free.

## Before you start

Read `profile.md` in this folder:

| profile.md line | Use |
|---|---|
| **Model name** | Label each look with the name. |
| **Look** | Colouring and build guide the palette: choose colours that sit well against skin tone and hair. |
| **Style** | The wardrobe family. Every outfit must belong to it. |
| **Setting** | The only locations you pick from. |
| **Camera** | Decides how much detail to describe (see rules). |

If a line says "not set", ask the user once, write it into profile.md, then continue.

## Workflow

1. Ask how many looks (default 6) and whether the season is fixed. If the user gives no season, state the one you assumed.
2. Set a palette of 4 to 5 colours for the whole set: two neutrals, one main colour, one accent, one optional metallic or black. Reuse these across looks so the set feels shot on the same day.
3. For each look choose: a hero piece, a base layer, footwear, and at most one accessory.
4. Describe every garment with four facts: fabric, cut or fit, length, colour. "Heavy cotton overshirt, boxy fit, hip length, faded olive" works. "Cool streetwear jacket" does not.
5. Pair the look with one Setting from profile.md and name three concrete things in the scene: surface, light source and one background element.
6. Check the pair (see rules), swap any look that fails, then number the final table.
7. Offer to hand the table to the character prompts. Do not alter face or body description; that belongs to the character's own bible.

## Rules and thresholds

- Never name brands, logos or designer labels. Image models render logos as garbled text.
- No more than 3 patterns in one look, and never two competing prints.
- Fabric must suit the setting and weather: no wool coat on a beach, no linen in rain.
- Colour contrast: the hero piece differs from the background in value (light against dark or the reverse).
- Use each Setting at least once before repeating any, and never repeat a hero piece.
- With a Camera of phone candid, keep outfits ordinary and lived-in (creased, layered). With studio or cinema, allow tailored and structured pieces.
- The outfit must be wearable by an adult and appropriate for the platform the user posts on.

## Worked example

Profile: Style Streetwear; Setting Street, Interior; Camera Phone candid.

| # | Look | Setting | Light | Palette note |
|---|---|---|---|---|
| 1 | Boxy heavy-cotton hoodie in washed charcoal, straight dark denim, white leather low-top sneakers, small black crossbody bag | Street: wet crosswalk, shop signs behind | Overcast, flat and soft | Neutral base |
| 2 | Faded olive nylon shell jacket, ribbed grey tank, loose cargo trousers, black canvas sneakers | Interior: laundromat, row of dryers | Overhead fluorescent, slightly green | Olive as main colour |

## Checklist

- Every look sits inside the profile Style.
- Every setting comes from the profile Setting line.
- No brand or logo is mentioned.
- Each garment has fabric, fit, length and colour.
- The set shares one palette of 4 to 5 colours.
- No hero piece or setting is repeated before all are used.

For a full planned campaign with wide, medium and close shots and a hero frame, use Campaign Shoot; for the locked face and body these outfits go on, use Character Bible.

## Output

A numbered table with columns Look, Setting, Light and Palette note, plus the shared palette line above it. If the user asks, a copy-ready outfit-and-setting sentence for each row that can be dropped into an image prompt.
