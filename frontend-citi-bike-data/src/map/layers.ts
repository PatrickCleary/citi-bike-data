import { LayerSpecification } from "mapbox-gl";
import { STATION_SOURCE_ID } from "./sources";

export const STATION_LAYER: LayerSpecification = {
    id: STATION_SOURCE_ID,
    source: STATION_SOURCE_ID,
    type: 'circle',
    paint: {
        // if `value` is undefined, set the radius to 3 otherwise set it to `value`
        'circle-radius': [
            'case',
            ['==', ['typeof', ['get', 'value']], 'undefined'],
            3,
            ['get', 'value']
        ]
    }
};