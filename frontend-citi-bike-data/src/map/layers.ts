import { LayerSpecification } from "maplibre-gl";
import { HEX_SOURCE_ID, ORIGIN_SOURCE_ID } from "./sources";

const HEX_LAYER_ID = "nyc_jc_hex_tiles_layer";
const HEX_LAYER_LINE_ID = "nyc_jc_hex_tiles_line_layer";
export const HEX_SOURCE_LAYER_ID = "nyc_jc_hexagons";

export const HEX_LAYER: LayerSpecification = {
  id: HEX_LAYER_ID,
  source: HEX_SOURCE_ID,
  "source-layer": HEX_SOURCE_LAYER_ID,
  type: "fill",
  paint: {
    "fill-color": "#FF0000",
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
