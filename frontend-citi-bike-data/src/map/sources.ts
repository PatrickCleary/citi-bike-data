import type { SourceSpecification } from "maplibre-gl";

export const HEX_SOURCE_ID = "nyc_jc_hex_tiles";

export const HEX_SOURCE: SourceSpecification = {
  type: "vector", // or another appropriate type based on your use case
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
