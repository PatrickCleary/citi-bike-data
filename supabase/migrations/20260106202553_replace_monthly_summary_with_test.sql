-- Drop the old citi_bike_monthly_summary table
DROP TABLE IF EXISTS "public"."citi_bike_monthly_summary" CASCADE;

-- Rename citi_bike_monthly_summary_test to citi_bike_monthly_summary
ALTER MATERIALIZED VIEW "public"."citi_bike_monthly_summary_test"
RENAME TO "citi_bike_monthly_summary";

-- Note: The indexes on the materialized view will automatically be renamed:
-- idx_monthly_summary_unique, idx_monthly_summary_date, idx_monthly_summary_cell, idx_monthly_summary_type
-- will continue to work with the renamed materialized view
