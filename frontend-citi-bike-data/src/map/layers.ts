import { LayerSpecification } from "maplibre-gl";
import {
  HEX_SOURCE_ID,
  NJ_LIGHT_RAIL_LINES_SOURCE_ID,
  NJ_LIGHT_RAIL_STATIONS_SOURCE_ID,
  NJ_RAIL_LINES_SOURCE_ID,
  NJ_RAIL_STATIONS_SOURCE_ID,
  NYC_LINES_SOURCE_ID,
  NYC_STATIONS_SOURCE_ID,
  ORIGIN_SOURCE_ID,
  PATH_LINES_SOURCE_ID,
  PATH_STATIONS_SOURCE_ID,
  SUBWAY_LINES_SOURCE_ID,
} from "./sources";
import { GENERAL_IMAGES } from "./images";

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
      0.62,
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

export const stationPaintStyle = {
  "circle-color": "#808080",
  "circle-opacity": 0.5,
};

export const linePaintStyle = {
  "line-color": "#808080",
  "line-opacity": 0.5,
  "line-width": 1,
};

// // const NJ_TRANSIT_STATION_LAYER_ID = "nj_transit_stations_layer";
// export const NJ_TRANSIT_STATIONS_SOURCE_LAYER = "nj_transit_stations";

// export const NJ_TRANSIT_STATIONS_LAYER: LayerSpecification = {
//   id: NJ_TRANSIT_STATION_LAYER_ID,
//   source: NJ_TRANSIT_SOURCE_ID,
//   "source-layer": NJ_TRANSIT_STATIONS_SOURCE_LAYER,
//   type: "circle",
//   paint: stationPaintStyle,
// };

const PATH_LINE_COLOR_MAP = {
  3: "#5172CA",
  2: "#7DD024",
  1: "#E64035",
  4: "#EF9425",
};

const PATH_LINE_LAYER_ID = "path_lines_layer";
export const PATH_SOURCE_LAYER_ID = "path_lines";
export const PATH_LINE_LAYER: LayerSpecification = {
  id: PATH_LINE_LAYER_ID,
  source: PATH_LINES_SOURCE_ID,
  "source-layer": PATH_SOURCE_LAYER_ID,
  type: "line",
  paint: {
    "line-color": [
      "match",
      ["get", "OBJECTID"],
      1,
      "#E64035",
      2,
      "#7DD024",
      3,
      "#5172CA",
      4,
      "#EF9425",
      "#000000", // fallback color
    ],
    "line-width": 2,
  },
};

const PATH_STATION_LAYER_ID = "path_stations_layer";
export const PATH_STATION_SOURCE_LAYER_ID = "path_stations";
export const PATH_STATION_LAYER: LayerSpecification = {
  id: PATH_STATION_LAYER_ID,
  source: PATH_STATIONS_SOURCE_ID,
  "source-layer": PATH_STATION_SOURCE_LAYER_ID,
  type: "symbol",
  minzoom: 12, // Layer will be hidden at zoom levels less than 10

  layout: {
    "icon-image": GENERAL_IMAGES.SUBWAY, // Reference the icon by ID
    "icon-size": 0.5, // Scale the icon
    "icon-allow-overlap": false, // Optional: allow icons to overlap
  },
};

const NYC_LINE_LAYER_ID = "nyc_lines_layer";
export const NYC_SOURCE_LAYER_ID = "nyc_lines";
export const NYC_LINE_LAYER: LayerSpecification = {
  id: NYC_LINE_LAYER_ID,
  source: NYC_LINES_SOURCE_ID,
  "source-layer": NYC_SOURCE_LAYER_ID,
  type: "line",
  paint: {
    "line-color": ["concat", "#", ["get", "color"]],
    "line-opacity": 0.5,
    "line-width": 2,
  },
};
const NYC_STATION_LAYER_ID = "nyc_stations_layer";
export const NYC_STATION_SOURCE_LAYER_ID = "nyc_stations";
export const NYC_STATION_LAYER: LayerSpecification = {
  id: NYC_STATION_LAYER_ID,
  source: NYC_STATIONS_SOURCE_ID,
  "source-layer": NYC_STATION_SOURCE_LAYER_ID,
  type: "symbol",
  minzoom: 12, // Layer will be hidden at zoom levels less than 10
  layout: {
    "icon-image": GENERAL_IMAGES.SUBWAY, // Reference the icon by ID
    "icon-size": 0.5, // Scale the icon
    "icon-allow-overlap": false, // Optional: allow icons to overlap
  },
};

const NJ_LIGHT_RAIL_LINE_LAYER_ID = "nj_light_rail_lines_layer";
export const NJ_LIGHT_RAIL_SOURCE_LAYER_ID = "nj_light_rail_lines";
export const NJ_LIGHT_RAIL_LINE_LAYER: LayerSpecification = {
  id: NJ_LIGHT_RAIL_LINE_LAYER_ID,
  source: NJ_LIGHT_RAIL_LINES_SOURCE_ID,
  "source-layer": NJ_LIGHT_RAIL_SOURCE_LAYER_ID,
  type: "line",
  paint: { "line-color": "#0E8F89" },
};

const NJ_LIGHT_RAIL_STATION_LAYER_ID = "nj_light_rail_stations_layer";
export const NJ_LIGHT_RAIL_STATION_SOURCE_LAYER_ID = "nj_light_rail_stations";
export const NJ_LIGHT_RAIL_STATION_LAYER: LayerSpecification = {
  id: NJ_LIGHT_RAIL_STATION_LAYER_ID,
  source: NJ_LIGHT_RAIL_STATIONS_SOURCE_ID,
  "source-layer": NJ_LIGHT_RAIL_STATION_SOURCE_LAYER_ID,
  type: "symbol",
  minzoom: 12, // Layer will be hidden at zoom levels less than 10

  layout: {
    "icon-image": GENERAL_IMAGES.SUBWAY, // Reference the icon by ID
    "icon-size": 0.5, // Scale the icon
    "icon-allow-overlap": false, // Optional: allow icons to overlap
  },
};
const NJ_RAIL_LINE_LAYER_ID = "nj_rail_lines_layer";
export const NJ_RAIL_SOURCE_LAYER_ID = "nj_rail_lines";
export const NJ_RAIL_LINE_LAYER: LayerSpecification = {
  id: NJ_RAIL_LINE_LAYER_ID,
  source: NJ_RAIL_LINES_SOURCE_ID,
  "source-layer": NJ_RAIL_SOURCE_LAYER_ID,
  type: "line",
  paint: linePaintStyle,
};
const NJ_RAIL_STATION_LAYER_ID = "nj_rail_stations_layer";
export const NJ_RAIL_STATION_SOURCE_LAYER_ID = "nj_rail_stations";
export const NJ_RAIL_STATION_LAYER: LayerSpecification = {
  id: NJ_RAIL_STATION_LAYER_ID,
  source: NJ_RAIL_STATIONS_SOURCE_ID,
  "source-layer": NJ_RAIL_STATION_SOURCE_LAYER_ID,
  type: "symbol",
  minzoom: 12, // Layer will be hidden at zoom levels less than 10

  layout: {
    "icon-image": GENERAL_IMAGES.SUBWAY, // Reference the icon by ID

    "icon-size": 0.5, // Scale the icon
    "icon-allow-overlap": false, // Optional: allow icons to overlap
  },
};

export const DOCK_LOCATIONS_CURRENT_LAYER_ID = "dock_locations_current";
export const DOCK_LOCATIONS_CURRENT_LAYER: LayerSpecification = {
  id: DOCK_LOCATIONS_CURRENT_LAYER_ID,
  source: "bike_docks_current",
  type: "symbol",
  minzoom: 14, // Layer will be hidden at zoom levels less than 10
  layout: {
    "icon-image": GENERAL_IMAGES.DOCK, // Reference the icon by ID
    // "icon-size": 0.75, // Scale the icon
    "icon-allow-overlap": true, // Optional: allow icons to overlap
  },
};
