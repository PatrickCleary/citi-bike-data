import { Protocol } from "pmtiles";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getTripCountData } from "@/utils/api";
import { HoveredFeature, usePopupStateStore } from "@/store/popup-store";
import maplibregl, {
  GeoJSONFeature,
  Map,
  Event,
  MapMouseEvent,
  LngLatLike,
} from "maplibre-gl";
import { MutableRefObject, useEffect, useRef } from "react";
import { useInteractionModeStore } from "@/store/interaction-mode-store";
import { isMobileDevice } from "@/utils/mobile-detection";
import dayjs from "dayjs";
import {
  BIKE_DOCKS_CURRENT_SOURCE,
  BIKE_DOCKS_CURRENT_SOURCE_ID,
  HEX_SOURCE,
  HEX_SOURCE_ID,
  INFO_MODE_SELECTED_SOURCE,
  INFO_MODE_SELECTED_SOURCE_ID,
  NJ_LIGHT_RAIL_LINES_SOURCE,
  NJ_LIGHT_RAIL_LINES_SOURCE_ID,
  NJ_LIGHT_RAIL_STATIONS_SOURCE,
  NJ_LIGHT_RAIL_STATIONS_SOURCE_ID,
  NJ_RAIL_LINES_SOURCE,
  NJ_RAIL_LINES_SOURCE_ID,
  NJ_RAIL_STATIONS_SOURCE,
  NJ_RAIL_STATIONS_SOURCE_ID,
  NYC_LINES_SOURCE,
  NYC_LINES_SOURCE_ID,
  NYC_STATIONS_SOURCE,
  NYC_STATIONS_SOURCE_ID,
  ORIGIN_SOURCE,
  ORIGIN_SOURCE_ID,
  PATH_LINES_SOURCE,
  PATH_LINES_SOURCE_ID,
  PATH_STATIONS_SOURCE,
  PATH_STATIONS_SOURCE_ID,
} from "./sources";
import { cellsToMultiPolygon } from "h3-js";

import {
  DEFAULT_HEX_OPACITY,
  DOCK_LOCATIONS_CURRENT_LAYER,
  HEX_LAYER,
  HEX_LAYER_LINE,
  HEX_SOURCE_LAYER_ID,
  INFO_MODE_SELECTED_LAYER,
  NJ_LIGHT_RAIL_LINE_LAYER,
  NJ_LIGHT_RAIL_STATION_LAYER,
  NJ_RAIL_LINE_LAYER,
  NJ_RAIL_STATION_LAYER,
  NYC_LINE_LAYER,
  NYC_STATION_LAYER,
  ORIGIN_LAYER_LINE,
  PATH_LINE_LAYER,
  PATH_STATION_LAYER,
} from "./layers";
import { useMapConfigStore } from "@/store/store";
import { useLayerVisibilityStore } from "@/store/layer-visibility-store";

export type EventHandler = {
  eventType: "click" | "mousemove" | "mouseleave";
  layer: string;
  handler: (
    e: Event & { features?: GeoJSONFeature[]; lngLat: LngLatLike },
  ) => void;
};
export const useApplyLayers = (
  map: MutableRefObject<Map | null>,
  mapLoaded: boolean,
) => {
  const { setLayersAdded } = useLayerVisibilityStore();
  const { addOrRemoveDepartureCell } = useMapConfigStore();
  const { setHoveredFeature } = usePopupStateStore();
  useEffect(() => {
    if (!mapLoaded) return;
    addTransitLayers(map);
    addDockLayer(map);
    addHexLayer(map, addOrRemoveDepartureCell, setHoveredFeature);
    setLayersAdded(true);
  }, [mapLoaded, map, addOrRemoveDepartureCell, setHoveredFeature]);
};

const addTransitLayers = (map: MutableRefObject<Map | null>) => {
  if (!map.current) return;
  const mapObj = map.current;

  // Sources: pat
  mapObj.addSource(PATH_LINES_SOURCE_ID, PATH_LINES_SOURCE);
  mapObj.addSource(PATH_STATIONS_SOURCE_ID, PATH_STATIONS_SOURCE);
  mapObj.addSource(NYC_LINES_SOURCE_ID, NYC_LINES_SOURCE);
  mapObj.addSource(NYC_STATIONS_SOURCE_ID, NYC_STATIONS_SOURCE);
  mapObj.addSource(NJ_LIGHT_RAIL_LINES_SOURCE_ID, NJ_LIGHT_RAIL_LINES_SOURCE);
  mapObj.addSource(
    NJ_LIGHT_RAIL_STATIONS_SOURCE_ID,
    NJ_LIGHT_RAIL_STATIONS_SOURCE,
  );
  mapObj.addSource(NJ_RAIL_LINES_SOURCE_ID, NJ_RAIL_LINES_SOURCE);
  mapObj.addSource(NJ_RAIL_STATIONS_SOURCE_ID, NJ_RAIL_STATIONS_SOURCE);
  mapObj.addLayer(PATH_LINE_LAYER);
  mapObj.addLayer(PATH_STATION_LAYER);
  mapObj.addLayer(NYC_LINE_LAYER);
  mapObj.addLayer(NYC_STATION_LAYER);
  mapObj.addLayer(NJ_LIGHT_RAIL_LINE_LAYER);
  mapObj.addLayer(NJ_LIGHT_RAIL_STATION_LAYER);
  mapObj.addLayer(NJ_RAIL_LINE_LAYER);
  mapObj.addLayer(NJ_RAIL_STATION_LAYER);
};
const addDockLayer = (map: MutableRefObject<Map | null>) => {
  if (!map.current) return;
  const mapObj = map.current;
  mapObj.addSource(BIKE_DOCKS_CURRENT_SOURCE_ID, BIKE_DOCKS_CURRENT_SOURCE);
  mapObj.addLayer(DOCK_LOCATIONS_CURRENT_LAYER);
};

const addHexLayer = (
  map: MutableRefObject<Map | null>,
  addOrRemoveDepartureCell: (cell: string) => void,
  setHoveredFeature: (feature: HoveredFeature | null) => void,
) => {
  if (!map.current) return;
  const mapObj = map.current;
  const eventHandlers = getCellEventHandlers(
    map,
    addOrRemoveDepartureCell,
    setHoveredFeature,
  );

  mapObj.addSource(HEX_SOURCE_ID, HEX_SOURCE);
  mapObj.addSource(ORIGIN_SOURCE_ID, ORIGIN_SOURCE);
  mapObj.addSource(INFO_MODE_SELECTED_SOURCE_ID, INFO_MODE_SELECTED_SOURCE);
  // mapObj.addSource(SUBWAY_LINES_SOURCE_ID, SUBWAY_LINES_SOURCE);
  // mapObj.addSource(NJ_TRANSIT_SOURCE_ID, NJ_TRANSIT_SOURCE);

  // mapObj.addLayer(SUBWAY_LINE_LAYER);
  // mapObj.addLayer(NJ_TRANSIT_STATIONS_LAYER);
  mapObj.addLayer(HEX_LAYER);
  mapObj.addLayer(HEX_LAYER_LINE);
  mapObj.addLayer(ORIGIN_LAYER_LINE);
  mapObj.addLayer(INFO_MODE_SELECTED_LAYER);

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

// Helper function to calculate months to prefetch
const getMonthsToPrefetch = (selectedMonth: string | undefined): string[] => {
  if (!selectedMonth) return [];

  const date = dayjs(selectedMonth);
  const months: string[] = [];

  // Previous month
  months.push(date.subtract(1, "month").format("YYYY-MM-DD"));

  // Next month
  months.push(date.add(1, "month").format("YYYY-MM-DD"));

  // Same month previous year
  months.push(date.subtract(1, "year").format("YYYY-MM-DD"));

  // Same month next year
  months.push(date.add(1, "year").format("YYYY-MM-DD"));

  return months;
};
export const TRIP_COUNT_QUERY_KEY = "tripCounts";

export const useTripCountData = () => {
  const { departureCells, selectedMonth, analysisType } = useMapConfigStore();

  const query = useQuery({
    queryKey: [
      TRIP_COUNT_QUERY_KEY,
      departureCells,
      selectedMonth,
      analysisType,
    ],
    queryFn: () =>
      getTripCountData(departureCells, selectedMonth, analysisType),
    enabled: !!selectedMonth,
  });

  const currentData = query.data?.data.trip_counts;

  return {
    ...query,
    currentData,
  };
};
// Hook to prefetch adjacent months and years
export const usePrefetchTripCountData = () => {
  const queryClient = useQueryClient();
  const { departureCells, selectedMonth, analysisType } = useMapConfigStore();

  useEffect(() => {
    if (!selectedMonth) return;

    const monthsToPrefetch = getMonthsToPrefetch(selectedMonth);

    // Prefetch each month
    monthsToPrefetch.forEach((month) => {
      queryClient.prefetchQuery({
        queryKey: [TRIP_COUNT_QUERY_KEY, departureCells, month, analysisType],
        queryFn: () => getTripCountData(departureCells, month, analysisType),
        staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
      });
    });
  }, [queryClient, departureCells, selectedMonth, analysisType]);
};

// Helper function to update hex layer colors without animation
const updateHexLayerColors = (
  map: MutableRefObject<Map | null>,
  departureCountMap: Record<string, number>,
  scale: [number, number],
  opacityMap?: Record<string, number>,
) => {
  if (!map.current) return;

  const logMin = Math.log(scale[0] + 1);
  const logMax = Math.log(scale[1] + 1);
  const logRange = logMax - logMin;

  map.current.setPaintProperty(HEX_LAYER.id, "fill-color", [
    "case",
    ["!", ["has", ["id"], ["literal", departureCountMap]]],
    "#ffffff00",
    ["<", ["get", ["id"], ["literal", departureCountMap]], scale[0]],
    "#ffffff00",
    [
      "interpolate",
      ["linear"],
      ["ln", ["+", ["get", ["id"], ["literal", departureCountMap]], 1]],
      logMin,
      "#440154", // 0% - dark purple
      logMin + logRange * 0.15,
      "#482878", // 15% - purple
      logMin + logRange * 0.3,
      "#3e4989", // 30% - blue-purple
      logMin + logRange * 0.45,
      "#31688e", // 45% - blue
      logMin + logRange * 0.6,
      "#26828e", // 60% - teal
      logMin + logRange * 0.75,
      "#35b779", // 75% - green
      logMin + logRange * 0.9,
      "#6ece58", // 90% - light green
      logMax,
      "#fde725", // 100% - yellow
    ],
  ]);

  // Set opacity separately if provided
  if (opacityMap) {
    map.current.setPaintProperty(HEX_LAYER.id, "fill-opacity", [
      "case",
      ["!", ["has", ["id"], ["literal", opacityMap]]],
      0,
      ["get", ["id"], ["literal", opacityMap]],
    ]);
  }
};

// Helper function to calculate opacity for each cell during animation
const interpolateOpacity = (
  oldData: Record<string, number> | null,
  newData: Record<string, number>,
  progress: number,
): Record<string, number> => {
  const result: Record<string, number> = {};

  // Get all unique keys from both datasets
  const allKeys = new Set([
    ...Object.keys(oldData ?? {}),
    ...Object.keys(newData),
  ]);

  allKeys.forEach((key) => {
    const oldValue = oldData?.[key] || 0;
    const newValue = newData[key] || 0;

    const hadValue = oldValue > 0;
    const hasValue = newValue > 0;

    if (!hadValue && hasValue) {
      // Fading in: opacity goes from 0 to 1
      result[key] = progress;
    } else if (hadValue && !hasValue) {
      // Fading out: opacity goes from 1 to 0
      result[key] = DEFAULT_HEX_OPACITY - progress;
    } else if (hasValue) {
      // Cell has value in both states: full opacity
      result[key] = DEFAULT_HEX_OPACITY;
    } else {
      // No value in either state: transparent
      result[key] = 0;
    }
  });

  return result;
};

// Helper function to interpolate between two data objects
const interpolateData = (
  oldData: Record<string, number> | null,
  newData: Record<string, number>,
  progress: number,
): Record<string, number> => {
  const result: Record<string, number> = {};

  // Get all unique keys from both datasets
  const allKeys = new Set([
    ...Object.keys(oldData ?? {}),
    ...Object.keys(newData),
  ]);

  allKeys.forEach((key) => {
    const oldValue = oldData?.[key] || 0;
    const newValue = newData[key] || 0;

    const hadValue = oldValue > 0;
    const hasValue = newValue > 0;

    if (!hadValue && hasValue) {
      // Cell is appearing: use final value immediately (opacity will handle fade-in)
      result[key] = newValue;
    } else {
      // Cell is changing value or disappearing: interpolate normally
      result[key] = oldValue + (newValue - oldValue) * progress;
    }
  });

  return result;
};

// Helper function to animate the transition between two data states
const animateDataTransition = (
  map: MutableRefObject<Map | null>,
  oldData: Record<string, number> | null,
  newData: Record<string, number>,
  scale: [number, number],
  animationFrameRef: MutableRefObject<number | null>,
  onComplete?: () => void,
  duration = 200, // Animation duration in milliseconds
) => {
  if (!map.current) return;

  const startTime = performance.now();

  const animate = (currentTime: DOMHighResTimeStamp) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Easing function (ease-in-out for smooth animation)
    const easeInOut =
      progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

    // Interpolate between old and new data
    const interpolatedData = interpolateData(oldData, newData, easeInOut);
    const interpolatedOpacity = interpolateOpacity(oldData, newData, easeInOut);

    // Update the map with interpolated data and opacity
    updateHexLayerColors(map, interpolatedData, scale, interpolatedOpacity);

    if (progress < 1) {
      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      animationFrameRef.current = null;
      // Call completion callback after animation finishes
      onComplete?.();
    }
  };

  animationFrameRef.current = requestAnimationFrame(animate);
};
export const useUpdateMapStyleOnDataChange = (
  map: MutableRefObject<Map | null>,
  mapLoaded: boolean,
) => {
  const query = useTripCountData();
  const { scale } = useMapConfigStore();
  const animationFrameRef = useRef<number | null>(null);
  const previousDataRef = useRef<Record<string, number> | null>(null);

  useEffect(() => {
    if (!mapLoaded || scale[0] >= scale[1]) return;
    const hexLayer = map.current?.getLayer(HEX_LAYER.id);

    // Hide layer if no data and not loading
    if (hexLayer && !query.currentData && !query.isLoading) {
      map.current?.setPaintProperty(HEX_LAYER.id, "fill-color", "#ffffff00");
      return;
    }

    // Keep previous state while loading
    if (query.isLoading) return;

    if (hexLayer && query.currentData) {
      // Cancel any ongoing animation
      if (animationFrameRef.current) {
        console.log("cancel");
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      // Animate with previous data (or null on first load)
      console.log("enter");
      animateDataTransition(
        map,
        previousDataRef.current,
        query.currentData,
        scale,
        animationFrameRef,
        () => {
          // Update previous data only after animation completes
          previousDataRef.current = { ...query.currentData };
        },
      );
    }
  }, [query.currentData, scale, mapLoaded, query.isLoading]);
};
const getCellEventHandlers = (
  map: MutableRefObject<Map | null>,
  addOrRemoveDepartureCell: (cell: string) => void,
  setHoveredFeature: (feature: HoveredFeature | null) => void,
): {
  eventType: "click" | "mousemove" | "mouseleave";
  layer: string;
  handler: (
    e: Event & { features?: GeoJSONFeature[]; lngLat: LngLatLike },
  ) => void;
}[] => {
  let hoveredFeatureId: null | string = null;
  let hoverTimeout: NodeJS.Timeout | null = null;
  const isMobile = isMobileDevice();

  const handlers: EventHandler[] = [
    {
      eventType: "click",
      layer: HEX_LAYER.id,
      handler: (e) => {
        const cellId = e.features?.[0].id;
        if (typeof cellId !== "string") return;
        const coordinates = (e as MapMouseEvent).lngLat;
        const h3Id = cellId as string;

        // On desktop: always select cell on click (no mode concept)
        if (!isMobile) {
          addOrRemoveDepartureCell(cellId);
          return;
        }

        // On mobile: use interaction mode
        const mode = useInteractionModeStore.getState().mode;
        const { infoModeSelectedCell, setInfoModeSelectedCell } =
          usePopupStateStore.getState();

        if (mode === "popup") {
          // Toggle info mode selection - if clicking the same cell, deselect it and clear popup
          if (infoModeSelectedCell === h3Id) {
            setInfoModeSelectedCell(null);
            setHoveredFeature(null);
          } else {
            // Show popup and select new cell
            setHoveredFeature({ id: h3Id, coordinates: coordinates });
            setInfoModeSelectedCell(h3Id);
          }
        } else {
          // Select cell on click in selection mode
          addOrRemoveDepartureCell(cellId);
          // Clear info mode selection when in selection mode
          setInfoModeSelectedCell(null);
        }
      },
    },
  ];

  // Only add mousemove and mouseleave handlers on non-mobile devices
  if (!isMobile) {
    handlers.push(
      {
        eventType: "mousemove" as const,
        layer: HEX_LAYER.id,
        handler: (e) => {
          const feature = e.features?.[0];
          if (!feature?.id || !map.current) return;

          const coordinates = e.lngLat;
          const h3Id = feature.id as string;

          // Always show popup on hover (desktop only)
          setHoveredFeature({ id: h3Id, coordinates: coordinates });
          map.current.getCanvas().style.cursor = "pointer";

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

              const currentOpacity =
                previousFeatureState?.opacity || DEFAULT_HEX_OPACITY;
              // Only animate if it's not already at 0.5
              if (currentOpacity !== DEFAULT_HEX_OPACITY) {
                animateOpacity(
                  map,
                  hoveredFeatureId,
                  currentOpacity,
                  DEFAULT_HEX_OPACITY,
                );
              } else {
                // Just set hover state to false if already at correct opacity
                map.current?.setFeatureState(
                  {
                    source: HEX_SOURCE_ID,
                    sourceLayer: HEX_SOURCE_LAYER_ID,
                    id: hoveredFeatureId,
                  },
                  { hover: false },
                );
              }
            }

            // Start animating new feature
            hoveredFeatureId = h3Id;
            animateOpacity(map, h3Id, DEFAULT_HEX_OPACITY, 0.85, 100);
          }
        },
      },
      {
        eventType: "mouseleave",
        layer: HEX_LAYER.id,
        handler: () => {
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
    );
  }

  return handlers;
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
  map: MutableRefObject<Map | null>,
  mapLoaded: boolean,
) => {
  const { departureCells } = useMapConfigStore();

  useEffect(() => {
    if (!mapLoaded) return;
    const originGeoJson = convertCellsToGeoJSON(departureCells);

    const originSource = map.current?.getSource(
      ORIGIN_SOURCE_ID,
    ) as maplibregl.GeoJSONSource;
    originSource?.setData(originGeoJson);
  }, [departureCells, map, mapLoaded]);
};

export const useUpdateInfoModeSelectedCell = (
  map: MutableRefObject<Map | null>,
  mapLoaded: boolean,
) => {
  const { infoModeSelectedCell } = usePopupStateStore();

  useEffect(() => {
    if (!mapLoaded) return;

    const cells = infoModeSelectedCell ? [infoModeSelectedCell] : [];
    const geoJson = convertCellsToGeoJSON(cells);

    const source = map.current?.getSource(
      INFO_MODE_SELECTED_SOURCE_ID,
    ) as maplibregl.GeoJSONSource;
    source?.setData(geoJson);
  }, [infoModeSelectedCell, map, mapLoaded]);
};

const convertCellsToGeoJSON = (
  cells: string[],
): GeoJSON.FeatureCollection<GeoJSON.Geometry> => {
  const polygons = cellsToMultiPolygon(cells, true);
  const features = polygons.map((polygon) => ({
    type: "Feature" as const,
    geometry: {
      type: "Polygon" as const,
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
  map: MutableRefObject<Map | null>,
  featureId: string,
  startOpacity: number,
  endOpacity: number,
  duration = 1000,
) => {
  if (!map.current || !featureId) return;

  const startTime = performance.now();

  const animate = (currentTime: DOMHighResTimeStamp) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Easing function (ease-out for smooth deceleration)
    const easeOut = 1 - Math.pow(1 - progress, 3);
    const currentOpacity = startOpacity + (endOpacity - startOpacity) * easeOut;
    // Update the layer opacity for this specific feature
    map.current?.setFeatureState(
      {
        source: HEX_SOURCE_ID,
        sourceLayer: HEX_SOURCE_LAYER_ID,
        id: featureId,
      },
      { opacity: currentOpacity, hover: endOpacity > startOpacity },
    );

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  };

  requestAnimationFrame(animate);
};
