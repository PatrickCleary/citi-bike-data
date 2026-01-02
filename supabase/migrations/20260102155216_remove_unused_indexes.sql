-- Remove unused indexes from citi-bike-monthly table

DROP INDEX IF EXISTS public.idx_citi_bike_date_end;
DROP INDEX IF EXISTS public.idx_citi_bike_date_start;
