import { GeoJSONFeature, Map, MapEvent, MapEventType } from "mapbox-gl";
import { MutableRefObject, useEffect } from "react";
import { STATION_SOURCE_ID, STATIONS_SOURCE } from "./sources";
import { STATION_LAYER } from "./layers";
import { polygonToCells, cellToBoundary } from "h3-js";

export type EventHandler = {
    eventType: MapEventType;
    layer: string;
    handler: (e: MapEvent & { features?: GeoJSONFeature[] }) => void;
};

const H3_SOURCE_ID = "h3-cells";
const H3_LAYER_ID = "h3-layer";

export const useApplyLayers = (
    map: MutableRefObject<Map | null>,
    mapLoaded: boolean
) => {
    useEffect(() => {
        if (!mapLoaded) return;
        addStationLayer(map);
        addH3Layer(map);
        return () => {
          if (map.current) removeH3Layer(map.current);
        };
    }, [mapLoaded, map]);
};

const addStationLayer = (map: MutableRefObject<Map | null>) => {
    if (!map.current) return;
    const mapObj = map.current;
    const eventHandlers = getStationEventHandlers();

    mapObj.addSource(STATION_SOURCE_ID, STATIONS_SOURCE);
    // const source = mapObj.getSource(STATION_SOURCE_ID) as GeoJSONSource;
    // if (source)
    // source.on('error', (e) => handleSourceError(e as MapBoxSourceLoadError));

    mapObj.addLayer(STATION_LAYER);

    eventHandlers.forEach((event) => {
        mapObj.on(event.eventType, event.layer, event.handler);
    });

    return () => removeStationLayer(mapObj, eventHandlers);
    // source?.off('error', (e) => handleSourceError(e as MapBoxSourceLoadError));
};

const removeStationLayer = (mapObj: Map, eventHandlers: EventHandler[]) => {
    eventHandlers.forEach((event) => {
      mapObj.off(event.eventType, event.layer, event.handler);
    });
    mapObj.removeLayer(STATION_SOURCE_ID);
    mapObj.removeSource(STATION_SOURCE_ID);
};

const addH3Layer = (map: MutableRefObject<Map | null>) => {
    if (!map.current) return;
    const mapObj = map.current;

    const handleUpdate = () => updateH3Layer(mapObj);

    handleUpdate();
    mapObj.on("move", handleUpdate);
    mapObj.on("zoom", handleUpdate);
};

const removeH3Layer = (mapObj: Map) => {
    if (mapObj.getLayer(H3_LAYER_ID)) mapObj.removeLayer(H3_LAYER_ID);
    if (mapObj.getSource(H3_SOURCE_ID)) mapObj.removeSource(H3_SOURCE_ID);
};

const updateH3Layer = (mapObj: Map) => {
    const bounds = mapObj.getBounds();
    const zoom = mapObj.getZoom();
    const resolution = getH3ResolutionForZoom(zoom);
    console.log(`Resolution: ${resolution}`);

    const { _sw, _ne } = bounds;
    const polygon = [
      [_sw.lng, _sw.lat],
      [_ne.lng, _sw.lat],
      [_ne.lng, _ne.lat],
      [_sw.lng, _ne.lat],
      [_sw.lng, _sw.lat],
    ];
    const h3Indexes: string[] = polygonToCells(polygon, resolution, true);

    const h3GeoJSON = h3IndexesToGeoJSON(h3Indexes);

    const source = mapObj.getSource(H3_SOURCE_ID);
    if (source) {
      (source as any).setData(h3GeoJSON);
    } else {
      mapObj.addSource(H3_SOURCE_ID, {
        type: "geojson",
        data: h3GeoJSON,
      });
      mapObj.addLayer({
        id: H3_LAYER_ID,
        type: "line",
        source: H3_SOURCE_ID,
        paint: {
          "line-opacity": 0.15,
          "line-color": "#DA20FD"
        },
      });
    }
};

const getH3ResolutionForZoom = (zoom: number) => {
    return Math.min(Math.floor(zoom - 3), 12);
};

const h3IndexesToGeoJSON = (h3Indexes: string[]) => ({
    type: "FeatureCollection",
    features: h3Indexes.map((h3Index) => ({
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [cellToBoundary(h3Index, true)],
      },
      properties: { h3Index },
    })),
});

const getStationEventHandlers = (): EventHandler[] => {
    return [
      {
        eventType: "click",
        layer: STATION_SOURCE_ID,
        handler: (e) =>
          fetch(
            `/station_data/${e.features?.[0].properties["start_station_id"]}.csv`
          )
            .then((res) => res.text())
            .then((data) => console.log(data)),
      },
    ];
};
