INSERT INTO "citi_bike_monthly_summary" (date_month, analysis_type, cell_id, total_count)
SELECT 
    date_month,
    'arrivals' as analysis_type,
    h3_cell_end as cell_id,
    SUM(count)::bigint as total_count
FROM "citi-bike-monthly"
GROUP BY date_month, h3_cell_end;

INSERT INTO "citi_bike_monthly_summary" (date_month, analysis_type, cell_id, total_count)
SELECT 
    date_month,
    'departures' as analysis_type,
    h3_cell_start as cell_id,
    SUM(count)::bigint as total_count
FROM "citi-bike-monthly"
GROUP BY date_month, h3_cell_start;