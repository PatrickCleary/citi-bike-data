import { LayerSpecification } from "maplibre-gl";
import {
  HEX_SOURCE_ID,
  NJ_TRANSIT_SOURCE_ID,
  ORIGIN_SOURCE_ID,
  SUBWAY_LINES_SOURCE_ID,
} from "./sources";

const HEX_LAYER_ID = "nyc_jc_hex_tiles_layer";
const HEX_LAYER_LINE_ID = "nyc_jc_hex_tiles_line_layer";
export const HEX_SOURCE_LAYER_ID = "nyc_jc_hexagons";

export const HEX_LAYER: LayerSpecification = {
  id: HEX_LAYER_ID,
  source: HEX_SOURCE_ID,
  "source-layer": HEX_SOURCE_LAYER_ID,
  type: "fill",
  paint: {
    "fill-color": "#FF000000",
    "fill-opacity": [
      "case",
      ["!=", ["feature-state", "opacity"], null],
      ["feature-state", "opacity"],
      0.5,
    ],
  },
};

export const HEX_LAYER_LINE: LayerSpecification = {
  id: HEX_LAYER_LINE_ID,
  source: HEX_SOURCE_ID,
  "source-layer": HEX_SOURCE_LAYER_ID,
  type: "line",
  paint: {
    "line-color": "#ffffff20",
  },
};

export const ORIGIN_LAYER_LINE_ID = "origin_hex_tiles_line_layer";

export const ORIGIN_LAYER_LINE: LayerSpecification = {
  id: ORIGIN_LAYER_LINE_ID,
  source: ORIGIN_SOURCE_ID,
  type: "line",
  paint: {
    "line-width": 4,
    "line-color": "#000000",
  },
};

const SUBWAY_LINE_LAYER_ID = "subway_line_tiles_line_layer";
export const SUBWAY_SOURCE_LAYER_ID = "subway_lines";

export const SUBWAY_LINE_LAYER: LayerSpecification = {
  id: SUBWAY_LINE_LAYER_ID,
  source: SUBWAY_LINES_SOURCE_ID,
  "source-layer": SUBWAY_SOURCE_LAYER_ID,
  type: "line",
  paint: {
    "line-color": ["concat", "#", ["get", "color"]],
    "line-opacity": 0.5,
    "line-width": 1,
  },
};

const NJ_TRANSIT_STATION_LAYER_ID = "nj_transit_stations_layer";
export const NJ_TRANSIT_STATIONS_SOURCE_LAYER = "nj_transit_stations";

export const NJ_TRANSIT_STATIONS_LAYER: LayerSpecification = {
  id: NJ_TRANSIT_STATION_LAYER_ID,
  source: NJ_TRANSIT_SOURCE_ID,
  "source-layer": NJ_TRANSIT_STATIONS_SOURCE_LAYER,
  type: "circle",
  paint: {
    "circle-color": "#ff0000",
    "circle-opacity": 0.5,
  },
};
