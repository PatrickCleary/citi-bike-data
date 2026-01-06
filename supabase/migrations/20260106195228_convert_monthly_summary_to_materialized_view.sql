-- Create materialized view WITHOUT DATA to avoid timeout during creation
CREATE MATERIALIZED VIEW "public"."citi_bike_monthly_summary_test" AS
SELECT
    date_month,
    'arrivals' as analysis_type,
    h3_cell_end as cell_id,
    SUM(count)::bigint as total_count
FROM "public"."citi-bike-monthly"
GROUP BY date_month, h3_cell_end

UNION ALL

SELECT
    date_month,
    'departures' as analysis_type,
    h3_cell_start as cell_id,
    SUM(count)::bigint as total_count
FROM "public"."citi-bike-monthly"
GROUP BY date_month, h3_cell_start
WITH NO DATA;

-- Create unique index while view is empty (much faster)
CREATE UNIQUE INDEX idx_monthly_summary_unique
ON "public"."citi_bike_monthly_summary_test" (date_month, analysis_type, cell_id);

-- Create additional indexes for common query patterns while view is empty
CREATE INDEX idx_monthly_summary_date
ON "public"."citi_bike_monthly_summary_test" (date_month);

CREATE INDEX idx_monthly_summary_cell
ON "public"."citi_bike_monthly_summary_test" (cell_id);

CREATE INDEX idx_monthly_summary_type
ON "public"."citi_bike_monthly_summary_test" (analysis_type);

-- Note: Run the refresh separately after migration completes:
-- REFRESH MATERIALIZED VIEW CONCURRENTLY "public"."citi_bike_monthly_summary_test";
-- This allows you to monitor progress and won't block other operations
