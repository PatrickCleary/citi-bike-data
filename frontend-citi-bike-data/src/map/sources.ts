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

export const NJ_TRANSIT_SOURCE_ID = "nj_transit_stations";

export const NJ_TRANSIT_SOURCE: SourceSpecification = {
  type: "vector",
  url: "pmtiles://https://kevndteqglsoslznrntz.supabase.co/storage/v1/object/public/citi-bike-data-bucket/nj_transit_stations.pmtiles",
};
