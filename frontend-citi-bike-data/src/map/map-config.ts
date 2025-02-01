
import { GeoJSONFeature, Map, MapEvent, MapEventType } from "mapbox-gl";
import { MutableRefObject, useEffect } from "react";
import { STATION_SOURCE_ID, STATIONS_SOURCE } from "./sources";
import { STATION_LAYER } from "./layers";
import { useStationStore } from "@/store/store";

export type EventHandler = {
    eventType: MapEventType;
    layer: string;
    handler: (e: MapEvent & { features?: GeoJSONFeature[] }) => void;
};
export const useApplyLayers = (
    map: MutableRefObject<Map | null>,
    mapLoaded: boolean
) => {

    const setStations = useStationStore((state) => state.setStations);
    useEffect(() => {
        if (!mapLoaded) return;
        addStationLayer(map, setStations);
    }, [mapLoaded, map]);
};


const addStationLayer = (
    map: MutableRefObject<Map | null>,
    setStations: (stations: string[]) => void
) => {
    if (!map.current) return;
    const mapObj = map.current;
    const eventHandlers = getStationEventHandlers(setStations);

    mapObj.addSource(STATION_SOURCE_ID, STATIONS_SOURCE);
    // const source = mapObj.getSource(STATION_SOURCE_ID) as GeoJSONSource;
    // if (source)
    // source.on('error', (e) => handleSourceError(e as MapBoxSourceLoadError));

    mapObj.addLayer(STATION_LAYER);

    eventHandlers.forEach((event) => {
        mapObj.on(event.eventType, event.layer, event.handler);
    });
    return () => {
        removeStationLayer(mapObj, eventHandlers);
        // source?.off('error', (e) => handleSourceError(e as MapBoxSourceLoadError));
    };
}


const removeStationLayer = (mapObj: Map, eventHandlers: EventHandler[]) => {
    eventHandlers.forEach((event) => {
        mapObj.off(event.eventType, event.layer, event.handler);
    });
    mapObj.removeLayer(STATION_SOURCE_ID);
    mapObj.removeSource(STATION_SOURCE_ID);
};

const getStationEventHandlers = (
    setStations: (stations: string[]) => void
    // map: MutableRefObject<Map | null>,
    // hoveredFeatures: MutableRefObject<number[] | null>
): {
    eventType: MapEventType;
    layer: string;
    handler: (e: MapEvent & { features?: GeoJSONFeature[] }) => void;
}[] => {
    return [
        {
            eventType: 'click',
            layer: STATION_SOURCE_ID,
            handler: (e) => setStations([e.features?.[0].id] as string[]),
        },
    ];
};
