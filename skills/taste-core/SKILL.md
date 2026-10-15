---
name: taste-core
description: "Use when the user builds, restyles, reviews or says a UI \"looks off\", \"generic\" or \"needs polish\": pages, components, dashboards, landing pages. Sets a spacing grid, type scale and single accent before writing any CSS, then enforces them in the code. Reads profile.md for brand, accent colour, vibe and framework."
---

# Taste Core

Interfaces look designed when a small set of decisions is made once and never broken: one spacing unit, one type scale, one accent. This skill fixes those decisions before any markup is written.

## Before you start

Read `profile.md` in this folder:

| profile.md line | Use |
|---|---|
| **Brand** | Name and tone; the logo or wordmark sets the visual weight. |
| **Accent** | The one accent colour. Every highlight, link and primary action uses it. |
| **Vibe** | Minimal, Editorial, Playful or Technical: picks values from the vibe table below. |
| **Framework** | Write code in it (React, Next.js, Vue, Svelte or HTML) and keep tokens as CSS variables. |

If a line says "not set", ask the user once, write the answer into profile.md, then continue.

## Workflow

1. Write a token block first: spacing, type scale, colours, radius. Show it in five lines before any component.
2. Spacing: multiples of 4px only (4, 8, 12, 16, 24, 32, 48, 64, 96). Use `gap` in flex and grid layouts instead of margins between siblings.
3. Type scale: choose a ratio and keep it. Default 1.25: 14, 16, 20, 25, 31, 39, 49. Body text is 16px minimum with 1.5 line height; headings use 1.1 to 1.2 line height and slightly negative tracking at 32px and above. Use at most two font families and three weights.
4. Colour: derive neutrals from one hue, tinted toward the accent by a few percent. The accent covers at most about 10 percent of any screen. Text against its background must reach 4.5:1 contrast, large text 3:1.
5. Layout: one primary action per view. Content width for reading text is 60 to 75 characters. Align to a column grid and keep gutters equal.
6. States: every interactive element has default, hover, focus-visible, active and disabled. Touch targets are at least 44px.
7. Build the component, then audit it against the rules below and fix before showing.

## Vibe table

| Vibe | Radius | Density | Type feel |
|---|---|---|---|
| Minimal | 6 to 8px | Roomy, 24px section padding minimum | One sans family, light borders |
| Editorial | 0 to 4px | Wide margins | Serif display, sans body |
| Playful | 12 to 20px | Medium | Rounded sans, bolder weights |
| Technical | 2 to 6px | Dense | Mono for data, tabular numbers |

## Banned unless the user asks

- Gradients, including gradient text and gradient buttons.
- Heavy drop shadows; use a 1px border or one soft shadow at low opacity.
- More than one accent colour.
- Margins used for spacing between siblings.
- Off-scale values like 13px or 22px.
- Centered body text in blocks longer than three lines.
- Never use filler text; write real copy for every element.

## Worked example

Request: "Make a pricing card." Profile: Accent #FF5A2E, Vibe Minimal, Framework Next.js.

Tokens: `--space: 4px; --text-m: 16px; --text-xl: 25px; --accent: #FF5A2E; --radius: 8px; --ink: #1B1A19; --paper: #FAF9F7`. Card padding 24px, internal `gap: 16px`, plan name 14px uppercase tracked, price 39px with 1.1 line height, a single filled accent button, features in 16px with 8px gaps. White text on #FF5A2E fails 4.5:1, so the button uses dark `--ink` text. Check the pair with a contrast calculator before shipping.

## Checklist

- Every spacing value is a multiple of 4.
- Every font size comes from the scale.
- The accent appears on one primary action per view and nowhere decorative.
- Body text and button text meet 4.5:1.
- All five interactive states exist.
- The layout holds at 375px wide with no horizontal scroll.

For a committed design direction with a signature moment and a scored audit, use Taste Director; for font pairings use Type Pairing.

## Output

The token block first, then the component or page in the profile's Framework, then a three-line note listing any rule you had to bend and why (for example a contrast fix).
