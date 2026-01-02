-- Add cron jobs for data processing

-- Unschedule existing jobs if they exist (to avoid conflicts)
SELECT cron.unschedule('daily-recent-aggregation') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'daily-recent-aggregation'
);

SELECT cron.unschedule('monthly-historical-aggregation') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'monthly-historical-aggregation'
);

-- Daily aggregation of recent partitions (runs at 2:00 AM daily)
SELECT cron.schedule(
    'daily-recent-aggregation',
    '0 2 * * *',
    'SELECT process_recent_partitions();'
);

-- Monthly aggregation of historical partitions (runs at 3:00 AM on the 1st of each month)
SELECT cron.schedule(
    'monthly-historical-aggregation',
    '0 3 1 * *',
    'SELECT process_historical_partitions();'
);
