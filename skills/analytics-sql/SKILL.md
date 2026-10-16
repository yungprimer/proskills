---
name: analytics-sql
description: "Use when the user says 'write a query for', 'weekly active users', 'retention by cohort', 'funnel conversion', 'why do these numbers not match', 'fix this slow report query', 'running total by month', or wants a readable analytics SQL query. Produces a CTE-per-step query with the grain stated per CTE, join fan-out checks, date spines, time zone and NULL handling, a note on how to read the result and the sanity checks that were run. Reads profile.md for database, ORM, data size and conventions; pattern library per dialect in patterns.md."
---

# Analytics SQL

Write analytics queries that a colleague can read top to bottom and that give the same number twice. Most wrong dashboards come from three causes: a join that multiplied rows, a date boundary that leaked a day, or a NULL that silently dropped a group. This skill writes the query so each of those is visible and checked.

## Before you start

Read `profile.md` in this folder:

| profile.md line | Use |
|---|---|
| **Database** | Picks the dialect for date functions, `QUALIFY`, `DATE_TRUNC`, percentile syntax. Section of the same name in `patterns.md`. |
| **ORM** | If an ORM is named, write the query as raw SQL for the reporting path and show where it plugs in (view, raw query, dbt model). "none, raw SQL" means deliver plain SQL. |
| **Data size** | Under 1M rows: clarity first. 1M-100M: filter early on the partition or date column, avoid `SELECT *`. 100M+: partition pruning, pre-aggregated daily tables, approximate distinct counts where the user accepts them. |
| **Conventions** | Naming (snake_case, plural tables, `_at` timestamps, `_id` keys) and style rules. Follow them over your defaults. |

If a line says "not set", ask once, write it into profile.md, continue. Open `patterns.md` and read the section for the database and the pattern you need.

## Workflow

1. **Restate the question as a metric.** Name the numerator, the denominator, the grain of the answer (per user per week?), the time window and the time zone. If two readings are plausible, state both and ask which one.
2. **Find the tables and keys.** Read the schema or ask for it. Write down each table's grain ("one row per order line") and its unique key. Never guess a key; run a uniqueness check (below).
3. **Build in CTEs, one step each.** Every CTE starts with a comment line `-- grain: one row per <thing>`. Order: filter source, derive, join, aggregate, final select. No subquery nested deeper than one level.
4. **Join with intent.** Name the key on both sides, state the expected cardinality (1:1, 1:many), and aggregate the "many" side to the grain of the "one" side before joining.
5. **Handle time deliberately.** Convert to the reporting time zone once, in the first CTE. Use half-open ranges `>= start AND < end`. Build a date spine when empty days must show as 0.
6. **Run the sanity checks** (below) if you have a database connection. If you cannot run anything, say so and list the checks for the user to run. Never claim a check passed that you did not run.
7. **Deliver** in the Output format.

## Decision table

| Situation | Do this | Not this |
|---|---|---|
| Count users after joining orders | `COUNT(DISTINCT user_id)`, or aggregate orders to one row per user first | `COUNT(*)` after a 1:many join |
| Date range for "March" | `>= '2025-03-01' AND < '2025-04-01'` | `BETWEEN ... AND '2025-03-31'` (drops 31 March after midnight) |
| Group with no activity should show 0 | Date spine `LEFT JOIN` facts, `COALESCE(n, 0)` | Inner join that drops the empty day |
| Average of a nullable column | State that `AVG` ignores NULL; use `COALESCE` only if NULL truly means 0 | Silent `AVG` over a mostly-NULL column |
| Latest row per key | `ROW_NUMBER() ... = 1` (or `QUALIFY`) with a tie-breaker in `ORDER BY` | `MAX(updated_at)` self-join that returns ties twice |
| Ratio | `numerator / NULLIF(denominator, 0)` | Bare division |
| Anti-join | `NOT EXISTS`, or `LEFT JOIN ... WHERE r.key IS NULL` | `NOT IN (subquery)`; one NULL in the subquery returns nothing |

## Worked example: weekly active users by plan

Question: "Weekly active users by plan for the last 8 complete weeks, UTC, Postgres."

```sql
-- grain of the whole query: one row per (week, plan)
WITH params AS (
  -- grain: one row. Last 8 complete weeks (Monday start), half-open [start_ts, end_ts)
  SELECT date_trunc('week', now() AT TIME ZONE 'UTC') - interval '8 weeks' AS start_ts,
         date_trunc('week', now() AT TIME ZONE 'UTC')                       AS end_ts
),
events_in_range AS (
  -- grain: one row per event. Source: events(user_id, occurred_at timestamptz)
  SELECT e.user_id,
         date_trunc('week', e.occurred_at AT TIME ZONE 'UTC') AS week_start
  FROM events e, params p
  WHERE (e.occurred_at AT TIME ZONE 'UTC') >= p.start_ts
    AND (e.occurred_at AT TIME ZONE 'UTC') <  p.end_ts
    AND e.user_id IS NOT NULL
),
active_users AS (
  -- grain: one row per (week_start, user_id). Collapses many events to one user-week.
  SELECT DISTINCT week_start, user_id FROM events_in_range
),
plans AS (
  -- grain: one row per user. users.id is the primary key (check 1), so the join cannot fan out.
  SELECT id AS user_id, COALESCE(plan, 'unknown') AS plan FROM users
),
joined AS (
  -- grain: one row per (week_start, user_id), same as active_users
  SELECT a.week_start, a.user_id, p.plan
  FROM active_users a
  LEFT JOIN plans p ON p.user_id = a.user_id
)
SELECT week_start::date AS week, COALESCE(plan, 'unknown') AS plan, COUNT(*) AS weekly_active_users
FROM joined
GROUP BY 1, 2
ORDER BY 1, 2;
```

Sanity checks for this query (checks 2 and 3 read the CTEs, so run them after the same `WITH` block in place of the final `SELECT`):

```sql
-- 1. Key is unique (expect 0 rows)
SELECT id FROM users GROUP BY id HAVING COUNT(*) > 1;
-- 2. Join did not fan out (expect equal numbers)
SELECT (SELECT COUNT(*) FROM active_users) AS before_join,
       (SELECT COUNT(*) FROM joined)       AS after_join;
-- 3. Totals tie out: per-week distinct users must equal the sum of plan rows for that week
SELECT week_start, COUNT(DISTINCT user_id) FROM events_in_range GROUP BY 1;
```

How to read it: each row is the number of distinct users with at least one event in that UTC week. Plans sum to the week total because every user maps to exactly one plan. Users missing from `users` land in `unknown`; a large `unknown` row means events reference deleted users.

## Rules

- One grain per CTE, stated in a comment. If you cannot state it, the CTE does two jobs: split it.
- Count rows before and after every join that is not provably 1:1. A changed count is a blocker.
- Select named columns. `SELECT *` only inside a CTE that is a plain filter.
- Qualify every column in a join with its table alias.
- The time zone and the week start day (Monday or Sunday) are stated in the answer, never implied.
- Ask before running anything heavy against production. Add `LIMIT` and a date filter, or use a replica. On BigQuery or Snowflake, check bytes scanned or warehouse size first.
- Read-only: never write data or run DDL as part of an analysis unless the user asks.
- If a result looks surprising, say what you checked before saying it is real.

## Output

````markdown
## Query: <metric name>
**Question as understood:** <numerator / denominator / grain / window / time zone>
**Dialect:** <database>

```sql
<the query, every CTE with a grain comment>
```

### How to read the result
<columns, units, what one row means, what a zero or NULL means, known caveats>

### Sanity checks
| Check | Query or method | Result |
|---|---|---|
| Key uniqueness | ... | passed / not run |
| Join fan-out (rows before and after) | ... | 1,204 -> 1,204 |
| Totals tie out | ... | ... |

### Assumptions to confirm
<anything that would change the number>
````
