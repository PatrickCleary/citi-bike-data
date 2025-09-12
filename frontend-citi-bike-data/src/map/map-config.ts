import maplibregl, {
  GeoJSONFeature,
  Map,
  Event,
  MapEventType,
  Popup,
} from "maplibre-gl";
import { MutableRefObject, useEffect } from "react";
import {
  HEX_SOURCE,
  HEX_SOURCE_ID,
  ORIGIN_SOURCE,
  ORIGIN_SOURCE_ID,
} from "./sources";
import { cellsToMultiPolygon } from "h3-js";

import {
  HEX_LAYER,
  HEX_LAYER_LINE,
  HEX_SOURCE_LAYER_ID,
  ORIGIN_LAYER_LINE,
} from "./layers";
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
  const { setHoveredFeature } = usePopupStateStore();
  useEffect(() => {
    if (!mapLoaded) return;
    addHexLayer(map, addOrRemoveDepartureCell, setHoveredFeature);
  }, [mapLoaded, map, addOrRemoveDepartureCell, setHoveredFeature]);
};

const addHexLayer = (
  map: MutableRefObject<Map | null>,
  addOrRemoveDepartureCell: (cell: string) => void,
  setHoveredFeature: (feature: HoveredFeature | null) => void
) => {
  if (!map.current) return;
  const mapObj = map.current;
  const eventHandlers = getCellEventHandlers(
    map,
    addOrRemoveDepartureCell,
    setHoveredFeature
  );

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
import { HoveredFeature, usePopupStateStore } from "@/store/popup-store";

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
  map: MutableRefObject<Map | null>,
  addOrRemoveDepartureCell: (cell: string) => void,
  setHoveredFeature: (feature: HoveredFeature | null) => void
): {
  eventType: MapEventType;
  layer: string;
  handler: (e: Event & { features?: GeoJSONFeature[] }) => void;
}[] => {
  let hoveredFeatureId: null | number = null;
  // Add these variables to track animation state
  let hoverTimeout = null;
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

    // Updated mousemove handler
    {
      eventType: "mousemove",
      layer: HEX_LAYER.id,
      handler: (e) => {
        const feature = e.features?.[0];
        if (!feature?.id) return;

        const coordinates = e.lngLat;
        const h3Id = feature.id as string;
        setHoveredFeature({ id: h3Id, coordinates: coordinates });

        if (!h3Id) return;

        // Clear any pending timeout
        if (hoverTimeout) {
          clearTimeout(hoverTimeout);
          hoverTimeout = null;
        }

        // If we're hovering a different feature
        if (hoveredFeatureId !== h3Id) {
          // Animate previous feature back to 0.5 from wherever it currently is
          if (hoveredFeatureId !== null) {
            const previousFeatureState = map.current?.getFeatureState({
              source: HEX_SOURCE_ID,
              sourceLayer: HEX_SOURCE_LAYER_ID,
              id: hoveredFeatureId,
            });

            const currentOpacity = previousFeatureState?.opacity || 0.5;
            console.log(currentOpacity);
            // Only animate if it's not already at 0.5
            if (currentOpacity !== 0.5) {
              animateOpacity(map, hoveredFeatureId, currentOpacity, 0.5);
            } else {
              // Just set hover state to false if already at correct opacity
              map.current?.setFeatureState(
                {
                  source: HEX_SOURCE_ID,
                  sourceLayer: HEX_SOURCE_LAYER_ID,
                  id: hoveredFeatureId,
                },
                { hover: false }
              );
            }
          }

          // Start animating new feature from 0.5 to 0.8
          hoveredFeatureId = h3Id;
          animateOpacity(map, h3Id, 0.5, 0.8, 100);
        }
      },
    },

    // Add mouseleave handler to handle unhover
    {
      eventType: "mouseleave",
      layer: HEX_LAYER.id,
      handler: (e) => {
        if (hoveredFeatureId !== null) {
          // Get current opacity to animate from current state
          const featureState = map.current?.getFeatureState({
            source: HEX_SOURCE_ID,
            sourceLayer: HEX_SOURCE_LAYER_ID,
            id: hoveredFeatureId,
          });

          const currentOpacity = featureState?.opacity || 0.5;

          // Animate back to 0.5
          animateOpacity(map, hoveredFeatureId, currentOpacity, 0.5);

          // Clear the hovered feature
          hoveredFeatureId = null;
        }

        setHoveredFeature(null);
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

// Helper function to animate opacity
const animateOpacity = (
  map: MutableRefObject<Map>,
  featureId: string,
  startOpacity: number,
  endOpacity: number,
  duration = 1000
) => {
  console.log(featureId);
  if (!map.current || !featureId) return;

  const startTime = performance.now();

  const animate = (currentTime) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Easing function (ease-out for smooth deceleration)
    const easeOut = 1 - Math.pow(1 - progress, 3);
    const currentOpacity = startOpacity + (endOpacity - startOpacity) * easeOut;
    console.log(currentOpacity);
    // Update the layer opacity for this specific feature
    map.current?.setFeatureState(
      {
        source: HEX_SOURCE_ID,
        sourceLayer: HEX_SOURCE_LAYER_ID,
        id: featureId,
      },
      { opacity: currentOpacity, hover: endOpacity > startOpacity }
    );

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  };

  requestAnimationFrame(animate);
};
