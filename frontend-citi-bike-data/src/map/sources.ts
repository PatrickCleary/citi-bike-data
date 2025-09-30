import type { SourceSpecification } from "maplibre-gl";

export const HEX_SOURCE_ID = "nyc_jc_hex_tiles";

export const HEX_SOURCE: SourceSpecification = {
  type: "vector",
  url: "pmtiles://https://kevndteqglsoslznrntz.supabase.co/storage/v1/object/public/citi-bike-data-bucket/nyc_jc_hex.pmtiles",
  promoteId: "h3_id",
};

export const ORIGIN_SOURCE_ID = "origin_hex_tiles";
export const ORIGIN_SOURCE: SourceSpecification = {
  type: "geojson",
  data: {
    type: "FeatureCollection",
    features: [],
  },
};

export const SUBWAY_LINES_SOURCE_ID = "subway_lines";

export const SUBWAY_LINES_SOURCE: SourceSpecification = {
  type: "vector",
  url: "pmtiles://https://kevndteqglsoslznrntz.supabase.co/storage/v1/object/public/citi-bike-data-bucket/subway_lines.pmtiles",
  promoteId: "route_id",
};

export const PATH_LINES_SOURCE_ID = "path_lines";
export const PATH_LINES_SOURCE: SourceSpecification = {
  type: "vector",
  url: "pmtiles://https://kevndteqglsoslznrntz.supabase.co/storage/v1/object/public/citi-bike-data-bucket/geo_layers/path_lines.pmtiles",
};

export const PATH_STATIONS_SOURCE_ID = "path_stations";
export const PATH_STATIONS_SOURCE: SourceSpecification = {
  type: "vector",
  url: "pmtiles://https://kevndteqglsoslznrntz.supabase.co/storage/v1/object/public/citi-bike-data-bucket/geo_layers/path_stations.pmtiles",
};

export const NYC_LINES_SOURCE_ID = "nyc_lines";
export const NYC_LINES_SOURCE: SourceSpecification = {
  type: "vector",
  url: "pmtiles://https://kevndteqglsoslznrntz.supabase.co/storage/v1/object/public/citi-bike-data-bucket/geo_layers/nyc_lines.pmtiles",
};
export const NYC_STATIONS_SOURCE_ID = "nyc_stations";
export const NYC_STATIONS_SOURCE: SourceSpecification = {
  type: "vector",
  url: "pmtiles://https://kevndteqglsoslznrntz.supabase.co/storage/v1/object/public/citi-bike-data-bucket/geo_layers/nyc_stations.pmtiles",
};
export const NJ_LIGHT_RAIL_LINES_SOURCE_ID = "nj_light_rail_lines";
export const NJ_LIGHT_RAIL_LINES_SOURCE: SourceSpecification = {
  type: "vector",
  url: "pmtiles://https://kevndteqglsoslznrntz.supabase.co/storage/v1/object/public/citi-bike-data-bucket/geo_layers/nj_light_rail_lines.pmtiles",
};
export const NJ_LIGHT_RAIL_STATIONS_SOURCE_ID = "nj_light_rail_stations";
export const NJ_LIGHT_RAIL_STATIONS_SOURCE: SourceSpecification = {
  type: "vector",
  url: "pmtiles://https://kevndteqglsoslznrntz.supabase.co/storage/v1/object/public/citi-bike-data-bucket/geo_layers/nj_light_rail_stations.pmtiles",
};
export const NJ_RAIL_LINES_SOURCE_ID = "nj_rail_lines";
export const NJ_RAIL_LINES_SOURCE: SourceSpecification = {
  type: "vector",
  url: "pmtiles://https://kevndteqglsoslznrntz.supabase.co/storage/v1/object/public/citi-bike-data-bucket/geo_layers/nj_rail_lines.pmtiles",
};
export const NJ_RAIL_STATIONS_SOURCE_ID = "nj_rail_stations";
export const NJ_RAIL_STATIONS_SOURCE: SourceSpecification = {
  type: "vector",
  url: "pmtiles://https://kevndteqglsoslznrntz.supabase.co/storage/v1/object/public/citi-bike-data-bucket/geo_layers/nj_rail_stations.pmtiles",
};
