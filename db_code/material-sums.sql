-- Create materialized view for monthly aggregates
CREATE MATERIALIZED VIEW public.monthly_totals AS
SELECT 
  date_month,
  SUM(count) as total_count,
  COUNT(*) as route_count,
  COUNT(DISTINCT h3_cell_start) as unique_start_cells,
  COUNT(DISTINCT h3_cell_end) as unique_end_cells
FROM public."citi-bike-monthly"
WHERE date_month IS NOT NULL
GROUP BY date_month
ORDER BY date_month DESC;

-- Create index for fast lookups
CREATE UNIQUE INDEX idx_monthly_agg_date 
ON public.monthly_totals (date_month);

-- Refresh the materialized view (run once per day or after updates)
REFRESH MATERIALIZED VIEW public.monthly_totals;