

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_buffercache" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."add_monthly_partition_ride_data"("partition_year" integer, "partition_month" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    partition_name TEXT;
    start_date DATE;
    end_date DATE;
BEGIN
    -- Generate partition name
    partition_name := 'ride_data' || '_' || partition_year || '_' || 
                     LPAD(partition_month::TEXT, 2, '0');
    
    -- Calculate date range
    start_date := DATE(partition_year || '-' || partition_month || '-01');
    end_date := start_date + INTERVAL '1 month';
    
    BEGIN
        -- Try to create the partition
        EXECUTE format('
            CREATE TABLE %I PARTITION OF %I
            FOR VALUES FROM (%L) TO (%L)',
            partition_name,
            'ride_data',
            start_date,
            end_date
        );
        
        -- Enable RLS on the new partition
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', partition_name);
        
        RAISE NOTICE 'Created partition % for dates % to % with RLS enabled', 
                     partition_name, start_date, end_date - INTERVAL '1 day';
                     
    EXCEPTION 
        WHEN duplicate_table THEN
            RAISE NOTICE 'Partition % already exists, skipping creation', partition_name;
    END;
END;
$$;


ALTER FUNCTION "public"."add_monthly_partition_ride_data"("partition_year" integer, "partition_month" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."aggregate_citi_bike_monthly"("target_year" integer, "target_month" integer) RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    month_first_day DATE;
    inserted_count INTEGER;
BEGIN
    -- Set timeout to 15 minutes for this function
    PERFORM set_config('statement_timeout', '900000', true); -- in milliseconds
    -- OR
    -- SET statement_timeout = '900s'; -- in seconds
    
    month_first_day := DATE(target_year || '-' || LPAD(target_month::TEXT, 2, '0') || '-01');
    
    INSERT INTO "citi-bike-monthly" (h3_cell_start, h3_cell_end, date_month, count)
    SELECT 
        t.h3_cell_start,
        t.h3_cell_end,
        month_first_day,
        COUNT(*)::INTEGER
    FROM "trip-data" t
    WHERE EXTRACT(YEAR FROM t.start_date) = target_year
      AND EXTRACT(MONTH FROM t.start_date) = target_month
      AND t.h3_cell_start IS NOT NULL 
      AND t.h3_cell_end IS NOT NULL
    GROUP BY t.h3_cell_start, t.h3_cell_end;
    
    GET DIAGNOSTICS inserted_count = ROW_COUNT;
    
    RETURN inserted_count;
END;
$$;


ALTER FUNCTION "public"."aggregate_citi_bike_monthly"("target_year" integer, "target_month" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."aggregate_monthly_ride_data"("target_month" "date") RETURNS TABLE("rows_inserted" integer, "rows_updated" integer, "processing_summary" "text")
    LANGUAGE "plpgsql"
    AS $$DECLARE
    start_of_month DATE;
    end_of_month DATE;
    insert_count INTEGER := 0;
    update_count INTEGER := 0;
BEGIN 

    start_of_month := DATE_TRUNC('month', target_month)::DATE;
    end_of_month := (DATE_TRUNC('month', target_month) + INTERVAL '1 month')::DATE;
    
    -- Log the processing range
    RAISE NOTICE 'Processing rides from % to % (exclusive)', start_of_month, end_of_month;
    
    -- Insert aggregated data with conflict handling
    WITH aggregated_data AS (
        SELECT 
            h3_cell_start,
            h3_cell_end,
            start_of_month AS date_month,
            COUNT(*) AS ride_count
        FROM public.ride_data
        WHERE start_date >= start_of_month 
          AND start_date < end_of_month
          AND h3_cell_start IS NOT NULL 
          AND h3_cell_end IS NOT NULL
        GROUP BY h3_cell_start, h3_cell_end
    ),
    upsert_result AS (
        INSERT INTO public."citi-bike-monthly" (h3_cell_start, h3_cell_end, date_month, count)
        SELECT h3_cell_start, h3_cell_end, date_month, ride_count::INTEGER
        FROM aggregated_data
        ON CONFLICT (h3_cell_start, h3_cell_end, date_month)
        DO UPDATE SET 
            count = EXCLUDED.count,
            created_at = now()
        RETURNING 
            CASE WHEN xmax = '0'::xid THEN 1 ELSE 0 END as inserted,
            CASE WHEN xmax <> '0'::xid THEN 1 ELSE 0 END as updated
    )
    SELECT 
        COALESCE(SUM(inserted), 0),
        COALESCE(SUM(updated), 0)
    INTO insert_count, update_count
    FROM upsert_result;
    
    -- Return summary
    RETURN QUERY SELECT 
        insert_count,
        update_count,
        FORMAT('Processed %s: %s new records, %s updated records', 
               TO_CHAR(start_of_month, 'YYYY-MM'), 
               insert_count, 
               update_count
        );
END;$$;


ALTER FUNCTION "public"."aggregate_monthly_ride_data"("target_month" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."analyze_trip_flows_v2"("analysis_type" "text", "target_month" "date", "reference_cell_ids" "text"[] DEFAULT NULL::"text"[]) RETURNS json
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF analysis_type NOT IN ('arrivals', 'departures') THEN
        RAISE EXCEPTION 'analysis_type must be either ''arrivals'' or ''departures''';
    END IF;
    
    RETURN (
        WITH trip_data AS (
            SELECT 
               CASE 
                 WHEN analysis_type = 'arrivals' THEN h3_cell_end::text
                 WHEN analysis_type = 'departures' THEN h3_cell_start::text
               END as cell_id,
               SUM(count)::bigint as total_count
            FROM "citi-bike-monthly"
            WHERE date_month = target_month 
               AND (
                 -- If reference_cell_ids is empty, include all trips
                 CASE 
                   WHEN array_length(reference_cell_ids, 1) IS NULL THEN TRUE
                   ELSE (
                     (analysis_type = 'arrivals' AND h3_cell_start = ANY(reference_cell_ids)) OR
                     (analysis_type = 'departures' AND h3_cell_end = ANY(reference_cell_ids))
                   )
                 END
               )
               -- Exclude trips that start AND end in reference cells
               AND NOT (
                 CASE
                   WHEN array_length(reference_cell_ids, 1) IS NULL THEN FALSE
                   ELSE (
                     h3_cell_start = ANY(reference_cell_ids) AND 
                     h3_cell_end = ANY(reference_cell_ids)
                   )
                 END
               )
            GROUP BY 
               CASE 
                 WHEN analysis_type = 'arrivals' THEN h3_cell_end::text
                 WHEN analysis_type = 'departures' THEN h3_cell_start::text
               END
        ),
        aggregated_stats AS (
            SELECT 
               SUM(total_count) as sum_all_values,
               MAX(total_count) as highest_value
            FROM trip_data
        )
        SELECT json_build_object(
            'trip_counts', (
              SELECT json_object_agg(cell_id, total_count)
              FROM trip_data
            ),
            'sum_all_values', aggregated_stats.sum_all_values,
            'highest_value', aggregated_stats.highest_value
        )
        FROM aggregated_stats
    );
END;
$$;


ALTER FUNCTION "public"."analyze_trip_flows_v2"("analysis_type" "text", "target_month" "date", "reference_cell_ids" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."analyze_trip_flows_v3"("target_month" "date", "reference_cell_ids" "text"[], "analysis_type" "text") RETURNS json
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF analysis_type NOT IN ('arrivals', 'departures') THEN
        RAISE EXCEPTION 'analysis_type must be either ''arrivals'' or ''departures''';
    END IF;
    
    -- No cell filter: use precomputed summary table
    IF array_length(reference_cell_ids, 1) IS NULL THEN
        RETURN (
            WITH trip_data AS (
                SELECT cell_id, total_count
                FROM citi_bike_monthly_summary
                WHERE date_month = target_month
                  AND citi_bike_monthly_summary.analysis_type = analyze_trip_flows_v3.analysis_type
            ),
            aggregated_stats AS (
                SELECT 
                    SUM(total_count) as sum_all_values,
                    MAX(total_count) as highest_value
                FROM trip_data
            )
            SELECT json_build_object(
                'trip_counts', (
                    SELECT json_object_agg(cell_id, total_count)
                    FROM trip_data
                ),
                'sum_all_values', aggregated_stats.sum_all_values,
                'highest_value', aggregated_stats.highest_value
            )
            FROM aggregated_stats
        );
    END IF;
    
    -- With cell filter: use main table
    RETURN (
        WITH trip_data AS (
            SELECT 
               CASE 
                 WHEN analysis_type = 'arrivals' THEN h3_cell_end::text
                 WHEN analysis_type = 'departures' THEN h3_cell_start::text
               END as cell_id,
               SUM(count)::bigint as total_count
            FROM "citi-bike-monthly"
            WHERE date_month = target_month 
              AND (
                (analysis_type = 'arrivals' AND h3_cell_start = ANY(reference_cell_ids)) OR
                (analysis_type = 'departures' AND h3_cell_end = ANY(reference_cell_ids))
              )
              -- Exclude trips that start AND end in reference cells
              AND NOT (
                h3_cell_start = ANY(reference_cell_ids) AND 
                h3_cell_end = ANY(reference_cell_ids)
              )
            GROUP BY 
               CASE 
                 WHEN analysis_type = 'arrivals' THEN h3_cell_end::text
                 WHEN analysis_type = 'departures' THEN h3_cell_start::text
               END
        ),
        aggregated_stats AS (
            SELECT 
               SUM(total_count) as sum_all_values,
               MAX(total_count) as highest_value
            FROM trip_data
        )
        SELECT json_build_object(
            'trip_counts', (
              SELECT json_object_agg(cell_id, total_count)
              FROM trip_data
            ),
            'sum_all_values', aggregated_stats.sum_all_values,
            'highest_value', aggregated_stats.highest_value
        )
        FROM aggregated_stats
    );
END;
$$;


ALTER FUNCTION "public"."analyze_trip_flows_v3"("target_month" "date", "reference_cell_ids" "text"[], "analysis_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_destinations_from_start_cells"("target_month" "date", "start_cell_ids" "text"[]) RETURNS json
    LANGUAGE "sql"
    AS $$
  WITH destination_data AS (
    SELECT 
      h3_cell_end::text,
      SUM(count)::bigint as total_count
    FROM "citi-bike-monthly"
    WHERE date_month = target_month 
      AND h3_cell_start = ANY(start_cell_ids)
    GROUP BY h3_cell_end
  ),
  aggregated_stats AS (
    SELECT 
      SUM(total_count) as sum_all_values,
      MAX(total_count) as highest_value
    FROM destination_data
  )
  SELECT json_build_object(
    'destinations', (
      SELECT json_object_agg(h3_cell_end, total_count)
      FROM destination_data
    ),
    'sum_all_values', aggregated_stats.sum_all_values,
    'highest_value', aggregated_stats.highest_value
  )
  FROM aggregated_stats;
$$;


ALTER FUNCTION "public"."get_destinations_from_start_cells"("target_month" "date", "start_cell_ids" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_h3_cell_monthly_counts"("p_h3_cells" character varying[], "p_start_month" "date", "p_end_month" "date", "p_cell_type" character varying DEFAULT 'both'::character varying) RETURNS TABLE("date_month" "date", "total_count" bigint)
    LANGUAGE "plpgsql"
    AS $$BEGIN
  -- Validate that p_h3_cells is provided and not empty
  IF p_h3_cells IS NULL OR array_length(p_h3_cells, 1) IS NULL THEN
    RAISE EXCEPTION 'p_h3_cells parameter is required and must be a non-empty array';
  END IF;

  -- Return totals by month for the specified cells (aggregated)
  RETURN QUERY
  SELECT 
    cbm.date_month,
    SUM(cbm.count)::BIGINT as total_count
  FROM public."citi-bike-monthly" cbm
  WHERE 
    cbm.date_month >= p_start_month
    AND cbm.date_month <= p_end_month
    AND CASE 
      WHEN p_cell_type = 'arrivals' THEN cbm.h3_cell_end = ANY(p_h3_cells)
      WHEN p_cell_type = 'departures' THEN cbm.h3_cell_start = ANY(p_h3_cells)
      ELSE (cbm.h3_cell_start = ANY(p_h3_cells) OR cbm.h3_cell_end = ANY(p_h3_cells))
    END
  GROUP BY cbm.date_month
  ORDER BY cbm.date_month;
END;$$;


ALTER FUNCTION "public"."get_h3_cell_monthly_counts"("p_h3_cells" character varying[], "p_start_month" "date", "p_end_month" "date", "p_cell_type" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_h3_counts_by_cells"("target_month" "date", "cell_ids" "text"[]) RETURNS TABLE("h3_cell_start" "text", "total_count" bigint)
    LANGUAGE "sql"
    AS $$
  SELECT 
    h3_cell_start::text,
    SUM(count)::bigint as total_count
  FROM "citi-bike-monthly"
  WHERE date_month = target_month 
    AND h3_cell_start = ANY(cell_ids)
  GROUP BY h3_cell_start
  ORDER BY total_count DESC;
$$;


ALTER FUNCTION "public"."get_h3_counts_by_cells"("target_month" "date", "cell_ids" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_monthly_h3_counts"("target_month" "date", "result_limit" integer DEFAULT 5000) RETURNS TABLE("h3_cell_start" "text", "total_count" bigint)
    LANGUAGE "sql"
    AS $$
  SELECT 
    h3_cell_start::text,
    SUM(count)::bigint as total_count
  FROM "citi-bike-monthly"
  WHERE date_month = target_month
  GROUP BY h3_cell_start
  ORDER BY total_count DESC
  LIMIT result_limit;
$$;


ALTER FUNCTION "public"."get_monthly_h3_counts"("target_month" "date", "result_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_monthly_totals"() RETURNS TABLE("date_month" "date", "total_trips" bigint)
    LANGUAGE "plpgsql"
    AS $$BEGIN
  RETURN QUERY
  SELECT 
    m.date_month,
    SUM(m.count)::bigint as total_trips
  FROM "citi-bike-monthly" m
  GROUP BY m.date_month
  ORDER BY m.date_month;
END;$$;


ALTER FUNCTION "public"."get_monthly_totals"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_trip_analysis_range"("analysis_type" "text", "start_month" "date", "end_month" "date", "reference_cell_ids" "text"[] DEFAULT '{}'::"text"[]) RETURNS json
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    start_date date;
    end_date date;
BEGIN 
    IF analysis_type NOT IN ('arrivals', 'departures') THEN
        RAISE EXCEPTION 'analysis_type must be either ''arrivals'' or ''departures''';
    END IF;
    
    start_date := date_trunc('month', start_month);
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


ALTER FUNCTION "public"."get_trip_analysis_range"("analysis_type" "text", "start_month" "date", "end_month" "date", "reference_cell_ids" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."monthly_agg"("p_origin_cells" "text"[], "p_destination_cells" "text"[], "p_year" integer) RETURNS TABLE("date_month" "date", "total_count" bigint)
    LANGUAGE "plpgsql"
    AS $$BEGIN
  -- Validate that at least one array is provided and not empty
  IF (p_origin_cells IS NULL OR array_length(p_origin_cells, 1) IS NULL)
      AND (p_destination_cells IS NULL OR array_length(p_destination_cells, 1) IS NULL) THEN
    RAISE EXCEPTION 'At least one of p_origin_cells or p_destination_cells must be a non-empty array';
  END IF;
  
  -- Return totals by month for the specified year
  RETURN QUERY
  SELECT 
    cbm.date_month,
    SUM(cbm.count)::BIGINT as total_count
  FROM public."citi-bike-monthly" cbm
  WHERE 
    EXTRACT(YEAR FROM cbm.date_month) = p_year
    AND (
      -- If both arrays provided, match both origin AND destination
      (array_length(p_origin_cells, 1) > 0 AND array_length(p_destination_cells, 1) > 0 
       AND cbm.h3_cell_start = ANY(p_origin_cells) 
       AND cbm.h3_cell_end = ANY(p_destination_cells))
      OR
      -- If only origins provided, match origins
      (array_length(p_origin_cells, 1) > 0 AND array_length(p_destination_cells, 1) IS NULL
       AND cbm.h3_cell_start = ANY(p_origin_cells))
      OR
      -- If only destinations provided, match destinations
      (array_length(p_destination_cells, 1) > 0 AND array_length(p_origin_cells, 1) IS NULL
       AND cbm.h3_cell_end = ANY(p_destination_cells))
    )
  GROUP BY cbm.date_month
  ORDER BY cbm.date_month;
END;$$;


ALTER FUNCTION "public"."monthly_agg"("p_origin_cells" "text"[], "p_destination_cells" "text"[], "p_year" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."monthly_agg_v2"("p_year" integer, "p_origin_cells" "text"[] DEFAULT NULL::"text"[], "p_destination_cells" "text"[] DEFAULT NULL::"text"[]) RETURNS TABLE("date_month" "date", "total_count" bigint)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Validate that at least one array is provided and not empty
  IF (p_origin_cells IS NULL OR array_length(p_origin_cells, 1) IS NULL)
      AND (p_destination_cells IS NULL OR array_length(p_destination_cells, 1) IS NULL) THEN
    RAISE EXCEPTION 'At least one of p_origin_cells or p_destination_cells must be a non-empty array';
  END IF;
  
  -- Return totals by month for the specified year
  RETURN QUERY
  SELECT 
    cbm.date_month,
    SUM(cbm.count)::BIGINT as total_count
  FROM public."citi-bike-monthly" cbm
  WHERE 
    EXTRACT(YEAR FROM cbm.date_month) = p_year
    AND cbm.h3_cell_start != cbm.h3_cell_end  -- Exclude round trips
    AND (
      -- If both arrays provided, match both origin AND destination
      (array_length(p_origin_cells, 1) > 0 AND array_length(p_destination_cells, 1) > 0 
       AND cbm.h3_cell_start = ANY(p_origin_cells) 
       AND cbm.h3_cell_end = ANY(p_destination_cells))
      OR
      -- If only origins provided, match origins (excluding destinations in origin list)
      (array_length(p_origin_cells, 1) > 0 AND array_length(p_destination_cells, 1) IS NULL
       AND cbm.h3_cell_start = ANY(p_origin_cells)
       AND cbm.h3_cell_end != ALL(p_origin_cells))
      OR
      -- If only destinations provided, match destinations (excluding origins in destination list)
      (array_length(p_destination_cells, 1) > 0 AND array_length(p_origin_cells, 1) IS NULL
       AND cbm.h3_cell_end = ANY(p_destination_cells)
       AND cbm.h3_cell_start != ALL(p_destination_cells))
    )
  GROUP BY cbm.date_month
  ORDER BY cbm.date_month;
END;
$$;


ALTER FUNCTION "public"."monthly_agg_v2"("p_year" integer, "p_origin_cells" "text"[], "p_destination_cells" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_date_range"("start_date" "date", "end_date" "date") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$DECLARE
    process_date DATE;
    result_record RECORD;
    total_inserted INTEGER := 0;
    total_updated INTEGER := 0;
    current_timeout TEXT;
BEGIN
    SET LOCAL statement_timeout = '900s';
    RAISE NOTICE 'TEST!';
    -- Verify the timeout was set
    SELECT setting INTO current_timeout FROM pg_settings WHERE name = 'statement_timeout';
    RAISE NOTICE 'Timeout set to: %', current_timeout;
    
    process_date := DATE_TRUNC('month', start_date)::DATE;

    WHILE process_date <= DATE_TRUNC('month', end_date)::DATE LOOP
        BEGIN
            RAISE NOTICE 'Processing month: %', TO_CHAR(process_date, 'YYYY-MM');
            
            SELECT * INTO result_record 
            FROM aggregate_monthly_ride_data(process_date);
            
            total_inserted := total_inserted + result_record.rows_inserted;
            total_updated := total_updated + result_record.rows_updated;
            
            RAISE NOTICE 'Result: %', result_record.processing_summary;
            
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Error processing %: %', TO_CHAR(process_date, 'YYYY-MM'), SQLERRM;
        END;
        
        process_date := process_date + INTERVAL '1 month';
    END LOOP;
    
    RAISE NOTICE 'Range processing completed. Total: % inserted, % updated', 
                 total_inserted, total_updated;
END;$$;


ALTER FUNCTION "public"."process_date_range"("start_date" "date", "end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_historical_partitions"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$DECLARE
    partition_date DATE;
    cutoff_date DATE;
    result_record RECORD;
    partition_count INTEGER := 0;
    total_inserted INTEGER := 0;
    total_updated INTEGER := 0;
    processed_months TEXT[] := '{}';
BEGIN
    -- Calculate cutoff date (2 months ago)
    cutoff_date := (DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '2 months')::DATE;
    
    RAISE NOTICE 'Starting monthly aggregation for partitions older than %', 
                 TO_CHAR(cutoff_date, 'YYYY-MM');
    
    -- Loop through all ride_data partitions older than 2 months
    -- Start from a reasonable date (adjust as needed for your data range)
    partition_date := DATE '2020-01-01';
    
    WHILE partition_date < cutoff_date LOOP
        DECLARE
            partition_name TEXT;
            table_exists BOOLEAN := false;
        BEGIN
            -- Check if the partition table exists
            partition_name := 'ride_data_' || TO_CHAR(partition_date, 'YYYY_MM');
            
            SELECT EXISTS (
                SELECT 1 FROM pg_tables 
                WHERE tablename = partition_name
            ) INTO table_exists;
            
            -- Only process if the partition exists
            IF table_exists THEN
                RAISE NOTICE 'Processing historical partition: % (date: %)', 
                           partition_name, TO_CHAR(partition_date, 'YYYY-MM');
                
                -- Call your aggregation function
                SELECT * INTO result_record 
                FROM aggregate_monthly_ride_data(partition_date);
                
                partition_count := partition_count + 1;
                total_inserted := total_inserted + result_record.rows_inserted;
                total_updated := total_updated + result_record.rows_updated;
                processed_months := processed_months || TO_CHAR(partition_date, 'YYYY-MM');
                
                RAISE NOTICE 'Historical partition result: %', result_record.processing_summary;
                
                -- Optional: Add a small delay between partitions to avoid overwhelming
                PERFORM pg_sleep(0.5);
            END IF;
            
        EXCEPTION WHEN OTHERS THEN
            -- Log error but continue processing other partitions
            RAISE WARNING 'Error processing partition % (date %): %', 
                         partition_name, TO_CHAR(partition_date, 'YYYY-MM'), SQLERRM;
            
            INSERT INTO aggregation_errors (partition_name, error_message, created_at)
            VALUES (TO_CHAR(partition_date, 'YYYY-MM'), SQLERRM, NOW());
        END;
        
        -- Move to next month
        partition_date := partition_date + INTERVAL '1 month';
    END LOOP;
    
    RAISE NOTICE 'Monthly aggregation completed. Processed % partitions, % inserted, % updated', 
                 partition_count, total_inserted, total_updated;
    
    -- Log completion
    INSERT INTO aggregation_log (
        job_type, 
        partitions_processed, 
        partitions_count,
        total_inserted,
        total_updated,
        completed_at
    )
    VALUES (
        'monthly', 
        processed_months,
        partition_count,
        total_inserted,
        total_updated,
        NOW()
    );
    
END;$$;


ALTER FUNCTION "public"."process_historical_partitions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_recent_partitions"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$DECLARE
    current_month_date DATE;
    previous_month_date DATE;
    result_record RECORD;
    total_inserted INTEGER := 0;
    total_updated INTEGER := 0;
BEGIN
    -- Calculate the first day of current and previous month
    current_month_date := (DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month')::DATE;
    previous_month_date := (DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '2 months')::DATE;
    
    -- Log start
    RAISE NOTICE 'Starting daily aggregation for months: %, %', 
                 TO_CHAR(current_month_date, 'YYYY-MM'),
                 TO_CHAR(previous_month_date, 'YYYY-MM');
    
    -- Process current month
    BEGIN
        SELECT * INTO result_record 
        FROM aggregate_monthly_ride_data(current_month_date);
        
        total_inserted := total_inserted + result_record.rows_inserted;
        total_updated := total_updated + result_record.rows_updated;
        
        RAISE NOTICE 'Current month result: %', result_record.processing_summary;
        
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error processing current month %: %', 
                     TO_CHAR(current_month_date, 'YYYY-MM'), SQLERRM;
        
        INSERT INTO aggregation_errors (partition_name, error_message, created_at)
        VALUES (TO_CHAR(current_month_date, 'YYYY-MM'), SQLERRM, NOW());
    END;
    
    -- Process previous month
    BEGIN
        SELECT * INTO result_record 
        FROM aggregate_monthly_ride_data(previous_month_date);
        
        total_inserted := total_inserted + result_record.rows_inserted;
        total_updated := total_updated + result_record.rows_updated;
        
        RAISE NOTICE 'Previous month result: %', result_record.processing_summary;
        
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error processing previous month %: %', 
                     TO_CHAR(previous_month_date, 'YYYY-MM'), SQLERRM;
        
        INSERT INTO aggregation_errors (partition_name, error_message, created_at)
        VALUES (TO_CHAR(previous_month_date, 'YYYY-MM'), SQLERRM, NOW());
    END;
    
    -- Log completion
    INSERT INTO aggregation_log (
        job_type, 
        partitions_processed, 
        total_inserted,
        total_updated,
        completed_at
    )
    VALUES (
        'daily', 
        ARRAY[TO_CHAR(current_month_date, 'YYYY-MM'), TO_CHAR(previous_month_date, 'YYYY-MM')],
        total_inserted,
        total_updated,
        NOW()
    );
    
    RAISE NOTICE 'Daily aggregation completed. Total: % inserted, % updated', 
                 total_inserted, total_updated;
    
END;$$;


ALTER FUNCTION "public"."process_recent_partitions"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."aggregation_errors" (
    "id" integer NOT NULL,
    "partition_name" "text" NOT NULL,
    "error_message" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."aggregation_errors" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."aggregation_errors_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."aggregation_errors_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."aggregation_errors_id_seq" OWNED BY "public"."aggregation_errors"."id";



CREATE TABLE IF NOT EXISTS "public"."aggregation_log" (
    "id" integer NOT NULL,
    "job_type" character varying(20) NOT NULL,
    "partitions_processed" "text"[],
    "partitions_count" integer,
    "total_inserted" integer DEFAULT 0,
    "total_updated" integer DEFAULT 0,
    "completed_at" timestamp with time zone NOT NULL,
    "duration" interval GENERATED ALWAYS AS (("completed_at" - "created_at")) STORED,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."aggregation_log" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."aggregation_log_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."aggregation_log_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."aggregation_log_id_seq" OWNED BY "public"."aggregation_log"."id";



CREATE TABLE IF NOT EXISTS "public"."citi-bike-monthly" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying,
    "date_month" "date",
    "count" integer DEFAULT 0
);


ALTER TABLE "public"."citi-bike-monthly" OWNER TO "postgres";


ALTER TABLE "public"."citi-bike-monthly" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."citi-bike-monthly_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."citi_bike_monthly_summary" (
    "date_month" "date" NOT NULL,
    "analysis_type" "text" NOT NULL,
    "cell_id" "text" NOT NULL,
    "total_count" integer NOT NULL
);


ALTER TABLE "public"."citi_bike_monthly_summary" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "public"."monthly_totals" AS
 SELECT "date_month",
    "sum"("count") AS "total_count"
   FROM "public"."citi-bike-monthly"
  WHERE ("date_month" IS NOT NULL)
  GROUP BY "date_month"
  ORDER BY "date_month" DESC
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."monthly_totals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."processed_files" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_modified" timestamp with time zone,
    "file_name" character varying NOT NULL,
    "locale" "text"
);


ALTER TABLE "public"."processed_files" OWNER TO "postgres";


COMMENT ON TABLE "public"."processed_files" IS 'A table storing each file and last_modified data of the citi bike data dunmps';



ALTER TABLE "public"."processed_files" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."processed_files_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."ride_data" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
)
PARTITION BY RANGE ("start_date");


ALTER TABLE "public"."ride_data" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2013_01" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2013_01" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2013_02" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2013_02" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2013_03" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2013_03" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2013_04" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2013_04" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2013_05" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2013_05" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2013_06" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2013_06" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2013_07" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2013_07" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2013_08" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2013_08" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2013_09" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2013_09" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2013_10" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2013_10" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2013_11" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2013_11" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2013_12" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2013_12" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2014_01" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2014_01" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2014_02" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2014_02" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2014_03" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2014_03" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2014_04" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2014_04" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2014_05" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2014_05" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2014_06" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2014_06" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2014_07" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2014_07" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2014_08" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2014_08" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2014_09" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2014_09" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2014_10" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2014_10" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2014_11" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2014_11" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2014_12" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2014_12" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2015_01" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2015_01" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2015_02" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2015_02" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2015_03" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2015_03" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2015_04" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2015_04" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2015_05" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2015_05" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2015_06" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2015_06" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2015_07" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2015_07" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2015_08" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2015_08" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2015_09" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2015_09" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2015_10" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2015_10" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2015_11" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2015_11" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2015_12" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2015_12" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2016_01" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2016_01" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2016_02" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2016_02" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2016_03" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2016_03" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2016_04" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2016_04" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2016_05" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2016_05" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2016_06" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2016_06" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2016_07" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2016_07" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2016_08" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2016_08" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2016_09" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2016_09" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2016_10" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2016_10" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2016_11" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2016_11" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2016_12" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2016_12" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2017_01" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2017_01" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2017_02" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2017_02" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2017_03" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2017_03" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2017_04" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2017_04" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2017_05" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2017_05" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2017_06" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2017_06" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2017_07" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2017_07" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2017_08" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2017_08" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2017_09" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2017_09" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2017_10" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2017_10" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2017_11" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2017_11" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2017_12" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2017_12" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2018_01" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2018_01" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2018_02" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2018_02" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2018_03" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2018_03" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2018_04" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2018_04" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2018_05" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2018_05" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2018_06" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2018_06" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2018_07" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2018_07" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2018_08" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2018_08" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2018_09" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2018_09" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2018_10" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2018_10" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2018_11" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2018_11" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2018_12" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2018_12" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2019_01" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2019_01" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2019_02" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2019_02" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2019_03" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2019_03" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2019_04" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2019_04" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2019_05" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2019_05" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2019_06" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2019_06" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2019_07" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2019_07" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2019_08" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2019_08" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2019_09" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2019_09" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2019_10" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2019_10" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2019_11" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2019_11" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2019_12" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2019_12" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2020_01" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2020_01" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2020_02" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2020_02" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2020_03" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2020_03" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2020_04" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2020_04" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2020_05" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2020_05" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2020_06" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2020_06" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2020_07" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2020_07" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2020_08" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2020_08" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2020_09" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2020_09" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2020_10" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2020_10" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2020_11" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2020_11" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2020_12" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2020_12" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2021_01" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2021_01" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2021_02" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2021_02" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2021_03" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2021_03" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2021_04" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2021_04" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2021_05" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2021_05" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2021_06" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2021_06" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2021_07" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2021_07" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2021_08" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2021_08" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2021_09" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2021_09" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2021_10" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2021_10" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2021_11" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2021_11" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2021_12" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2021_12" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2022_01" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2022_01" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2022_02" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2022_02" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2022_03" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2022_03" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2022_04" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2022_04" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2022_05" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2022_05" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2022_06" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2022_06" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2022_07" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2022_07" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2022_08" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2022_08" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2022_09" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2022_09" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2022_10" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2022_10" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2022_11" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2022_11" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2022_12" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2022_12" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2023_01" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2023_01" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2023_02" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2023_02" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2023_03" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2023_03" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2023_04" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2023_04" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2023_05" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2023_05" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2023_06" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2023_06" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2023_07" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2023_07" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2023_08" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2023_08" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2023_09" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2023_09" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2023_10" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2023_10" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2023_11" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2023_11" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2023_12" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2023_12" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2024_01" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2024_01" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2024_02" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2024_02" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2024_03" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2024_03" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2024_04" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2024_04" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2024_05" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2024_05" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2024_06" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2024_06" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2024_07" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2024_07" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2024_08" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2024_08" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2024_09" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2024_09" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2024_10" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2024_10" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2024_11" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2024_11" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2024_12" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2024_12" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2025_01" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2025_01" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2025_02" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2025_02" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2025_03" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2025_03" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2025_04" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2025_04" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2025_05" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2025_05" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2025_06" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2025_06" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2025_07" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2025_07" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2025_08" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2025_08" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2025_09" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2025_09" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2025_10" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2025_10" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2025_11" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2025_11" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_data_2025_12" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ride_id" character varying NOT NULL,
    "start_date" "date" NOT NULL,
    "locale" character varying,
    "h3_cell_start" character varying,
    "h3_cell_end" character varying
);


ALTER TABLE "public"."ride_data_2025_12" OWNER TO "postgres";


ALTER TABLE "public"."ride_data" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."ride_data_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2013_01" FOR VALUES FROM ('2013-01-01') TO ('2013-02-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2013_02" FOR VALUES FROM ('2013-02-01') TO ('2013-03-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2013_03" FOR VALUES FROM ('2013-03-01') TO ('2013-04-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2013_04" FOR VALUES FROM ('2013-04-01') TO ('2013-05-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2013_05" FOR VALUES FROM ('2013-05-01') TO ('2013-06-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2013_06" FOR VALUES FROM ('2013-06-01') TO ('2013-07-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2013_07" FOR VALUES FROM ('2013-07-01') TO ('2013-08-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2013_08" FOR VALUES FROM ('2013-08-01') TO ('2013-09-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2013_09" FOR VALUES FROM ('2013-09-01') TO ('2013-10-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2013_10" FOR VALUES FROM ('2013-10-01') TO ('2013-11-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2013_11" FOR VALUES FROM ('2013-11-01') TO ('2013-12-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2013_12" FOR VALUES FROM ('2013-12-01') TO ('2014-01-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2014_01" FOR VALUES FROM ('2014-01-01') TO ('2014-02-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2014_02" FOR VALUES FROM ('2014-02-01') TO ('2014-03-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2014_03" FOR VALUES FROM ('2014-03-01') TO ('2014-04-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2014_04" FOR VALUES FROM ('2014-04-01') TO ('2014-05-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2014_05" FOR VALUES FROM ('2014-05-01') TO ('2014-06-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2014_06" FOR VALUES FROM ('2014-06-01') TO ('2014-07-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2014_07" FOR VALUES FROM ('2014-07-01') TO ('2014-08-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2014_08" FOR VALUES FROM ('2014-08-01') TO ('2014-09-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2014_09" FOR VALUES FROM ('2014-09-01') TO ('2014-10-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2014_10" FOR VALUES FROM ('2014-10-01') TO ('2014-11-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2014_11" FOR VALUES FROM ('2014-11-01') TO ('2014-12-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2014_12" FOR VALUES FROM ('2014-12-01') TO ('2015-01-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2015_01" FOR VALUES FROM ('2015-01-01') TO ('2015-02-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2015_02" FOR VALUES FROM ('2015-02-01') TO ('2015-03-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2015_03" FOR VALUES FROM ('2015-03-01') TO ('2015-04-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2015_04" FOR VALUES FROM ('2015-04-01') TO ('2015-05-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2015_05" FOR VALUES FROM ('2015-05-01') TO ('2015-06-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2015_06" FOR VALUES FROM ('2015-06-01') TO ('2015-07-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2015_07" FOR VALUES FROM ('2015-07-01') TO ('2015-08-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2015_08" FOR VALUES FROM ('2015-08-01') TO ('2015-09-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2015_09" FOR VALUES FROM ('2015-09-01') TO ('2015-10-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2015_10" FOR VALUES FROM ('2015-10-01') TO ('2015-11-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2015_11" FOR VALUES FROM ('2015-11-01') TO ('2015-12-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2015_12" FOR VALUES FROM ('2015-12-01') TO ('2016-01-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2016_01" FOR VALUES FROM ('2016-01-01') TO ('2016-02-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2016_02" FOR VALUES FROM ('2016-02-01') TO ('2016-03-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2016_03" FOR VALUES FROM ('2016-03-01') TO ('2016-04-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2016_04" FOR VALUES FROM ('2016-04-01') TO ('2016-05-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2016_05" FOR VALUES FROM ('2016-05-01') TO ('2016-06-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2016_06" FOR VALUES FROM ('2016-06-01') TO ('2016-07-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2016_07" FOR VALUES FROM ('2016-07-01') TO ('2016-08-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2016_08" FOR VALUES FROM ('2016-08-01') TO ('2016-09-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2016_09" FOR VALUES FROM ('2016-09-01') TO ('2016-10-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2016_10" FOR VALUES FROM ('2016-10-01') TO ('2016-11-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2016_11" FOR VALUES FROM ('2016-11-01') TO ('2016-12-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2016_12" FOR VALUES FROM ('2016-12-01') TO ('2017-01-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2017_01" FOR VALUES FROM ('2017-01-01') TO ('2017-02-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2017_02" FOR VALUES FROM ('2017-02-01') TO ('2017-03-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2017_03" FOR VALUES FROM ('2017-03-01') TO ('2017-04-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2017_04" FOR VALUES FROM ('2017-04-01') TO ('2017-05-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2017_05" FOR VALUES FROM ('2017-05-01') TO ('2017-06-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2017_06" FOR VALUES FROM ('2017-06-01') TO ('2017-07-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2017_07" FOR VALUES FROM ('2017-07-01') TO ('2017-08-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2017_08" FOR VALUES FROM ('2017-08-01') TO ('2017-09-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2017_09" FOR VALUES FROM ('2017-09-01') TO ('2017-10-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2017_10" FOR VALUES FROM ('2017-10-01') TO ('2017-11-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2017_11" FOR VALUES FROM ('2017-11-01') TO ('2017-12-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2017_12" FOR VALUES FROM ('2017-12-01') TO ('2018-01-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2018_01" FOR VALUES FROM ('2018-01-01') TO ('2018-02-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2018_02" FOR VALUES FROM ('2018-02-01') TO ('2018-03-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2018_03" FOR VALUES FROM ('2018-03-01') TO ('2018-04-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2018_04" FOR VALUES FROM ('2018-04-01') TO ('2018-05-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2018_05" FOR VALUES FROM ('2018-05-01') TO ('2018-06-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2018_06" FOR VALUES FROM ('2018-06-01') TO ('2018-07-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2018_07" FOR VALUES FROM ('2018-07-01') TO ('2018-08-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2018_08" FOR VALUES FROM ('2018-08-01') TO ('2018-09-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2018_09" FOR VALUES FROM ('2018-09-01') TO ('2018-10-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2018_10" FOR VALUES FROM ('2018-10-01') TO ('2018-11-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2018_11" FOR VALUES FROM ('2018-11-01') TO ('2018-12-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2018_12" FOR VALUES FROM ('2018-12-01') TO ('2019-01-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2019_01" FOR VALUES FROM ('2019-01-01') TO ('2019-02-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2019_02" FOR VALUES FROM ('2019-02-01') TO ('2019-03-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2019_03" FOR VALUES FROM ('2019-03-01') TO ('2019-04-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2019_04" FOR VALUES FROM ('2019-04-01') TO ('2019-05-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2019_05" FOR VALUES FROM ('2019-05-01') TO ('2019-06-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2019_06" FOR VALUES FROM ('2019-06-01') TO ('2019-07-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2019_07" FOR VALUES FROM ('2019-07-01') TO ('2019-08-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2019_08" FOR VALUES FROM ('2019-08-01') TO ('2019-09-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2019_09" FOR VALUES FROM ('2019-09-01') TO ('2019-10-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2019_10" FOR VALUES FROM ('2019-10-01') TO ('2019-11-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2019_11" FOR VALUES FROM ('2019-11-01') TO ('2019-12-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2019_12" FOR VALUES FROM ('2019-12-01') TO ('2020-01-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2020_01" FOR VALUES FROM ('2020-01-01') TO ('2020-02-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2020_02" FOR VALUES FROM ('2020-02-01') TO ('2020-03-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2020_03" FOR VALUES FROM ('2020-03-01') TO ('2020-04-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2020_04" FOR VALUES FROM ('2020-04-01') TO ('2020-05-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2020_05" FOR VALUES FROM ('2020-05-01') TO ('2020-06-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2020_06" FOR VALUES FROM ('2020-06-01') TO ('2020-07-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2020_07" FOR VALUES FROM ('2020-07-01') TO ('2020-08-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2020_08" FOR VALUES FROM ('2020-08-01') TO ('2020-09-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2020_09" FOR VALUES FROM ('2020-09-01') TO ('2020-10-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2020_10" FOR VALUES FROM ('2020-10-01') TO ('2020-11-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2020_11" FOR VALUES FROM ('2020-11-01') TO ('2020-12-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2020_12" FOR VALUES FROM ('2020-12-01') TO ('2021-01-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2021_01" FOR VALUES FROM ('2021-01-01') TO ('2021-02-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2021_02" FOR VALUES FROM ('2021-02-01') TO ('2021-03-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2021_03" FOR VALUES FROM ('2021-03-01') TO ('2021-04-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2021_04" FOR VALUES FROM ('2021-04-01') TO ('2021-05-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2021_05" FOR VALUES FROM ('2021-05-01') TO ('2021-06-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2021_06" FOR VALUES FROM ('2021-06-01') TO ('2021-07-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2021_07" FOR VALUES FROM ('2021-07-01') TO ('2021-08-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2021_08" FOR VALUES FROM ('2021-08-01') TO ('2021-09-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2021_09" FOR VALUES FROM ('2021-09-01') TO ('2021-10-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2021_10" FOR VALUES FROM ('2021-10-01') TO ('2021-11-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2021_11" FOR VALUES FROM ('2021-11-01') TO ('2021-12-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2021_12" FOR VALUES FROM ('2021-12-01') TO ('2022-01-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2022_01" FOR VALUES FROM ('2022-01-01') TO ('2022-02-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2022_02" FOR VALUES FROM ('2022-02-01') TO ('2022-03-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2022_03" FOR VALUES FROM ('2022-03-01') TO ('2022-04-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2022_04" FOR VALUES FROM ('2022-04-01') TO ('2022-05-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2022_05" FOR VALUES FROM ('2022-05-01') TO ('2022-06-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2022_06" FOR VALUES FROM ('2022-06-01') TO ('2022-07-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2022_07" FOR VALUES FROM ('2022-07-01') TO ('2022-08-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2022_08" FOR VALUES FROM ('2022-08-01') TO ('2022-09-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2022_09" FOR VALUES FROM ('2022-09-01') TO ('2022-10-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2022_10" FOR VALUES FROM ('2022-10-01') TO ('2022-11-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2022_11" FOR VALUES FROM ('2022-11-01') TO ('2022-12-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2022_12" FOR VALUES FROM ('2022-12-01') TO ('2023-01-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2023_01" FOR VALUES FROM ('2023-01-01') TO ('2023-02-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2023_02" FOR VALUES FROM ('2023-02-01') TO ('2023-03-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2023_03" FOR VALUES FROM ('2023-03-01') TO ('2023-04-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2023_04" FOR VALUES FROM ('2023-04-01') TO ('2023-05-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2023_05" FOR VALUES FROM ('2023-05-01') TO ('2023-06-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2023_06" FOR VALUES FROM ('2023-06-01') TO ('2023-07-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2023_07" FOR VALUES FROM ('2023-07-01') TO ('2023-08-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2023_08" FOR VALUES FROM ('2023-08-01') TO ('2023-09-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2023_09" FOR VALUES FROM ('2023-09-01') TO ('2023-10-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2023_10" FOR VALUES FROM ('2023-10-01') TO ('2023-11-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2023_11" FOR VALUES FROM ('2023-11-01') TO ('2023-12-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2023_12" FOR VALUES FROM ('2023-12-01') TO ('2024-01-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2024_01" FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2024_02" FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2024_03" FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2024_04" FOR VALUES FROM ('2024-04-01') TO ('2024-05-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2024_05" FOR VALUES FROM ('2024-05-01') TO ('2024-06-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2024_06" FOR VALUES FROM ('2024-06-01') TO ('2024-07-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2024_07" FOR VALUES FROM ('2024-07-01') TO ('2024-08-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2024_08" FOR VALUES FROM ('2024-08-01') TO ('2024-09-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2024_09" FOR VALUES FROM ('2024-09-01') TO ('2024-10-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2024_10" FOR VALUES FROM ('2024-10-01') TO ('2024-11-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2024_11" FOR VALUES FROM ('2024-11-01') TO ('2024-12-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2024_12" FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2025_01" FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2025_02" FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2025_03" FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2025_04" FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2025_05" FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2025_06" FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2025_07" FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2025_08" FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2025_09" FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2025_10" FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2025_11" FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');



ALTER TABLE ONLY "public"."ride_data" ATTACH PARTITION "public"."ride_data_2025_12" FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');



ALTER TABLE ONLY "public"."aggregation_errors" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."aggregation_errors_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."aggregation_log" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."aggregation_log_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."aggregation_errors"
    ADD CONSTRAINT "aggregation_errors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."aggregation_log"
    ADD CONSTRAINT "aggregation_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."citi-bike-monthly"
    ADD CONSTRAINT "citi-bike-monthly_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."citi_bike_monthly_summary"
    ADD CONSTRAINT "citi_bike_monthly_summary_pkey" PRIMARY KEY ("date_month", "analysis_type", "cell_id");



ALTER TABLE ONLY "public"."processed_files"
    ADD CONSTRAINT "file_name_locale_unique" UNIQUE ("file_name", "locale");



ALTER TABLE ONLY "public"."processed_files"
    ADD CONSTRAINT "processed_files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ride_data"
    ADD CONSTRAINT "ride_data_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2013_01"
    ADD CONSTRAINT "ride_data_2013_01_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data"
    ADD CONSTRAINT "ride_data_ride_id_locale_unique" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2013_01"
    ADD CONSTRAINT "ride_data_2013_01_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2013_02"
    ADD CONSTRAINT "ride_data_2013_02_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2013_02"
    ADD CONSTRAINT "ride_data_2013_02_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2013_03"
    ADD CONSTRAINT "ride_data_2013_03_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2013_03"
    ADD CONSTRAINT "ride_data_2013_03_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2013_04"
    ADD CONSTRAINT "ride_data_2013_04_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2013_04"
    ADD CONSTRAINT "ride_data_2013_04_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2013_05"
    ADD CONSTRAINT "ride_data_2013_05_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2013_05"
    ADD CONSTRAINT "ride_data_2013_05_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2013_06"
    ADD CONSTRAINT "ride_data_2013_06_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2013_06"
    ADD CONSTRAINT "ride_data_2013_06_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2013_07"
    ADD CONSTRAINT "ride_data_2013_07_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2013_07"
    ADD CONSTRAINT "ride_data_2013_07_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2013_08"
    ADD CONSTRAINT "ride_data_2013_08_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2013_08"
    ADD CONSTRAINT "ride_data_2013_08_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2013_09"
    ADD CONSTRAINT "ride_data_2013_09_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2013_09"
    ADD CONSTRAINT "ride_data_2013_09_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2013_10"
    ADD CONSTRAINT "ride_data_2013_10_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2013_10"
    ADD CONSTRAINT "ride_data_2013_10_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2013_11"
    ADD CONSTRAINT "ride_data_2013_11_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2013_11"
    ADD CONSTRAINT "ride_data_2013_11_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2013_12"
    ADD CONSTRAINT "ride_data_2013_12_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2013_12"
    ADD CONSTRAINT "ride_data_2013_12_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2014_01"
    ADD CONSTRAINT "ride_data_2014_01_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2014_01"
    ADD CONSTRAINT "ride_data_2014_01_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2014_02"
    ADD CONSTRAINT "ride_data_2014_02_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2014_02"
    ADD CONSTRAINT "ride_data_2014_02_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2014_03"
    ADD CONSTRAINT "ride_data_2014_03_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2014_03"
    ADD CONSTRAINT "ride_data_2014_03_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2014_04"
    ADD CONSTRAINT "ride_data_2014_04_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2014_04"
    ADD CONSTRAINT "ride_data_2014_04_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2014_05"
    ADD CONSTRAINT "ride_data_2014_05_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2014_05"
    ADD CONSTRAINT "ride_data_2014_05_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2014_06"
    ADD CONSTRAINT "ride_data_2014_06_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2014_06"
    ADD CONSTRAINT "ride_data_2014_06_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2014_07"
    ADD CONSTRAINT "ride_data_2014_07_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2014_07"
    ADD CONSTRAINT "ride_data_2014_07_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2014_08"
    ADD CONSTRAINT "ride_data_2014_08_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2014_08"
    ADD CONSTRAINT "ride_data_2014_08_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2014_09"
    ADD CONSTRAINT "ride_data_2014_09_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2014_09"
    ADD CONSTRAINT "ride_data_2014_09_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2014_10"
    ADD CONSTRAINT "ride_data_2014_10_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2014_10"
    ADD CONSTRAINT "ride_data_2014_10_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2014_11"
    ADD CONSTRAINT "ride_data_2014_11_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2014_11"
    ADD CONSTRAINT "ride_data_2014_11_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2014_12"
    ADD CONSTRAINT "ride_data_2014_12_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2014_12"
    ADD CONSTRAINT "ride_data_2014_12_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2015_01"
    ADD CONSTRAINT "ride_data_2015_01_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2015_01"
    ADD CONSTRAINT "ride_data_2015_01_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2015_02"
    ADD CONSTRAINT "ride_data_2015_02_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2015_02"
    ADD CONSTRAINT "ride_data_2015_02_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2015_03"
    ADD CONSTRAINT "ride_data_2015_03_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2015_03"
    ADD CONSTRAINT "ride_data_2015_03_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2015_04"
    ADD CONSTRAINT "ride_data_2015_04_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2015_04"
    ADD CONSTRAINT "ride_data_2015_04_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2015_05"
    ADD CONSTRAINT "ride_data_2015_05_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2015_05"
    ADD CONSTRAINT "ride_data_2015_05_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2015_06"
    ADD CONSTRAINT "ride_data_2015_06_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2015_06"
    ADD CONSTRAINT "ride_data_2015_06_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2015_07"
    ADD CONSTRAINT "ride_data_2015_07_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2015_07"
    ADD CONSTRAINT "ride_data_2015_07_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2015_08"
    ADD CONSTRAINT "ride_data_2015_08_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2015_08"
    ADD CONSTRAINT "ride_data_2015_08_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2015_09"
    ADD CONSTRAINT "ride_data_2015_09_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2015_09"
    ADD CONSTRAINT "ride_data_2015_09_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2015_10"
    ADD CONSTRAINT "ride_data_2015_10_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2015_10"
    ADD CONSTRAINT "ride_data_2015_10_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2015_11"
    ADD CONSTRAINT "ride_data_2015_11_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2015_11"
    ADD CONSTRAINT "ride_data_2015_11_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2015_12"
    ADD CONSTRAINT "ride_data_2015_12_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2015_12"
    ADD CONSTRAINT "ride_data_2015_12_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2016_01"
    ADD CONSTRAINT "ride_data_2016_01_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2016_01"
    ADD CONSTRAINT "ride_data_2016_01_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2016_02"
    ADD CONSTRAINT "ride_data_2016_02_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2016_02"
    ADD CONSTRAINT "ride_data_2016_02_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2016_03"
    ADD CONSTRAINT "ride_data_2016_03_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2016_03"
    ADD CONSTRAINT "ride_data_2016_03_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2016_04"
    ADD CONSTRAINT "ride_data_2016_04_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2016_04"
    ADD CONSTRAINT "ride_data_2016_04_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2016_05"
    ADD CONSTRAINT "ride_data_2016_05_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2016_05"
    ADD CONSTRAINT "ride_data_2016_05_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2016_06"
    ADD CONSTRAINT "ride_data_2016_06_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2016_06"
    ADD CONSTRAINT "ride_data_2016_06_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2016_07"
    ADD CONSTRAINT "ride_data_2016_07_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2016_07"
    ADD CONSTRAINT "ride_data_2016_07_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2016_08"
    ADD CONSTRAINT "ride_data_2016_08_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2016_08"
    ADD CONSTRAINT "ride_data_2016_08_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2016_09"
    ADD CONSTRAINT "ride_data_2016_09_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2016_09"
    ADD CONSTRAINT "ride_data_2016_09_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2016_10"
    ADD CONSTRAINT "ride_data_2016_10_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2016_10"
    ADD CONSTRAINT "ride_data_2016_10_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2016_11"
    ADD CONSTRAINT "ride_data_2016_11_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2016_11"
    ADD CONSTRAINT "ride_data_2016_11_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2016_12"
    ADD CONSTRAINT "ride_data_2016_12_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2016_12"
    ADD CONSTRAINT "ride_data_2016_12_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2017_01"
    ADD CONSTRAINT "ride_data_2017_01_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2017_01"
    ADD CONSTRAINT "ride_data_2017_01_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2017_02"
    ADD CONSTRAINT "ride_data_2017_02_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2017_02"
    ADD CONSTRAINT "ride_data_2017_02_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2017_03"
    ADD CONSTRAINT "ride_data_2017_03_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2017_03"
    ADD CONSTRAINT "ride_data_2017_03_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2017_04"
    ADD CONSTRAINT "ride_data_2017_04_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2017_04"
    ADD CONSTRAINT "ride_data_2017_04_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2017_05"
    ADD CONSTRAINT "ride_data_2017_05_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2017_05"
    ADD CONSTRAINT "ride_data_2017_05_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2017_06"
    ADD CONSTRAINT "ride_data_2017_06_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2017_06"
    ADD CONSTRAINT "ride_data_2017_06_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2017_07"
    ADD CONSTRAINT "ride_data_2017_07_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2017_07"
    ADD CONSTRAINT "ride_data_2017_07_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2017_08"
    ADD CONSTRAINT "ride_data_2017_08_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2017_08"
    ADD CONSTRAINT "ride_data_2017_08_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2017_09"
    ADD CONSTRAINT "ride_data_2017_09_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2017_09"
    ADD CONSTRAINT "ride_data_2017_09_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2017_10"
    ADD CONSTRAINT "ride_data_2017_10_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2017_10"
    ADD CONSTRAINT "ride_data_2017_10_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2017_11"
    ADD CONSTRAINT "ride_data_2017_11_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2017_11"
    ADD CONSTRAINT "ride_data_2017_11_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2017_12"
    ADD CONSTRAINT "ride_data_2017_12_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2017_12"
    ADD CONSTRAINT "ride_data_2017_12_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2018_01"
    ADD CONSTRAINT "ride_data_2018_01_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2018_01"
    ADD CONSTRAINT "ride_data_2018_01_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2018_02"
    ADD CONSTRAINT "ride_data_2018_02_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2018_02"
    ADD CONSTRAINT "ride_data_2018_02_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2018_03"
    ADD CONSTRAINT "ride_data_2018_03_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2018_03"
    ADD CONSTRAINT "ride_data_2018_03_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2018_04"
    ADD CONSTRAINT "ride_data_2018_04_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2018_04"
    ADD CONSTRAINT "ride_data_2018_04_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2018_05"
    ADD CONSTRAINT "ride_data_2018_05_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2018_05"
    ADD CONSTRAINT "ride_data_2018_05_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2018_06"
    ADD CONSTRAINT "ride_data_2018_06_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2018_06"
    ADD CONSTRAINT "ride_data_2018_06_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2018_07"
    ADD CONSTRAINT "ride_data_2018_07_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2018_07"
    ADD CONSTRAINT "ride_data_2018_07_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2018_08"
    ADD CONSTRAINT "ride_data_2018_08_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2018_08"
    ADD CONSTRAINT "ride_data_2018_08_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2018_09"
    ADD CONSTRAINT "ride_data_2018_09_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2018_09"
    ADD CONSTRAINT "ride_data_2018_09_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2018_10"
    ADD CONSTRAINT "ride_data_2018_10_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2018_10"
    ADD CONSTRAINT "ride_data_2018_10_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2018_11"
    ADD CONSTRAINT "ride_data_2018_11_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2018_11"
    ADD CONSTRAINT "ride_data_2018_11_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2018_12"
    ADD CONSTRAINT "ride_data_2018_12_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2018_12"
    ADD CONSTRAINT "ride_data_2018_12_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2019_01"
    ADD CONSTRAINT "ride_data_2019_01_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2019_01"
    ADD CONSTRAINT "ride_data_2019_01_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2019_02"
    ADD CONSTRAINT "ride_data_2019_02_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2019_02"
    ADD CONSTRAINT "ride_data_2019_02_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2019_03"
    ADD CONSTRAINT "ride_data_2019_03_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2019_03"
    ADD CONSTRAINT "ride_data_2019_03_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2019_04"
    ADD CONSTRAINT "ride_data_2019_04_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2019_04"
    ADD CONSTRAINT "ride_data_2019_04_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2019_05"
    ADD CONSTRAINT "ride_data_2019_05_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2019_05"
    ADD CONSTRAINT "ride_data_2019_05_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2019_06"
    ADD CONSTRAINT "ride_data_2019_06_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2019_06"
    ADD CONSTRAINT "ride_data_2019_06_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2019_07"
    ADD CONSTRAINT "ride_data_2019_07_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2019_07"
    ADD CONSTRAINT "ride_data_2019_07_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2019_08"
    ADD CONSTRAINT "ride_data_2019_08_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2019_08"
    ADD CONSTRAINT "ride_data_2019_08_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2019_09"
    ADD CONSTRAINT "ride_data_2019_09_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2019_09"
    ADD CONSTRAINT "ride_data_2019_09_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2019_10"
    ADD CONSTRAINT "ride_data_2019_10_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2019_10"
    ADD CONSTRAINT "ride_data_2019_10_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2019_11"
    ADD CONSTRAINT "ride_data_2019_11_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2019_11"
    ADD CONSTRAINT "ride_data_2019_11_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2019_12"
    ADD CONSTRAINT "ride_data_2019_12_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2019_12"
    ADD CONSTRAINT "ride_data_2019_12_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2020_01"
    ADD CONSTRAINT "ride_data_2020_01_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2020_01"
    ADD CONSTRAINT "ride_data_2020_01_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2020_02"
    ADD CONSTRAINT "ride_data_2020_02_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2020_02"
    ADD CONSTRAINT "ride_data_2020_02_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2020_03"
    ADD CONSTRAINT "ride_data_2020_03_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2020_03"
    ADD CONSTRAINT "ride_data_2020_03_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2020_04"
    ADD CONSTRAINT "ride_data_2020_04_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2020_04"
    ADD CONSTRAINT "ride_data_2020_04_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2020_05"
    ADD CONSTRAINT "ride_data_2020_05_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2020_05"
    ADD CONSTRAINT "ride_data_2020_05_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2020_06"
    ADD CONSTRAINT "ride_data_2020_06_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2020_06"
    ADD CONSTRAINT "ride_data_2020_06_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2020_07"
    ADD CONSTRAINT "ride_data_2020_07_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2020_07"
    ADD CONSTRAINT "ride_data_2020_07_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2020_08"
    ADD CONSTRAINT "ride_data_2020_08_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2020_08"
    ADD CONSTRAINT "ride_data_2020_08_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2020_09"
    ADD CONSTRAINT "ride_data_2020_09_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2020_09"
    ADD CONSTRAINT "ride_data_2020_09_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2020_10"
    ADD CONSTRAINT "ride_data_2020_10_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2020_10"
    ADD CONSTRAINT "ride_data_2020_10_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2020_11"
    ADD CONSTRAINT "ride_data_2020_11_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2020_11"
    ADD CONSTRAINT "ride_data_2020_11_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2020_12"
    ADD CONSTRAINT "ride_data_2020_12_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2020_12"
    ADD CONSTRAINT "ride_data_2020_12_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2021_01"
    ADD CONSTRAINT "ride_data_2021_01_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2021_01"
    ADD CONSTRAINT "ride_data_2021_01_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2021_02"
    ADD CONSTRAINT "ride_data_2021_02_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2021_02"
    ADD CONSTRAINT "ride_data_2021_02_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2021_03"
    ADD CONSTRAINT "ride_data_2021_03_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2021_03"
    ADD CONSTRAINT "ride_data_2021_03_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2021_04"
    ADD CONSTRAINT "ride_data_2021_04_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2021_04"
    ADD CONSTRAINT "ride_data_2021_04_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2021_05"
    ADD CONSTRAINT "ride_data_2021_05_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2021_05"
    ADD CONSTRAINT "ride_data_2021_05_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2021_06"
    ADD CONSTRAINT "ride_data_2021_06_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2021_06"
    ADD CONSTRAINT "ride_data_2021_06_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2021_07"
    ADD CONSTRAINT "ride_data_2021_07_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2021_07"
    ADD CONSTRAINT "ride_data_2021_07_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2021_08"
    ADD CONSTRAINT "ride_data_2021_08_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2021_08"
    ADD CONSTRAINT "ride_data_2021_08_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2021_09"
    ADD CONSTRAINT "ride_data_2021_09_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2021_09"
    ADD CONSTRAINT "ride_data_2021_09_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2021_10"
    ADD CONSTRAINT "ride_data_2021_10_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2021_10"
    ADD CONSTRAINT "ride_data_2021_10_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2021_11"
    ADD CONSTRAINT "ride_data_2021_11_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2021_11"
    ADD CONSTRAINT "ride_data_2021_11_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2021_12"
    ADD CONSTRAINT "ride_data_2021_12_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2021_12"
    ADD CONSTRAINT "ride_data_2021_12_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2022_01"
    ADD CONSTRAINT "ride_data_2022_01_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2022_01"
    ADD CONSTRAINT "ride_data_2022_01_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2022_02"
    ADD CONSTRAINT "ride_data_2022_02_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2022_02"
    ADD CONSTRAINT "ride_data_2022_02_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2022_03"
    ADD CONSTRAINT "ride_data_2022_03_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2022_03"
    ADD CONSTRAINT "ride_data_2022_03_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2022_04"
    ADD CONSTRAINT "ride_data_2022_04_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2022_04"
    ADD CONSTRAINT "ride_data_2022_04_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2022_05"
    ADD CONSTRAINT "ride_data_2022_05_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2022_05"
    ADD CONSTRAINT "ride_data_2022_05_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2022_06"
    ADD CONSTRAINT "ride_data_2022_06_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2022_06"
    ADD CONSTRAINT "ride_data_2022_06_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2022_07"
    ADD CONSTRAINT "ride_data_2022_07_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2022_07"
    ADD CONSTRAINT "ride_data_2022_07_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2022_08"
    ADD CONSTRAINT "ride_data_2022_08_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2022_08"
    ADD CONSTRAINT "ride_data_2022_08_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2022_09"
    ADD CONSTRAINT "ride_data_2022_09_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2022_09"
    ADD CONSTRAINT "ride_data_2022_09_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2022_10"
    ADD CONSTRAINT "ride_data_2022_10_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2022_10"
    ADD CONSTRAINT "ride_data_2022_10_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2022_11"
    ADD CONSTRAINT "ride_data_2022_11_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2022_11"
    ADD CONSTRAINT "ride_data_2022_11_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2022_12"
    ADD CONSTRAINT "ride_data_2022_12_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2022_12"
    ADD CONSTRAINT "ride_data_2022_12_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2023_01"
    ADD CONSTRAINT "ride_data_2023_01_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2023_01"
    ADD CONSTRAINT "ride_data_2023_01_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2023_02"
    ADD CONSTRAINT "ride_data_2023_02_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2023_02"
    ADD CONSTRAINT "ride_data_2023_02_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2023_03"
    ADD CONSTRAINT "ride_data_2023_03_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2023_03"
    ADD CONSTRAINT "ride_data_2023_03_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2023_04"
    ADD CONSTRAINT "ride_data_2023_04_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2023_04"
    ADD CONSTRAINT "ride_data_2023_04_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2023_05"
    ADD CONSTRAINT "ride_data_2023_05_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2023_05"
    ADD CONSTRAINT "ride_data_2023_05_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2023_06"
    ADD CONSTRAINT "ride_data_2023_06_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2023_06"
    ADD CONSTRAINT "ride_data_2023_06_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2023_07"
    ADD CONSTRAINT "ride_data_2023_07_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2023_07"
    ADD CONSTRAINT "ride_data_2023_07_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2023_08"
    ADD CONSTRAINT "ride_data_2023_08_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2023_08"
    ADD CONSTRAINT "ride_data_2023_08_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2023_09"
    ADD CONSTRAINT "ride_data_2023_09_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2023_09"
    ADD CONSTRAINT "ride_data_2023_09_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2023_10"
    ADD CONSTRAINT "ride_data_2023_10_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2023_10"
    ADD CONSTRAINT "ride_data_2023_10_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2023_11"
    ADD CONSTRAINT "ride_data_2023_11_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2023_11"
    ADD CONSTRAINT "ride_data_2023_11_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2023_12"
    ADD CONSTRAINT "ride_data_2023_12_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2023_12"
    ADD CONSTRAINT "ride_data_2023_12_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2024_01"
    ADD CONSTRAINT "ride_data_2024_01_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2024_01"
    ADD CONSTRAINT "ride_data_2024_01_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2024_02"
    ADD CONSTRAINT "ride_data_2024_02_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2024_02"
    ADD CONSTRAINT "ride_data_2024_02_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2024_03"
    ADD CONSTRAINT "ride_data_2024_03_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2024_03"
    ADD CONSTRAINT "ride_data_2024_03_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2024_04"
    ADD CONSTRAINT "ride_data_2024_04_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2024_04"
    ADD CONSTRAINT "ride_data_2024_04_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2024_05"
    ADD CONSTRAINT "ride_data_2024_05_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2024_05"
    ADD CONSTRAINT "ride_data_2024_05_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2024_06"
    ADD CONSTRAINT "ride_data_2024_06_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2024_06"
    ADD CONSTRAINT "ride_data_2024_06_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2024_07"
    ADD CONSTRAINT "ride_data_2024_07_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2024_07"
    ADD CONSTRAINT "ride_data_2024_07_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2024_08"
    ADD CONSTRAINT "ride_data_2024_08_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2024_08"
    ADD CONSTRAINT "ride_data_2024_08_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2024_09"
    ADD CONSTRAINT "ride_data_2024_09_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2024_09"
    ADD CONSTRAINT "ride_data_2024_09_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2024_10"
    ADD CONSTRAINT "ride_data_2024_10_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2024_10"
    ADD CONSTRAINT "ride_data_2024_10_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2024_11"
    ADD CONSTRAINT "ride_data_2024_11_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2024_11"
    ADD CONSTRAINT "ride_data_2024_11_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2024_12"
    ADD CONSTRAINT "ride_data_2024_12_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2024_12"
    ADD CONSTRAINT "ride_data_2024_12_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2025_01"
    ADD CONSTRAINT "ride_data_2025_01_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2025_01"
    ADD CONSTRAINT "ride_data_2025_01_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2025_02"
    ADD CONSTRAINT "ride_data_2025_02_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2025_02"
    ADD CONSTRAINT "ride_data_2025_02_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2025_03"
    ADD CONSTRAINT "ride_data_2025_03_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2025_03"
    ADD CONSTRAINT "ride_data_2025_03_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2025_04"
    ADD CONSTRAINT "ride_data_2025_04_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2025_04"
    ADD CONSTRAINT "ride_data_2025_04_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2025_05"
    ADD CONSTRAINT "ride_data_2025_05_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2025_05"
    ADD CONSTRAINT "ride_data_2025_05_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2025_06"
    ADD CONSTRAINT "ride_data_2025_06_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2025_06"
    ADD CONSTRAINT "ride_data_2025_06_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2025_07"
    ADD CONSTRAINT "ride_data_2025_07_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2025_07"
    ADD CONSTRAINT "ride_data_2025_07_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2025_08"
    ADD CONSTRAINT "ride_data_2025_08_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2025_08"
    ADD CONSTRAINT "ride_data_2025_08_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2025_09"
    ADD CONSTRAINT "ride_data_2025_09_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2025_09"
    ADD CONSTRAINT "ride_data_2025_09_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2025_10"
    ADD CONSTRAINT "ride_data_2025_10_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2025_10"
    ADD CONSTRAINT "ride_data_2025_10_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2025_11"
    ADD CONSTRAINT "ride_data_2025_11_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2025_11"
    ADD CONSTRAINT "ride_data_2025_11_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."ride_data_2025_12"
    ADD CONSTRAINT "ride_data_2025_12_pkey" PRIMARY KEY ("id", "start_date");



ALTER TABLE ONLY "public"."ride_data_2025_12"
    ADD CONSTRAINT "ride_data_2025_12_ride_id_locale_start_date_key" UNIQUE ("ride_id", "locale", "start_date");



ALTER TABLE ONLY "public"."citi-bike-monthly"
    ADD CONSTRAINT "unique_by_month" UNIQUE ("h3_cell_start", "h3_cell_end", "date_month");



CREATE INDEX "idx_citi_bike_date_end" ON "public"."citi-bike-monthly" USING "btree" ("date_month", "h3_cell_end") INCLUDE ("count");



CREATE INDEX "idx_citi_bike_date_start" ON "public"."citi-bike-monthly" USING "btree" ("date_month", "h3_cell_start") INCLUDE ("count");



CREATE INDEX "idx_citi_bike_end_cell_date" ON "public"."citi-bike-monthly" USING "btree" ("h3_cell_end", "date_month") INCLUDE ("h3_cell_start", "count");



CREATE INDEX "idx_citi_bike_monthly_date_cells" ON "public"."citi-bike-monthly" USING "btree" ("date_month", "h3_cell_start", "h3_cell_end");



CREATE INDEX "idx_citi_bike_start_cell_date" ON "public"."citi-bike-monthly" USING "btree" ("h3_cell_start", "date_month") INCLUDE ("h3_cell_end", "count");



CREATE INDEX "idx_summary_lookup" ON "public"."citi_bike_monthly_summary" USING "btree" ("date_month", "analysis_type");



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2013_01_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2013_01_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2013_02_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2013_02_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2013_03_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2013_03_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2013_04_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2013_04_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2013_05_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2013_05_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2013_06_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2013_06_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2013_07_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2013_07_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2013_08_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2013_08_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2013_09_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2013_09_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2013_10_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2013_10_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2013_11_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2013_11_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2013_12_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2013_12_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2014_01_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2014_01_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2014_02_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2014_02_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2014_03_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2014_03_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2014_04_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2014_04_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2014_05_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2014_05_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2014_06_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2014_06_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2014_07_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2014_07_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2014_08_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2014_08_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2014_09_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2014_09_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2014_10_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2014_10_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2014_11_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2014_11_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2014_12_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2014_12_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2015_01_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2015_01_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2015_02_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2015_02_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2015_03_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2015_03_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2015_04_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2015_04_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2015_05_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2015_05_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2015_06_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2015_06_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2015_07_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2015_07_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2015_08_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2015_08_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2015_09_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2015_09_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2015_10_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2015_10_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2015_11_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2015_11_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2015_12_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2015_12_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2016_01_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2016_01_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2016_02_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2016_02_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2016_03_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2016_03_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2016_04_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2016_04_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2016_05_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2016_05_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2016_06_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2016_06_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2016_07_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2016_07_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2016_08_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2016_08_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2016_09_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2016_09_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2016_10_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2016_10_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2016_11_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2016_11_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2016_12_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2016_12_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2017_01_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2017_01_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2017_02_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2017_02_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2017_03_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2017_03_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2017_04_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2017_04_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2017_05_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2017_05_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2017_06_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2017_06_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2017_07_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2017_07_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2017_08_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2017_08_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2017_09_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2017_09_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2017_10_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2017_10_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2017_11_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2017_11_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2017_12_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2017_12_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2018_01_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2018_01_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2018_02_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2018_02_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2018_03_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2018_03_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2018_04_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2018_04_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2018_05_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2018_05_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2018_06_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2018_06_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2018_07_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2018_07_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2018_08_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2018_08_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2018_09_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2018_09_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2018_10_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2018_10_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2018_11_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2018_11_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2018_12_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2018_12_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2019_01_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2019_01_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2019_02_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2019_02_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2019_03_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2019_03_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2019_04_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2019_04_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2019_05_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2019_05_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2019_06_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2019_06_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2019_07_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2019_07_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2019_08_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2019_08_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2019_09_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2019_09_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2019_10_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2019_10_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2019_11_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2019_11_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2019_12_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2019_12_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2020_01_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2020_01_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2020_02_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2020_02_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2020_03_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2020_03_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2020_04_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2020_04_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2020_05_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2020_05_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2020_06_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2020_06_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2020_07_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2020_07_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2020_08_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2020_08_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2020_09_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2020_09_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2020_10_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2020_10_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2020_11_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2020_11_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2020_12_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2020_12_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2021_01_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2021_01_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2021_02_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2021_02_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2021_03_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2021_03_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2021_04_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2021_04_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2021_05_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2021_05_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2021_06_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2021_06_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2021_07_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2021_07_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2021_08_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2021_08_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2021_09_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2021_09_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2021_10_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2021_10_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2021_11_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2021_11_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2021_12_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2021_12_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2022_01_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2022_01_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2022_02_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2022_02_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2022_03_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2022_03_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2022_04_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2022_04_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2022_05_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2022_05_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2022_06_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2022_06_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2022_07_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2022_07_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2022_08_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2022_08_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2022_09_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2022_09_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2022_10_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2022_10_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2022_11_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2022_11_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2022_12_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2022_12_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2023_01_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2023_01_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2023_02_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2023_02_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2023_03_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2023_03_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2023_04_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2023_04_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2023_05_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2023_05_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2023_06_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2023_06_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2023_07_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2023_07_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2023_08_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2023_08_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2023_09_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2023_09_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2023_10_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2023_10_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2023_11_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2023_11_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2023_12_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2023_12_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2024_01_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2024_01_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2024_02_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2024_02_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2024_03_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2024_03_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2024_04_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2024_04_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2024_05_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2024_05_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2024_06_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2024_06_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2024_07_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2024_07_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2024_08_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2024_08_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2024_09_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2024_09_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2024_10_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2024_10_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2024_11_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2024_11_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2024_12_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2024_12_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2025_01_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2025_01_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2025_02_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2025_02_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2025_03_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2025_03_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2025_04_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2025_04_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2025_05_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2025_05_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2025_06_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2025_06_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2025_07_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2025_07_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2025_08_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2025_08_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2025_09_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2025_09_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2025_10_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2025_10_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2025_11_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2025_11_ride_id_locale_start_date_key";



ALTER INDEX "public"."ride_data_pkey" ATTACH PARTITION "public"."ride_data_2025_12_pkey";



ALTER INDEX "public"."ride_data_ride_id_locale_unique" ATTACH PARTITION "public"."ride_data_2025_12_ride_id_locale_start_date_key";



CREATE POLICY "Enable insert for anon users" ON "public"."citi-bike-monthly" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "Enable read access for all users" ON "public"."processed_files" USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."ride_data" TO "anon" USING (true);



ALTER TABLE "public"."citi-bike-monthly" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."citi_bike_monthly_summary" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."processed_files" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2013_01" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2013_02" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2013_03" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2013_04" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2013_05" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2013_06" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2013_07" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2013_08" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2013_09" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2013_10" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2013_11" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2013_12" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2014_01" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2014_02" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2014_03" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2014_04" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2014_05" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2014_06" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2014_07" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2014_08" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2014_09" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2014_10" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2014_11" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2014_12" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2015_01" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2015_02" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2015_03" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2015_04" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2015_05" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2015_06" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2015_07" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2015_08" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2015_09" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2015_10" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2015_11" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2015_12" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2016_01" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2016_02" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2016_03" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2016_04" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2016_05" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2016_06" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2016_07" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2016_08" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2016_09" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2016_10" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2016_11" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2016_12" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2017_01" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2017_02" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2017_03" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2017_04" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2017_05" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2017_06" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2017_07" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2017_08" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2017_09" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2017_10" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2017_11" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2017_12" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2018_01" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2018_02" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2018_03" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2018_04" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2018_05" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2018_06" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2018_07" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2018_08" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2018_09" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2018_10" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2018_11" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2018_12" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2019_01" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2019_02" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2019_03" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2019_04" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2019_05" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2019_06" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2019_07" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2019_08" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2019_09" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2019_10" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2019_11" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2019_12" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2020_01" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2020_02" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2020_03" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2020_04" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2020_05" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2020_06" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2020_07" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2020_08" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2020_09" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2020_10" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2020_11" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2020_12" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2021_01" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2021_02" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2021_03" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2021_04" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2021_05" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2021_06" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2021_07" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2021_08" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2021_09" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2021_10" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2021_11" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2021_12" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2022_01" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2022_02" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2022_03" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2022_04" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2022_05" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2022_06" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2022_07" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2022_08" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2022_09" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2022_10" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2022_11" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2022_12" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2023_01" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2023_02" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2023_03" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2023_04" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2023_05" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2023_06" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2023_07" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2023_08" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2023_09" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2023_10" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2023_11" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2023_12" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2024_01" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2024_02" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2024_03" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2024_04" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2024_05" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2024_06" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2024_07" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2024_08" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2024_09" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2024_10" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2024_11" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2024_12" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2025_01" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2025_02" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2025_03" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2025_04" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2025_05" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2025_06" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2025_07" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2025_08" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2025_09" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2025_10" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2025_11" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_data_2025_12" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "select anon" ON "public"."citi-bike-monthly" FOR SELECT TO "anon" USING (true);





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";














































































































































































GRANT ALL ON FUNCTION "public"."add_monthly_partition_ride_data"("partition_year" integer, "partition_month" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."add_monthly_partition_ride_data"("partition_year" integer, "partition_month" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_monthly_partition_ride_data"("partition_year" integer, "partition_month" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."aggregate_citi_bike_monthly"("target_year" integer, "target_month" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."aggregate_citi_bike_monthly"("target_year" integer, "target_month" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."aggregate_citi_bike_monthly"("target_year" integer, "target_month" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."aggregate_monthly_ride_data"("target_month" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."aggregate_monthly_ride_data"("target_month" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."aggregate_monthly_ride_data"("target_month" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."analyze_trip_flows_v2"("analysis_type" "text", "target_month" "date", "reference_cell_ids" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."analyze_trip_flows_v2"("analysis_type" "text", "target_month" "date", "reference_cell_ids" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."analyze_trip_flows_v2"("analysis_type" "text", "target_month" "date", "reference_cell_ids" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."analyze_trip_flows_v3"("target_month" "date", "reference_cell_ids" "text"[], "analysis_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."analyze_trip_flows_v3"("target_month" "date", "reference_cell_ids" "text"[], "analysis_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."analyze_trip_flows_v3"("target_month" "date", "reference_cell_ids" "text"[], "analysis_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_destinations_from_start_cells"("target_month" "date", "start_cell_ids" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_destinations_from_start_cells"("target_month" "date", "start_cell_ids" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_destinations_from_start_cells"("target_month" "date", "start_cell_ids" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_h3_cell_monthly_counts"("p_h3_cells" character varying[], "p_start_month" "date", "p_end_month" "date", "p_cell_type" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."get_h3_cell_monthly_counts"("p_h3_cells" character varying[], "p_start_month" "date", "p_end_month" "date", "p_cell_type" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_h3_cell_monthly_counts"("p_h3_cells" character varying[], "p_start_month" "date", "p_end_month" "date", "p_cell_type" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_h3_counts_by_cells"("target_month" "date", "cell_ids" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_h3_counts_by_cells"("target_month" "date", "cell_ids" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_h3_counts_by_cells"("target_month" "date", "cell_ids" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_monthly_h3_counts"("target_month" "date", "result_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_monthly_h3_counts"("target_month" "date", "result_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_monthly_h3_counts"("target_month" "date", "result_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_monthly_totals"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_monthly_totals"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_monthly_totals"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_trip_analysis_range"("analysis_type" "text", "start_month" "date", "end_month" "date", "reference_cell_ids" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_trip_analysis_range"("analysis_type" "text", "start_month" "date", "end_month" "date", "reference_cell_ids" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_trip_analysis_range"("analysis_type" "text", "start_month" "date", "end_month" "date", "reference_cell_ids" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."monthly_agg"("p_origin_cells" "text"[], "p_destination_cells" "text"[], "p_year" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."monthly_agg"("p_origin_cells" "text"[], "p_destination_cells" "text"[], "p_year" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."monthly_agg"("p_origin_cells" "text"[], "p_destination_cells" "text"[], "p_year" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."monthly_agg_v2"("p_year" integer, "p_origin_cells" "text"[], "p_destination_cells" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."monthly_agg_v2"("p_year" integer, "p_origin_cells" "text"[], "p_destination_cells" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."monthly_agg_v2"("p_year" integer, "p_origin_cells" "text"[], "p_destination_cells" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."pg_buffercache_evict"(integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."pg_buffercache_evict"(integer) TO "anon";
GRANT ALL ON FUNCTION "public"."pg_buffercache_evict"(integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."pg_buffercache_evict"(integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."process_date_range"("start_date" "date", "end_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."process_date_range"("start_date" "date", "end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_date_range"("start_date" "date", "end_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."process_historical_partitions"() TO "anon";
GRANT ALL ON FUNCTION "public"."process_historical_partitions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_historical_partitions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."process_recent_partitions"() TO "anon";
GRANT ALL ON FUNCTION "public"."process_recent_partitions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_recent_partitions"() TO "service_role";
























GRANT ALL ON TABLE "public"."aggregation_errors" TO "anon";
GRANT ALL ON TABLE "public"."aggregation_errors" TO "authenticated";
GRANT ALL ON TABLE "public"."aggregation_errors" TO "service_role";



GRANT ALL ON SEQUENCE "public"."aggregation_errors_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."aggregation_errors_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."aggregation_errors_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."aggregation_log" TO "anon";
GRANT ALL ON TABLE "public"."aggregation_log" TO "authenticated";
GRANT ALL ON TABLE "public"."aggregation_log" TO "service_role";



GRANT ALL ON SEQUENCE "public"."aggregation_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."aggregation_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."aggregation_log_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."citi-bike-monthly" TO "anon";
GRANT ALL ON TABLE "public"."citi-bike-monthly" TO "authenticated";
GRANT ALL ON TABLE "public"."citi-bike-monthly" TO "service_role";



GRANT ALL ON SEQUENCE "public"."citi-bike-monthly_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."citi-bike-monthly_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."citi-bike-monthly_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."citi_bike_monthly_summary" TO "anon";
GRANT ALL ON TABLE "public"."citi_bike_monthly_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."citi_bike_monthly_summary" TO "service_role";



GRANT ALL ON TABLE "public"."monthly_totals" TO "anon";
GRANT ALL ON TABLE "public"."monthly_totals" TO "authenticated";
GRANT ALL ON TABLE "public"."monthly_totals" TO "service_role";



GRANT ALL ON TABLE "public"."processed_files" TO "anon";
GRANT ALL ON TABLE "public"."processed_files" TO "authenticated";
GRANT ALL ON TABLE "public"."processed_files" TO "service_role";



GRANT ALL ON SEQUENCE "public"."processed_files_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."processed_files_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."processed_files_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data" TO "anon";
GRANT ALL ON TABLE "public"."ride_data" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2013_01" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2013_01" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2013_01" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2013_02" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2013_02" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2013_02" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2013_03" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2013_03" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2013_03" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2013_04" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2013_04" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2013_04" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2013_05" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2013_05" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2013_05" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2013_06" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2013_06" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2013_06" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2013_07" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2013_07" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2013_07" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2013_08" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2013_08" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2013_08" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2013_09" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2013_09" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2013_09" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2013_10" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2013_10" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2013_10" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2013_11" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2013_11" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2013_11" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2013_12" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2013_12" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2013_12" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2014_01" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2014_01" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2014_01" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2014_02" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2014_02" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2014_02" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2014_03" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2014_03" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2014_03" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2014_04" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2014_04" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2014_04" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2014_05" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2014_05" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2014_05" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2014_06" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2014_06" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2014_06" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2014_07" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2014_07" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2014_07" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2014_08" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2014_08" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2014_08" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2014_09" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2014_09" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2014_09" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2014_10" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2014_10" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2014_10" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2014_11" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2014_11" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2014_11" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2014_12" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2014_12" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2014_12" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2015_01" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2015_01" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2015_01" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2015_02" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2015_02" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2015_02" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2015_03" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2015_03" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2015_03" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2015_04" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2015_04" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2015_04" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2015_05" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2015_05" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2015_05" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2015_06" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2015_06" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2015_06" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2015_07" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2015_07" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2015_07" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2015_08" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2015_08" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2015_08" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2015_09" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2015_09" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2015_09" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2015_10" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2015_10" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2015_10" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2015_11" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2015_11" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2015_11" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2015_12" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2015_12" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2015_12" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2016_01" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2016_01" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2016_01" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2016_02" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2016_02" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2016_02" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2016_03" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2016_03" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2016_03" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2016_04" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2016_04" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2016_04" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2016_05" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2016_05" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2016_05" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2016_06" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2016_06" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2016_06" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2016_07" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2016_07" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2016_07" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2016_08" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2016_08" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2016_08" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2016_09" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2016_09" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2016_09" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2016_10" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2016_10" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2016_10" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2016_11" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2016_11" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2016_11" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2016_12" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2016_12" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2016_12" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2017_01" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2017_01" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2017_01" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2017_02" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2017_02" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2017_02" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2017_03" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2017_03" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2017_03" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2017_04" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2017_04" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2017_04" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2017_05" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2017_05" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2017_05" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2017_06" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2017_06" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2017_06" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2017_07" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2017_07" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2017_07" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2017_08" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2017_08" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2017_08" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2017_09" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2017_09" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2017_09" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2017_10" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2017_10" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2017_10" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2017_11" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2017_11" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2017_11" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2017_12" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2017_12" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2017_12" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2018_01" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2018_01" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2018_01" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2018_02" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2018_02" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2018_02" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2018_03" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2018_03" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2018_03" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2018_04" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2018_04" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2018_04" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2018_05" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2018_05" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2018_05" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2018_06" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2018_06" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2018_06" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2018_07" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2018_07" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2018_07" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2018_08" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2018_08" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2018_08" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2018_09" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2018_09" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2018_09" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2018_10" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2018_10" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2018_10" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2018_11" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2018_11" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2018_11" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2018_12" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2018_12" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2018_12" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2019_01" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2019_01" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2019_01" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2019_02" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2019_02" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2019_02" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2019_03" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2019_03" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2019_03" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2019_04" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2019_04" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2019_04" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2019_05" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2019_05" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2019_05" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2019_06" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2019_06" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2019_06" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2019_07" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2019_07" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2019_07" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2019_08" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2019_08" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2019_08" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2019_09" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2019_09" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2019_09" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2019_10" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2019_10" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2019_10" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2019_11" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2019_11" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2019_11" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2019_12" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2019_12" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2019_12" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2020_01" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2020_01" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2020_01" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2020_02" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2020_02" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2020_02" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2020_03" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2020_03" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2020_03" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2020_04" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2020_04" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2020_04" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2020_05" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2020_05" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2020_05" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2020_06" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2020_06" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2020_06" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2020_07" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2020_07" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2020_07" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2020_08" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2020_08" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2020_08" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2020_09" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2020_09" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2020_09" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2020_10" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2020_10" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2020_10" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2020_11" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2020_11" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2020_11" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2020_12" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2020_12" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2020_12" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2021_01" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2021_01" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2021_01" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2021_02" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2021_02" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2021_02" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2021_03" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2021_03" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2021_03" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2021_04" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2021_04" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2021_04" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2021_05" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2021_05" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2021_05" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2021_06" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2021_06" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2021_06" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2021_07" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2021_07" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2021_07" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2021_08" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2021_08" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2021_08" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2021_09" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2021_09" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2021_09" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2021_10" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2021_10" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2021_10" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2021_11" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2021_11" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2021_11" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2021_12" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2021_12" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2021_12" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2022_01" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2022_01" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2022_01" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2022_02" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2022_02" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2022_02" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2022_03" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2022_03" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2022_03" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2022_04" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2022_04" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2022_04" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2022_05" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2022_05" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2022_05" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2022_06" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2022_06" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2022_06" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2022_07" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2022_07" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2022_07" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2022_08" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2022_08" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2022_08" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2022_09" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2022_09" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2022_09" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2022_10" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2022_10" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2022_10" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2022_11" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2022_11" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2022_11" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2022_12" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2022_12" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2022_12" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2023_01" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2023_01" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2023_01" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2023_02" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2023_02" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2023_02" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2023_03" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2023_03" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2023_03" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2023_04" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2023_04" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2023_04" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2023_05" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2023_05" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2023_05" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2023_06" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2023_06" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2023_06" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2023_07" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2023_07" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2023_07" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2023_08" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2023_08" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2023_08" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2023_09" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2023_09" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2023_09" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2023_10" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2023_10" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2023_10" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2023_11" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2023_11" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2023_11" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2023_12" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2023_12" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2023_12" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2024_01" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2024_01" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2024_01" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2024_02" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2024_02" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2024_02" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2024_03" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2024_03" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2024_03" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2024_04" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2024_04" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2024_04" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2024_05" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2024_05" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2024_05" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2024_06" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2024_06" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2024_06" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2024_07" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2024_07" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2024_07" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2024_08" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2024_08" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2024_08" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2024_09" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2024_09" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2024_09" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2024_10" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2024_10" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2024_10" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2024_11" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2024_11" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2024_11" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2024_12" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2024_12" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2024_12" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2025_01" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2025_01" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2025_01" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2025_02" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2025_02" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2025_02" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2025_03" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2025_03" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2025_03" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2025_04" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2025_04" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2025_04" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2025_05" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2025_05" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2025_05" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2025_06" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2025_06" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2025_06" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2025_07" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2025_07" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2025_07" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2025_08" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2025_08" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2025_08" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2025_09" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2025_09" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2025_09" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2025_10" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2025_10" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2025_10" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2025_11" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2025_11" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2025_11" TO "service_role";



GRANT ALL ON TABLE "public"."ride_data_2025_12" TO "anon";
GRANT ALL ON TABLE "public"."ride_data_2025_12" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_data_2025_12" TO "service_role";



GRANT ALL ON SEQUENCE "public"."ride_data_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ride_data_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ride_data_id_seq" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























drop extension if exists "pg_net";


  create policy "Give anon users ability to upload to bucket cygtkj_0"
  on "storage"."objects"
  as permissive
  for insert
  to anon
with check (((bucket_id = 'citi-bike-data-bucket'::text) AND (auth.role() = 'anon'::text)));



