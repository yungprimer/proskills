---
name: crud-scaffold
description: "Use when the user needs an internal tool, admin app, tracker or back-office that stores records: \"build me a CRUD app\", \"a simple ops dashboard\", \"a place for my team to manage X\". Models the data and confirms it first, then generates list, detail and edit views and adds authentication before any deploy. Reads profile.md for app name, stack and users."
---

# CRUD Scaffold

Internal tools fail in two places: a data model nobody agreed to, and a login that was added after the first deploy. This skill fixes both by agreeing the tables before any code, and by putting auth in before the app is reachable by anyone.

## Before you start

Read `profile.md` in this folder:

| profile.md line | Use |
|---|---|
| **App name** | Project, package and page titles. |
| **Stack** | Next.js + Supabase, Rails, Django or Laravel. Use that stack's own conventions and generators. |
| **Users** | Who uses it and how many. Decides roles (see rules). |

If a line says "not set", ask the user once, write the answer into profile.md, then continue.

## Workflow

1. Ask what the tool manages in one sentence, then list the entities in plain words (for example: customers, tickets, notes).
2. Model the data first. For each table give: name, columns with types, which are required, which are unique, and the relationships. Add `id`, `created_at`, `updated_at` to every table. Show the model as a table and wait for the user to confirm. Do not generate code before they confirm.
3. Create the schema with the stack's migration tool. Review the migration. Do not run a migration against a production database without the user's explicit confirmation.
4. Generate three views per entity: a list, a detail page and an edit form (the same form creates).
5. Add authentication and roles before the first deploy (see stack notes).
6. Seed with 10 to 20 realistic sample rows so the list, search and empty states can be checked.
7. Run the app, open each view, and fix what breaks before reporting.

## Views

- **List:** table with 25 rows per page, a text search on the main name column, sort on at least two columns, and an empty state with a create button.
- **Detail:** all fields, related records, and actions in the same place on every page.
- **Edit:** a label on every field, inline validation errors, required fields marked, save and cancel. Destructive actions ask for confirmation naming the record.

## Stack notes

- **Next.js + Supabase:** enable Row Level Security on every table and write policies before reading data from the browser. Never ship the service role key to the client.
- **Rails:** use the built-in generators and strong parameters; use the framework's authentication generator or Devise.
- **Django:** use ModelForms and class-based views; `LoginRequiredMixin` on every view.
- **Laravel:** use Eloquent, form requests for validation and a starter kit such as Breeze for auth.

## Rules

- Roles: with fewer than 10 users, two roles (admin and member) are enough. Add more only when the user names a permission difference.
- Deleting a record that others refer to should archive it, not erase it.
- Secrets live in environment variables and `.env` is git-ignored. Never print or commit a secret.
- No public sign-up unless the user asks; invite users instead.
- Validate on the server; client checks are only for convenience.

## Worked example

Profile: App name Ops Desk, Stack Next.js + Supabase, Users support team of 6.

Proposed model: `customers` (name required, email unique), `tickets` (customer_id required, title, status one of open, waiting, closed, assignee_id), `notes` (ticket_id, body). Roles: admin and agent. Confirm before I write migrations. Then: three views for each of the three tables, RLS policies limiting access to logged-in staff, email login, and 15 seeded tickets.

## Checklist

- The data model was confirmed before code.
- Every table has an id and timestamps.
- List, detail and edit exist for every entity.
- Authentication works and no page is reachable logged out.
- No secret is in the repository.
- The app was run and each view opened.

For search and filters on every list, in-place destructive confirmations and an audit log of who changed what, use Admin Panel; for billing and onboarding around a single feature, use Tiny SaaS.

## Output

The confirmed data model first, then the working app files in the profile's Stack, then a short run guide: install, environment variables needed (names only), start command, and how to create the first admin user.
