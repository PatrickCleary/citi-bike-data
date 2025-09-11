import maplibregl, {
  GeoJSONFeature,
  Map,
  Event,
  MapEventType,
} from "maplibre-gl";
import { MutableRefObject, useEffect } from "react";
import {
  HEX_SOURCE,
  HEX_SOURCE_ID,
  ORIGIN_SOURCE,
  ORIGIN_SOURCE_ID,
} from "./sources";
import { cellsToMultiPolygon } from "h3-js";

import { HEX_LAYER, HEX_LAYER_LINE, ORIGIN_LAYER_LINE } from "./layers";
import { useMapConfigStore } from "@/store/store";

export type EventHandler = {
  eventType: MapEventType;
  layer: string;
  handler: (e: Event & { features?: GeoJSONFeature[] }) => void;
};
export const useApplyLayers = (
  map: MutableRefObject<Map | null>,
  mapLoaded: boolean
) => {
  const { addOrRemoveDepartureCell } = useMapConfigStore();
  useEffect(() => {
    if (!mapLoaded) return;
    addHexLayer(map, addOrRemoveDepartureCell);
  }, [mapLoaded, map, addOrRemoveDepartureCell]);
};

const addHexLayer = (
  map: MutableRefObject<Map | null>,
  addOrRemoveDepartureCell: (cell: string) => void
) => {
  if (!map.current) return;
  const mapObj = map.current;
  const eventHandlers = getCellEventHandlers(addOrRemoveDepartureCell);

  mapObj.addSource(HEX_SOURCE_ID, HEX_SOURCE);
  mapObj.addSource(ORIGIN_SOURCE_ID, ORIGIN_SOURCE);

  mapObj.addLayer(HEX_LAYER);
  mapObj.addLayer(HEX_LAYER_LINE);
  mapObj.addLayer(ORIGIN_LAYER_LINE);

  eventHandlers.forEach((event) => {
    mapObj.on(event.eventType, event.layer, event.handler);
  });
  return () => {
    removeHexLayer(mapObj, eventHandlers);
    // source?.off('error', (e) => handleSourceError(e as MapBoxSourceLoadError));
  };
};

const removeHexLayer = (mapObj: Map, eventHandlers: EventHandler[]) => {
  eventHandlers.forEach((event) => {
    mapObj.off(event.eventType, event.layer, event.handler);
  });
  mapObj.removeLayer(HEX_SOURCE_ID);
  mapObj.removeSource(HEX_SOURCE_ID);
};

import { Protocol } from "pmtiles";
import { useQuery } from "@tanstack/react-query";
import { getTripCountData } from "@/utils/api";

export const useTripCountData = () => {
  const { departureCells, selectedMonth, analysisType } = useMapConfigStore();

  const query = useQuery({
    queryKey: ["tripCounts", departureCells, selectedMonth, analysisType],
    queryFn: () =>
      getTripCountData(departureCells, selectedMonth, analysisType),
  });
  return query;
};

export const useUpdateMapStyleOnDataChange = (
  map: MutableRefObject<Map | null>,
  mapLoaded: boolean
) => {
  const query = useTripCountData();
  if (!mapLoaded) return;
  const departureCountMap = query.data?.data.trip_counts;
  const highestValue = query.data?.data.highest_value || 100;
  console.log("hv", highestValue);
  const hexLayer = map.current?.getLayer(HEX_LAYER.id);
  if (hexLayer && departureCountMap) {
    map.current?.setPaintProperty(HEX_LAYER.id, "fill-color", [
      "case",
      ["has", ["id"], ["literal", departureCountMap]],
      [
        "interpolate",
        ["linear"],
        ["get", ["id"], ["literal", departureCountMap]],
        0,
        "#1a2a6c",
        highestValue / 2,
        "#b21f1f",
        highestValue,
        "#fdbb2d",
      ],
      "#ffffff00",
    ]);
  }
};

const getCellEventHandlers = (
  addOrRemoveDepartureCell: (cell: string) => void
  // map: MutableRefObject<Map | null>,
  // hoveredFeatures: MutableRefObject<number[] | null>
): {
  eventType: MapEventType;
  layer: string;
  handler: (e: Event & { features?: GeoJSONFeature[] }) => void;
}[] => {
  return [
    {
      eventType: "click",
      layer: HEX_LAYER.id,
      handler: (e) => {
        const cellId = e.features?.[0].id;
        if (typeof cellId !== "string") return;
        addOrRemoveDepartureCell(cellId);
      },
    },
  ];
};

export const useAddPMTilesProtocol = () => {
  useEffect(() => {
    const protocol = new Protocol();
    maplibregl.addProtocol("pmtiles", protocol.tile);
    return () => {
      maplibregl.removeProtocol("pmtiles");
    };
  }, []);
};

export const useUpdateOriginShape = (
  map: MutableRefObject<Map>,
  mapLoaded: boolean
) => {
  const { departureCells } = useMapConfigStore();

  useEffect(() => {
    if (!mapLoaded) return;
    const originGeoJson = convertCellsToGeoJSON(departureCells);

    const originSource = map.current?.getSource(
      ORIGIN_SOURCE_ID
    ) as maplibregl.GeoJSONSource;
    originSource?.setData(originGeoJson);
  }, [departureCells, map, mapLoaded]);
};

const convertCellsToGeoJSON = (
  cells: string[]
): GeoJSON.FeatureCollection<GeoJSON.Geometry> => {
  const polygons = cellsToMultiPolygon(cells, true);
  const features = polygons.map((polygon) => ({
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: polygon,
    },
    properties: {},
  }));
  return {
    type: "FeatureCollection",
    features: features,
  };
};
