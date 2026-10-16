# Analytics pattern library

Read the dialect notes for the database in profile.md, then the pattern you need. Tables used: `events(user_id, name, occurred_at)`, `users(id, created_at)`, `orders(id, user_id, total, created_at)`. Contents: Dialect notes, Funnel, Cohort retention, DAU/WAU/MAU, Sessionisation, Dedupe latest row, Percentiles, Date spine, Running total and lag.

## Dialect notes

| Need | Postgres | BigQuery | Snowflake |
|---|---|---|---|
| Truncate to week | `date_trunc('week', ts)` (Monday) | `TIMESTAMP_TRUNC(ts, ISOWEEK)` or `DATE_TRUNC(d, WEEK(MONDAY))` | `DATE_TRUNC('week', ts)` (depends on `WEEK_START`, default Monday) |
| Convert time zone | `ts AT TIME ZONE 'America/New_York'` | `DATETIME(ts, 'America/New_York')` | `CONVERT_TIMEZONE('America/New_York', ts)` |
| Date difference | `d2 - d1` (integer days) | `DATE_DIFF(d2, d1, DAY)` | `DATEDIFF('day', d1, d2)` |
| Filter on window result | subquery or CTE | `QUALIFY` | `QUALIFY` |
| Exact percentile | `percentile_cont(0.95) WITHIN GROUP (ORDER BY x)` | `APPROX_QUANTILES(x, 100)[OFFSET(95)]` or `PERCENTILE_CONT(x, 0.95) OVER ()` | `PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY x)` |
| Generate dates | `generate_series(d1, d2, interval '1 day')` | `GENERATE_DATE_ARRAY(d1, d2)` with `UNNEST` | `TABLE(GENERATOR(ROWCOUNT => n))` plus `DATEADD` |
| Approx distinct | `COUNT(DISTINCT x)` (exact) | `APPROX_COUNT_DISTINCT(x)` | `APPROX_COUNT_DISTINCT(x)` |
| Cost lever | indexes, `EXPLAIN (ANALYZE, BUFFERS)` | partition filter on the partition column, bytes billed | clustering, warehouse size, query profile |

Time zone rule for all three: store UTC, convert once in the first CTE, group by the converted date, state the zone in the answer. Half-open ranges everywhere: `>= start AND < end`.

## Funnel

Strict ordered funnel: a user counts at step N only if they did step N after step N-1.

```sql
WITH step1 AS (   -- grain: one row per user, first signup_view time
  SELECT user_id, MIN(occurred_at) AS t1 FROM events WHERE name = 'signup_view' GROUP BY user_id
),
step2 AS (        -- grain: one row per user, first signup_submit after t1
  SELECT s.user_id, MIN(e.occurred_at) AS t2
  FROM step1 s JOIN events e ON e.user_id = s.user_id AND e.name = 'signup_submit' AND e.occurred_at >= s.t1
  GROUP BY s.user_id
),
step3 AS (        -- grain: one row per user, first purchase after t2
  SELECT s.user_id, MIN(e.occurred_at) AS t3
  FROM step2 s JOIN events e ON e.user_id = s.user_id AND e.name = 'purchase' AND e.occurred_at >= s.t2
  GROUP BY s.user_id
)
SELECT (SELECT COUNT(*) FROM step1) AS viewed,
       (SELECT COUNT(*) FROM step2) AS submitted,
       (SELECT COUNT(*) FROM step3) AS purchased;
```

Add a conversion window by changing the join to `e.occurred_at < s.t1 + interval '7 days'` (Postgres), `TIMESTAMP_ADD(s.t1, INTERVAL 7 DAY)` (BigQuery), `DATEADD('day', 7, s.t1)` (Snowflake). Step rates divide by the previous step, overall rate by step 1. Check: counts must be non-increasing.

## Cohort retention

```sql
WITH cohorts AS (   -- grain: one row per user, cohort = signup week
  SELECT id AS user_id, date_trunc('week', created_at) AS cohort_week FROM users
),
activity AS (       -- grain: one row per (user, active week)
  SELECT DISTINCT user_id, date_trunc('week', occurred_at) AS active_week FROM events
),
joined AS (         -- grain: one row per (user, active week), weeks_since computed
  SELECT c.cohort_week, c.user_id, (a.active_week::date - c.cohort_week::date) / 7 AS weeks_since
  FROM cohorts c JOIN activity a ON a.user_id = c.user_id AND a.active_week >= c.cohort_week
),
sizes AS (SELECT cohort_week, COUNT(*) AS cohort_size FROM cohorts GROUP BY 1)  -- grain: one row per cohort
SELECT j.cohort_week, j.weeks_since, COUNT(DISTINCT j.user_id) AS retained,
       ROUND(COUNT(DISTINCT j.user_id)::numeric / s.cohort_size, 3) AS retention
FROM joined j JOIN sizes s USING (cohort_week)
GROUP BY j.cohort_week, j.weeks_since, s.cohort_size
ORDER BY 1, 2;
```

Week 0 must be near 100% (it is the signup week). Cells for weeks that have not happened yet must be absent, not 0: filter `cohort_week + weeks_since * 7 < current week`.

## DAU / WAU / MAU

```sql
-- grain: one row per day; WAU/MAU use trailing windows over distinct users, not sums of DAU
WITH days AS (SELECT DISTINCT occurred_at::date AS d, user_id FROM events)
SELECT d1.d,
       COUNT(DISTINCT d1.user_id) AS dau,
       (SELECT COUNT(DISTINCT user_id) FROM days w WHERE w.d >  d1.d - 7  AND w.d <= d1.d) AS wau,
       (SELECT COUNT(DISTINCT user_id) FROM days m WHERE m.d >  d1.d - 30 AND m.d <= d1.d) AS mau
FROM days d1 GROUP BY d1.d ORDER BY d1.d;
```

Never sum DAU to get WAU (double counts). On 100M+ rows, precompute `days` into a daily table and use `APPROX_COUNT_DISTINCT` on BigQuery and Snowflake. Stickiness is `dau / mau`.

## Sessionisation

New session when the gap to the previous event exceeds 30 minutes.

```sql
WITH ordered AS (   -- grain: one row per event, with previous event time
  SELECT user_id, occurred_at,
         LAG(occurred_at) OVER (PARTITION BY user_id ORDER BY occurred_at) AS prev_at
  FROM events
),
flagged AS (        -- grain: one row per event, 1 where a session starts
  SELECT *, CASE WHEN prev_at IS NULL OR occurred_at - prev_at > interval '30 minutes' THEN 1 ELSE 0 END AS is_start
  FROM ordered
)
SELECT user_id, occurred_at,
       SUM(is_start) OVER (PARTITION BY user_id ORDER BY occurred_at ROWS UNBOUNDED PRECEDING) AS session_number
FROM flagged;
```

BigQuery: `TIMESTAMP_DIFF(occurred_at, prev_at, MINUTE) > 30`. Snowflake: `DATEDIFF('minute', prev_at, occurred_at) > 30`. Ties on `occurred_at` need a second `ORDER BY` column (event id) or sessions flicker between runs.

## Dedupe: latest row per key

```sql
-- Postgres
SELECT * FROM (
  SELECT t.*, ROW_NUMBER() OVER (PARTITION BY id ORDER BY updated_at DESC, ingested_at DESC) AS rn FROM source t
) x WHERE rn = 1;
-- BigQuery and Snowflake
SELECT * FROM source
QUALIFY ROW_NUMBER() OVER (PARTITION BY id ORDER BY updated_at DESC, ingested_at DESC) = 1;
```

Always add a tie-breaker. Postgres alternative: `SELECT DISTINCT ON (id) * FROM source ORDER BY id, updated_at DESC`.

## Percentiles

Use the dialect row in the notes table. Report p50, p90, p99 together; a mean of a skewed metric (latency, order value) hides the tail. Percentiles cannot be averaged across groups: compute from raw rows or from histogram buckets. Filter NULLs explicitly; they are ignored, which shrinks the sample silently.

## Date spine

```sql
-- Postgres: every day shows, zero when empty
WITH spine AS (SELECT d::date AS d FROM generate_series('2025-01-01'::date, '2025-01-31'::date, interval '1 day') d),
daily AS (SELECT created_at::date AS d, COUNT(*) AS n FROM orders GROUP BY 1)
SELECT s.d, COALESCE(x.n, 0) AS orders FROM spine s LEFT JOIN daily x ON x.d = s.d ORDER BY s.d;
```

BigQuery: `FROM UNNEST(GENERATE_DATE_ARRAY('2025-01-01', '2025-01-31')) AS d`. Snowflake: `SELECT DATEADD('day', SEQ4(), '2025-01-01'::date) AS d FROM TABLE(GENERATOR(ROWCOUNT => 31))`.

## Running total and lag

```sql
SELECT d, orders,
       SUM(orders) OVER (ORDER BY d ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_orders,
       orders - LAG(orders) OVER (ORDER BY d) AS change_vs_prior_day,
       RANK() OVER (ORDER BY orders DESC) AS busiest_rank
FROM daily_orders;
```

Write the frame explicitly (`ROWS`, not the default `RANGE`, which treats ties as one row). `LAG` returns NULL on the first row; leave it NULL rather than inventing 0.
