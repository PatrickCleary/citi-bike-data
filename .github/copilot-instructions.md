# Citi Bike Data Analysis Platform - AI Agent Instructions

## Project Architecture Overview

This is a full-stack geospatial data analysis platform that visualizes Citi Bike trip patterns using H3 hexagonal binning. The architecture consists of:

- **Data Ingestion Pipeline** (`ingestion/`): Python scripts that fetch, process, and transform CSV trip data from S3 into H3-indexed PostgreSQL tables
- **Database Layer** (`db_code/`, `supabase/`): PostgreSQL with PostGIS/H3 extensions, optimized with materialized views for fast geospatial queries
- **Frontend** (`frontend-citi-bike-data/`): Next.js 15 + MapLibre GL + PMTiles for interactive hexagonal heatmap visualization
- **Local Data Cache** (`local-s3-bucket/`): Development CSV files for testing pipeline components

## Critical Data Flow & H3 Integration

The core data transformation uses **H3 hexagonal indexing at resolution 9** for spatial aggregation:

1. Raw CSV trip data → H3 cell IDs via `geo_helpers.py:apply_h3_latlng_to_cell()`
2. Monthly aggregation into `citi-bike-monthly` table (h3_cell_start, h3_cell_end, count)
3. Materialized views (`monthly_arrivals`, `monthly_departures`) for fast query performance

**Key Pattern**: H3 cells are the primary spatial index - all coordinate operations should use H3 library functions, not raw lat/lng.

## Development Workflows

### Data Pipeline (Manual Process)

```bash
cd ingestion/
pyenv activate citibike  # Python venv with pandas, h3, psycopg2
python run_file_fetch.py  # Downloads new CSV files from S3
python processor.py new_files.csv  # Processes CSVs → PostgreSQL
```

Post-processing requires running SQL functions in database:

```sql
SET statement_timeout = 0;
SELECT * FROM process_date_range('2024-01-01', '2024-01-31');
REFRESH MATERIALIZED VIEW public.monthly_totals;
```

### Frontend Development

```bash
cd frontend-citi-bike-data/
npm run dev  # Next.js with turbo, runs on :3000
```

## State Management Patterns

**Zustand stores** handle complex map state synchronization:

- `useMapConfigStore`: Selected month, scale type, chart visibility, map bounds
- `useMetricsStore`: Performance metrics and loading states
- `useIntroModalStore`: UI modal state

**React Query** manages server state with 24-hour caching for trip data endpoints.

**Custom hooks** encapsulate MapLibre interactions:

- Map layer updates: `useApplyLayers`, `useUpdateOriginShape`
- Data synchronization: `useSync` coordinates store state → map rendering
- Location services: `useLocationMarker` with geolocation API

## Database Schema Patterns

Tables follow **temporal partitioning by month** with optimized indexing:

```sql
-- Core fact table with composite indexes
citi-bike-monthly (h3_cell_start, h3_cell_end, date_month, count)

-- Materialized views for sub-second query performance
monthly_arrivals, monthly_departures (cell_id, date_month, total_count)
```

Functions return **JSON aggregates** to minimize database round trips:

- Use `json_object_agg()` for efficient key-value serialization

## Map Rendering Architecture

**PMTiles + MapLibre GL** for vector tile performance:

- Hexagon geometries stored as `.pmtiles` files (generated via tippecanoe)
- Trip counts joined at runtime via `addLayer()` paint expressions
- Dynamic styling based on scale type (linear/log) from Zustand store

**Layer management pattern**:

```typescript
map.addSource("hexagons", { type: "vector", url: "pmtiles://hex.pmtiles" });
map.addLayer({
  id: "hex-fill",
  source: "hexagons",
  paint: {
    "fill-color": [
      "interpolate",
      ["linear"],
      ["get", "count"] /* color stops */,
    ],
  },
});
```

## File Naming Conventions

- Database: `snake_case` for tables/functions (`monthly_totals`, `get_trip_flows`)
- Frontend: `kebab-case` for files (`map-page.tsx`, `date-control.tsx`)
- Python: `snake_case` throughout (`file_helpers.py`, `process_files_df()`)

## Environment Dependencies

- **Python**: Requires `h3`, `pandas`, `psycopg2-binary`, `supabase` for data pipeline
- **Database**: PostgreSQL with `pg_cron`, PostGIS, H3 extensions enabled
- **Frontend**: Next.js 15, MapLibre GL, `h3-js` for client-side hexagon operations

## Performance Considerations

- **Materialized views are critical** - refresh after data updates via `REFRESH MATERIALIZED VIEW`
- **H3 resolution 9** balances visualization detail vs query performance (~500m avg hex diameter)
- **Next.js API routes** cache responses for 24 hours (`revalidate: 86400`)
- **Database connection pooling** in Python processor prevents timeout issues on large datasets

When working on geospatial features, always consider H3 cell relationships and leverage the materialized view architecture for optimal query performance.
