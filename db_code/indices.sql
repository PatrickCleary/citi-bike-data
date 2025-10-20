-- Index 1: For arrivals analysis WITH cell filter
CREATE INDEX idx_citi_bike_start_cell_date 
ON "citi-bike-monthly"(h3_cell_start, date_month) 
INCLUDE (h3_cell_end, count);

-- Index 2: For departures analysis WITH cell filter
CREATE INDEX idx_citi_bike_end_cell_date 
ON "citi-bike-monthly"(h3_cell_end, date_month) 
INCLUDE (h3_cell_start, count); 
-- Index 3: For arrivals with NO cell filter (default view)
CREATE INDEX idx_citi_bike_date_end
ON "citi-bike-monthly"(date_month, h3_cell_end)
INCLUDE (count);

-- Index 4: For departures with NO cell filter (default view)
CREATE INDEX idx_citi_bike_date_start
ON "citi-bike-monthly"(date_month, h3_cell_start)
INCLUDE (count);
