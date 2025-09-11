import maplibregl, {
  GeoJSONFeature,
  Map,
  Event,
  MapEventType,
} from "maplibre-gl";
import { MutableRefObject, useEffect } from "react";
import { HEX_SOURCE, HEX_SOURCE_ID } from "./sources";
import { HEX_LAYER, HEX_LAYER_LINE } from "./layers";
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

  mapObj.addLayer(HEX_LAYER_LINE);
  mapObj.addLayer(HEX_LAYER);

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

import { useState } from "react"; // Add this import
import { API_URL } from "@/components/constants";
import { Protocol } from "pmtiles";

const getDepartureCountMap = async (departureCells: string[]) => {
  const data = await fetch(API_URL + "/get-destinations", {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
    },
    method: "POST",
    body: JSON.stringify({
      start_cell_ids: departureCells,
      target_month: "2025-07-01",
    }),
  });
  const jsonData = await data.json();
  return jsonData["data"]["destinations"];
};

export const useUpdateMapStyleOnDataChange = (
  map: MutableRefObject<Map | null>,
  mapLoaded: boolean
) => {
  const { departureCells } = useMapConfigStore();
  const [departureCountMap, setDepartureCountMap] = useState<
    Record<string, number>
  >({}); // Initialize state

  useEffect(() => {
    const hexLayerLine = map.current?.getLayer(HEX_LAYER_LINE.id);
    if (hexLayerLine) {
      map.current?.setPaintProperty(HEX_LAYER_LINE.id, "line-color", [
        "case",
        ["in", ["id"], ["literal", departureCells || []]],
        "#000000",
        "#00000000",
      ]);
    }
    const fetchDepartureCountMap = async () => {
      const countMap = await getDepartureCountMap(departureCells);
      setDepartureCountMap(countMap);
    };
    fetchDepartureCountMap();
  }, [departureCells, map]);

  useEffect(() => {
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
          "#1a2a6c", // Low values = blue
          50,
          "#b21f1f",
          100,
          "#fdbb2d", // High values = red
        ],
        "#00000000", // Default color for features not in data
      ]);
    }
  }, [departureCountMap, map, mapLoaded]); // Include departureCountMap in dependencies
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
