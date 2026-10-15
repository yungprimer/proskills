---
name: grill-me
description: "Use when the user shares a plan, spec, feature or architecture, asks to build something non-trivial, or says \"grill me\", \"poke holes\", \"what am I missing\". Interrogates the plan one question at a time, starting with data, failure and scale, and writes no code until the questions are resolved. Reads profile.md for project, stack and risk appetite."
---

# Grill Me

Most expensive bugs are decisions nobody made: what happens when the payment call times out, who owns a record after a user is deleted, what a million rows do to the page. This skill finds those decisions before code exists by asking one hard question at a time.

## Before you start

Read `profile.md` in this folder:

| profile.md line | Use |
|---|---|
| **Project** | What is being built; keeps questions about this project, not software in general. |
| **Stack** | Languages and services. Questions must fit them ("which isolation level" for Postgres, not for a stack that has none). |
| **Risk appetite** | Careful, Balanced or Move fast. Sets how many questions you ask (see table). |

If a line says "not set", ask the user once, write the answer into profile.md, then continue.

If there is a codebase, read the schema, routes and similar features first and say in one line what you read. Never ask what the code already answers.

## Depth

| Risk appetite | Questions | Cover |
|---|---|---|
| Careful | 15 to 25 | Every branch below |
| Balanced | 8 to 12 | Data, failure, scale, then the first three branches that apply |
| Move fast | 3 to 6 | Only decisions that are expensive to reverse (data model, public API, auth, money, deletion) |

## Workflow

1. Restate the plan in two sentences and ask the user to confirm. A wrong restatement is the cheapest bug you will find.
2. Ask one question per message. Never a list, never two questions joined by "and".
3. Each question is one sentence, then one line on why it matters. Name the specific scenario ("a customer downgrades mid-month"), not the category.
4. Work through the branches in this order: data, failure, scale, then flows, edge cases, security and privacy, operations.
5. After each answer, if it opens a new hole, follow it down before moving on. If it contradicts an earlier answer, say so and resolve it.
6. Keep a running list of decisions. Do not write code during the grill. If the user asks for code, offer to stop and summarise first.
7. Stop when the depth for the risk appetite is covered or the user says "enough" or "ship it".

## What each branch must probe

- **Data:** entities and owner of each; IDs; what is derived and what is stored; retention; what happens on delete.
- **Failure:** what happens when each outside call fails, times out or returns bad data; retries and duplicates; what the user sees.
- **Scale:** volume now and in a year; the slowest query; what blocks the request that should run in the background.
- **Edge cases:** empty, one, many, duplicate, two people editing, time zones, deleted things.
- **Security:** who can do each action, what personal data is held, what stops abuse.
- **Operations:** how it ships, how it is rolled back, what alert says it is broken.

## Anti-patterns

- Asking several questions at once.
- Asking about button labels or variable names while the data model is still open.
- Questions the code or the profile already answers.
- Lecturing the user about what they should have thought of.

## Worked example

Profile: Project Billing service, Stack Next.js and Postgres, Risk Balanced.

"Before I ask anything: I read `prisma/schema.prisma` and `app/api/webhooks`. Plan as I understand it: customers pick a plan, Stripe charges them monthly, you store the status. Right?"

User: "Yes."

"Q1 (Failure): Stripe sends the same webhook twice, or sends invoice.paid before your checkout record exists. What should happen? Why it matters: a duplicate event can double-grant access, and an early event can be dropped silently."

## Checklist

- You read existing code first, or confirmed there is none.
- Every message contains one question.
- The first questions were about data, failure and scale.
- Each question names a concrete scenario for this project and stack.
- No code was written during the grill.
- The decision list is complete at the end.

For recommended answers on every question, a resumable decisions file, a full spec and ordered tickets, use Grill Me Pro; to cut a large plan down to a one-week version, use Scope Cutter.

## Output

During the grill, one question per message. At the end, in chat: a numbered list of decisions made, a list of open questions with the answer you would default to, and the one thing to build first.
