
CREATE OR REPLACE FUNCTION get_trip_analysis_range(
    analysis_type text,
    start_month date,
    end_month date,
    reference_cell_ids text[] DEFAULT '{}'
)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
    start_date date;
    end_date date;
BEGIN
    IF analysis_type NOT IN ('arrivals', 'departures') THEN
        RAISE EXCEPTION 'analysis_type must be either ''arrivals'' or ''departures''';
    END IF;
    
    -- Normalize to first day of month
    start_date := date_trunc('month', start_month);
    -- End date is exclusive, so add 1 month to include end_month
    end_date := date_trunc('month', end_month) + INTERVAL '1 month';
    
    RETURN (
        WITH trip_data AS (
            SELECT 
               date_month,
               CASE 
                 WHEN analysis_type = 'arrivals' THEN h3_cell_end::text
                 WHEN analysis_type = 'departures' THEN h3_cell_start::text
               END as cell_id,
               SUM(count)::bigint as total_count
            FROM "citi-bike-monthly"
            WHERE date_month >= start_date 
              AND date_month < end_date
              AND (
                 CASE 
                   WHEN array_length(reference_cell_ids, 1) IS NULL THEN TRUE
                   ELSE (
                     (analysis_type = 'arrivals' AND h3_cell_start = ANY(reference_cell_ids)) OR
                     (analysis_type = 'departures' AND h3_cell_end = ANY(reference_cell_ids))
                   )
                 END
               )
            GROUP BY 
               date_month,
               CASE 
                 WHEN analysis_type = 'arrivals' THEN h3_cell_end::text
                 WHEN analysis_type = 'departures' THEN h3_cell_start::text
               END
        ),
        monthly_aggregates AS (
            SELECT 
               date_month,
               json_object_agg(cell_id, total_count) as trip_counts,
               SUM(total_count) as sum_all_values,
               MAX(total_count) as highest_value
            FROM trip_data
            GROUP BY date_month
        )
        SELECT json_object_agg(
            date_month::text,
            json_build_object(
                'trip_counts', trip_counts,
                'sum_all_values', sum_all_values,
                'highest_value', highest_value
            )
            ORDER BY date_month
        )
        FROM monthly_aggregates
    );
END;
$$;