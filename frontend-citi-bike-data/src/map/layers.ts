import { LayerSpecification } from "maplibre-gl";
import { HEX_SOURCE_ID } from "./sources";

const HEX_LAYER_ID = "nyc_jc_hex_tiles_layer";
const HEX_LAYER_LINE_ID = "nyc_jc_hex_tiles_line_layer";

export const HEX_LAYER: LayerSpecification = {
  id: HEX_LAYER_ID,
  source: HEX_SOURCE_ID,
  "source-layer": "nyc_jc_hexagons",
  type: "fill",
  paint: {
    "fill-color": "#FF0000",
    "fill-opacity": 0.5,
  },
};

export const HEX_LAYER_LINE: LayerSpecification = {
  id: HEX_LAYER_LINE_ID,
  source: HEX_SOURCE_ID,
  "source-layer": "nyc_jc_hexagons",
  type: "line",
  paint: {
    "line-color": "#ffffff",
  },
};
