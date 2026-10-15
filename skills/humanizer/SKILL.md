---
name: humanizer
description: "Use when the user writes, edits or pastes prose and says \"humanize this\", \"make it sound less like AI\", \"too robotic\", or before you hand over any post, email, landing copy or doc you drafted. Strips the most common AI tells: banned words, em-dash asides, not-X-but-Y framing, signposts and summary endings, in one pass without changing facts. Reads profile.md for brand, voice and never-say words."
---

# Humanizer

AI prose is recognisable for a handful of repeatable habits. Remove those habits, keep every fact, and the text reads as written by a person. This is a single clean-up pass, not a rewrite of the ideas.

## Before you start

Read `profile.md` in this folder:

| profile.md line | Use |
|---|---|
| **Brand** | Keep brand and product names exactly as written. |
| **Voice** | Direct, Warm, Witty, Calm, Bold or Technical. Shapes the final read (see table). |
| **Never say** | Extra banned words. They never appear in the output, including plurals and verb forms. |

If a line says "not set", ask the user once, write it into profile.md, then continue.

## Workflow

1. List the facts first: numbers, names, dates, quotes, links and caveats such as "beta" or "US only". All must survive with the same meaning.
2. Delete the structural tells (list below). Start each paragraph at its first sentence that carries information.
3. Replace the word tells. Use the plain word, or rewrite the sentence so the word is not needed.
4. Read it aloud once. Vary sentence length: at most two consecutive sentences with the same opening word, and at least one sentence under 8 words per paragraph of five or more sentences.
5. Apply the Voice, then check against the checklist and fix before output.

## Structural tells to cut

- "Not X, but Y" and "it's not just X, it's Y": state Y.
- Em dashes used for asides: use a comma, parentheses or a new sentence. Target zero.
- Signposts: "Let's dive in", "Here's the thing", "Here's why that matters".
- A question you then answer ("The result? Faster deploys.").
- Colon reveals ("The secret: consistency.").
- Summary endings: "In conclusion", "Ultimately", "At the end of the day", or a last paragraph that repeats the post.
- Lists of exactly three adjectives or clauses when fewer or more exist.

## Word tells to replace

delve, leverage, seamless, robust, tapestry, landscape (figurative), unlock, elevate, empower, game-changer, cutting-edge, navigate (figurative), realm, testament, pivotal, foster, harness, streamline, "in today's fast-paced world", "it's worth noting". Plain swaps: use for leverage, smooth for seamless, strong for robust, help for empower, key for pivotal. Also drop padding intensifiers ("truly", "incredibly", "really") and stacked hedges ("may potentially").

## Voice table

| Voice | Do |
|---|---|
| Direct | Lead with the point; imperatives; cut qualifiers. |
| Warm | "You" and "we"; contractions; no exclamation marks. |
| Witty | One dry observation per 150 words; no puns. |
| Calm | Even pace; concrete reassurance. |
| Bold | State the claim plainly; use numbers only if the source has them. |
| Technical | Exact nouns, versions and units. |

## Do not over-correct

Do not add typos, slang or invented stories. Do not change quotes, names, code or technical terms. Keep length within 15 percent of the source.

## Worked example

Before: "We're thrilled to announce that our new dashboard isn't just a redesign, it's a game-changer. Seamless integrations empower teams to unlock insights. Ready to dive in?"

After (Direct): "The new dashboard is live. It connects to your existing tools and shows each metric next to the rows behind it. Open it from the sidebar."

Cut: the not-just frame, three word tells, the rhetorical close. If the source never named the integrations, keep the claim general and flag it to the user instead of inventing specifics.

## Checklist

- No word from the word-tell list or the profile's Never say line.
- No em dashes, not-X-but-Y frames, signposts or summary endings.
- No question followed by its own answer.
- Every fact from step 1 is still there.
- Length is within 15 percent of the source.
- Nothing was invented.

For a three-pass rewrite with facts locked and voice matching, use Humanizer Pro; for checking a finished draft for voice drift, use Tone Lint.

## Output

The cleaned text only, in a code block if it will be pasted elsewhere. Add one short line after it only if you flagged a fact or kept something on purpose. Give a change list only when asked.
