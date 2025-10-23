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
  ORIGIN_LABEL_SOURCE_ID,
  DESTINATION_SOURCE_ID,
  DESTINATION_LABEL_SOURCE_ID,
  PATH_LINES_SOURCE_ID,
  PATH_STATIONS_SOURCE_ID,
  SUBWAY_LINES_SOURCE_ID,
} from "./sources";
import { GENERAL_IMAGES } from "./images";

export const DEFAULT_HEX_OPACITY = 0.62;

const HEX_LAYER_ID = "nyc_jc_hex_tiles_layer";
const HEX_LAYER_LINE_ID = "nyc_jc_hex_tiles_line_layer";
export const HEX_SOURCE_LAYER_ID = "nyc_jc_hexagons";

export const HEX_LAYER: LayerSpecification = {
  id: HEX_LAYER_ID,
  source: HEX_SOURCE_ID,
  "source-layer": HEX_SOURCE_LAYER_ID,
  type: "fill",
  paint: {
    "fill-color": [
      "case",
      ["!=", ["feature-state", "color"], ["literal", null]],
      ["feature-state", "color"],
      "#FF000000",
    ],
    "fill-opacity": [
      "case",
      ["!=", ["feature-state", "opacity"], ["literal", null]],
      ["feature-state", "opacity"],
      DEFAULT_HEX_OPACITY,
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

// Glow layer for pulse effect
const HEX_LAYER_GLOW_ID = "nyc_jc_hex_tiles_glow_layer";
export const HEX_LAYER_GLOW: LayerSpecification = {
  id: HEX_LAYER_GLOW_ID,
  source: HEX_SOURCE_ID,
  "source-layer": HEX_SOURCE_LAYER_ID,
  type: "line",
  paint: {
    "line-color": [
      "case",
      ["!=", ["feature-state", "glowColor"], ["literal", null]],
      ["feature-state", "glowColor"],
      "#ffffff00",
    ],
    "line-width": [
      "case",
      ["!=", ["feature-state", "glowWidth"], ["literal", null]],
      ["feature-state", "glowWidth"],
      0,
    ],
    "line-blur": 4,
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

export const ORIGIN_LABEL_LAYER_ID = "origin_label_layer";
export const ORIGIN_LABEL_LAYER: LayerSpecification = {
  id: ORIGIN_LABEL_LAYER_ID,
  source: ORIGIN_LABEL_SOURCE_ID,
  type: "symbol",
  layout: {
    "icon-offset": [0, 25],
    "icon-size":.8,
    "icon-image": "origin_label",
    "icon-allow-overlap": true,
  },
};

export const DESTINATION_LAYER_LINE_ID = "destination_hex_tiles_line_layer";

export const DESTINATION_LAYER_LINE: LayerSpecification = {
  id: DESTINATION_LAYER_LINE_ID,
  source: DESTINATION_SOURCE_ID,
  type: "line",
  paint: {
    "line-width": 6,
    "line-color": "#000000",
  },
};

export const DESTINATION_LAYER_LINE_INSET_ID =
  "destination_hex_tiles_line_inset_layer";

export const DESTINATION_LAYER_LINE_INSET: LayerSpecification = {
  id: DESTINATION_LAYER_LINE_INSET_ID,
  source: DESTINATION_SOURCE_ID,
  type: "line",
  paint: {
    "line-width": 2,
    "line-color": "#ffffff",
  },
};

export const DESTINATION_LABEL_LAYER_ID = "destination_label_layer";

export const DESTINATION_LABEL_LAYER: LayerSpecification = {
  id: DESTINATION_LABEL_LAYER_ID,
  source: DESTINATION_LABEL_SOURCE_ID,
  type: "symbol",
  layout: {
    "icon-offset": [0, 25],
    "icon-size":.8,
    "icon-image": "destination_label",
    "icon-allow-overlap": true,
  },
};

export const INFO_MODE_SELECTED_LAYER_ID = "info_mode_selected_hex_layer";

export const INFO_MODE_SELECTED_LAYER: LayerSpecification = {
  id: INFO_MODE_SELECTED_LAYER_ID,
  source: "info_mode_selected_hex",
  type: "line",
  paint: {
    "line-width": 3,
    "line-color": "#ffffff",
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
const NYC_BIKE_LANE_LAYER_ID = "nyc_bike_lanes_layer";
export const NYC_BIKE_LANE_SOURCE_LAYER_ID = "nyc_bike_lanes";
export const NYC_BIKE_LANE_LAYER: LayerSpecification = {
  id: NYC_BIKE_LANE_LAYER_ID,
  source: NYC_BIKE_LANE_SOURCE_LAYER_ID,
  "source-layer": NYC_BIKE_LANE_SOURCE_LAYER_ID,
  type: "line",
  paint: {
    "line-color": "#31688e",
    "line-width": [
      "match",
      ["get", "facilitycl"],
      "I",
      1.5,
      "II",
      0.75,
      "III",
      0.25,
      "L",
      0.5,
      0.25, //fallback
    ],
  }, // You can change the color as needed
  filter: ["all"], // Will be updated dynamically based on selectedMonth
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
  type: "circle",
  minzoom: 10, // Layer will be hidden at zoom levels less than 10
  paint: {
    "circle-color": "#202020",
    "circle-opacity": 0.7,
    "circle-radius": [
      "interpolate",
      ["linear"],
      ["zoom"],
      10,
      0.5, // Radius of 1 at zoom level 12
      14,
      2, // Radius of 2 at zoom level 14
      16,
      4, // Radius of 2 at zoom level 14
    ],
  },
};
