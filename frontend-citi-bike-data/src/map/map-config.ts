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
import { MutableRefObject, useEffect } from "react";
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
import { cellsToMultiPolygon, cellToLatLng } from "h3-js";

import {
  DEFAULT_HEX_OPACITY,
  DOCK_LOCATIONS_CURRENT_LAYER,
  HEX_LAYER,
  HEX_LAYER_LINE,
  HEX_LAYER_GLOW,
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
    addHexLayer(map, addOrRemoveDepartureCell, setHoveredFeature);
    addDockLayer(map);
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
  mapObj.addLayer(HEX_LAYER_GLOW);
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
  return query;
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

export const useUpdateMapStyleOnDataChange = (
  map: MutableRefObject<Map | null>,
  mapLoaded: boolean,
) => {
  const query = useTripCountData();
  const { scale: scale } = useMapConfigStore();
  const { layersAdded } = useLayerVisibilityStore();
  if (!mapLoaded) return;
  const departureCountMap = query.data?.data.trip_counts;
  const hexLayer = map.current?.getLayer(HEX_LAYER.id);
  if (scale[0] >= scale[1]) return;
  // Don't hide hex layer while loading - keep previous data visible
  if (hexLayer && !departureCountMap && !query.isLoading) {
    map.current?.setPaintProperty(HEX_LAYER.id, "fill-color", "#ffffff00");
    return;
  }
  // If loading, don't update the layer (keep previous state)
  if (query.isLoading) {
    return;
  }
  if (hexLayer && departureCountMap) {
    const logMin = Math.log(scale[0] + 1);
    const logMax = Math.log(scale[1] + 1);
    const logRange = logMax - logMin;

    map.current?.setPaintProperty(HEX_LAYER.id, "fill-color", [
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

    // Only trigger animation if layers are fully added
    if (layersAdded) {
      animateCellsByTripCount(map, departureCountMap);
    }
  }
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

// Track if we've already animated the initial load
let hasAnimatedInitialLoad = false;

// Material Design cubic-bezier easing function
const materialEaseOut = (t: number): number => {
  // cubic-bezier(0.4, 0.0, 0.2, 1)
  const x1 = 0.4, y1 = 0.0, x2 = 0.2, y2 = 1.0;

  // Simplified approximation for cubic bezier
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;

  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  const t2 = t * t;
  const t3 = t2 * t;

  return ay * t3 + by * t2 + cy * t;
};

// Helper to get color for a given trip count
const getColorForTripCount = (
  tripCount: number,
  scale: [number, number],
): string => {
  const logMin = Math.log(scale[0] + 1);
  const logMax = Math.log(scale[1] + 1);
  const logValue = Math.log(tripCount + 1);
  const logRange = logMax - logMin;

  // Normalize to 0-1 range
  const normalized = Math.max(0, Math.min(1, (logValue - logMin) / logRange));

  // Viridis color scale
  const colors = [
    { stop: 0.0, color: "#440154" },    // dark purple
    { stop: 0.15, color: "#482878" },   // purple
    { stop: 0.3, color: "#3e4989" },    // blue-purple
    { stop: 0.45, color: "#31688e" },   // blue
    { stop: 0.6, color: "#26828e" },    // teal
    { stop: 0.75, color: "#35b779" },   // green
    { stop: 0.9, color: "#6ece58" },    // light green
    { stop: 1.0, color: "#fde725" },    // yellow
  ];

  // Find the two colors to interpolate between
  let lowerColor = colors[0];
  let upperColor = colors[colors.length - 1];

  for (let i = 0; i < colors.length - 1; i++) {
    if (normalized >= colors[i].stop && normalized <= colors[i + 1].stop) {
      lowerColor = colors[i];
      upperColor = colors[i + 1];
      break;
    }
  }

  // Interpolate between colors
  const range = upperColor.stop - lowerColor.stop;
  const localNormalized = (normalized - lowerColor.stop) / range;

  const hexToRgb = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b];
  };

  const [r1, g1, b1] = hexToRgb(lowerColor.color);
  const [r2, g2, b2] = hexToRgb(upperColor.color);

  const r = Math.round(r1 + (r2 - r1) * localNormalized);
  const g = Math.round(g1 + (g2 - g1) * localNormalized);
  const b = Math.round(b1 + (b2 - b1) * localNormalized);

  return `rgb(${r}, ${g}, ${b})`;
};

// Helper function to animate cells appearing by trip count (low to high)
const animateCellsByTripCount = (
  map: MutableRefObject<Map | null>,
  tripCounts: Record<string, number>,
) => {
  if (!map.current) return;

  // Only animate once on initial load
  if (hasAnimatedInitialLoad) return;
  hasAnimatedInitialLoad = true;

  // Get the scale from the store
  const scale = useMapConfigStore.getState().scale;

  // Wait for next frame to ensure layer is fully rendered
  requestAnimationFrame(() => {
    // Sort cells by trip count with randomness
    const sortedCells = Object.keys(tripCounts)
      .map((cellId) => {
        const tripCount = tripCounts[cellId] || 0;
        // Add random offset for variation (±20% of trip count)
        const randomOffset = (Math.random() - 0.5) * tripCount * 0.4;
        const sortValue = tripCount + randomOffset;
        return { cellId, sortValue, tripCount };
      })
      .sort((a, b) => b.sortValue - a.sortValue) // Sort by trip count ascending (low to high)
      .map(({ cellId, tripCount }) => ({ cellId, tripCount }));

    // Animation parameters
    const cellAnimDuration = 600; // Duration for each cell animation in ms
    const totalDuration = 800; // Total stagger duration in ms

    // Initially set all cells to transparent neutral color
    sortedCells.forEach(({ cellId }) => {
      map.current?.setFeatureState(
        {
          source: HEX_SOURCE_ID,
          sourceLayer: HEX_SOURCE_LAYER_ID,
          id: cellId,
        },
        {
          opacity: 0,
          color: "#808080", // neutral gray
          glowWidth: 0,
          glowColor: "#ffffff00",
        },
      );
    });

    // Animate each cell with staggered timing
    const initialDelay = 100; // Small delay to ensure layer is ready
    sortedCells.forEach(({ cellId, tripCount }, index) => {
      // Stagger start time based on index
      const progress = index / Math.max(1, sortedCells.length - 1);
      const delay = initialDelay + progress * totalDuration;

      setTimeout(() => {
        const finalColor = getColorForTripCount(tripCount, scale);
        const startTime = performance.now();

        const animate = (currentTime: DOMHighResTimeStamp) => {
          const elapsed = currentTime - startTime;
          const animProgress = Math.min(elapsed / cellAnimDuration, 1);

          // Apply Material Design easing
          const easedProgress = materialEaseOut(animProgress);

          // Animate opacity from 0 to DEFAULT_HEX_OPACITY
          const currentOpacity = easedProgress * DEFAULT_HEX_OPACITY;

          // Interpolate color from neutral gray to final color
          const grayRgb = [128, 128, 128];
          const finalRgb = finalColor.match(/\d+/g)?.map(Number) || grayRgb;
          const r = Math.round(grayRgb[0] + (finalRgb[0] - grayRgb[0]) * easedProgress);
          const g = Math.round(grayRgb[1] + (finalRgb[1] - grayRgb[1]) * easedProgress);
          const b = Math.round(grayRgb[2] + (finalRgb[2] - grayRgb[2]) * easedProgress);
          const currentColor = `rgb(${r}, ${g}, ${b})`;

          map.current?.setFeatureState(
            {
              source: HEX_SOURCE_ID,
              sourceLayer: HEX_SOURCE_LAYER_ID,
              id: cellId,
            },
            {
              opacity: currentOpacity,
              color: currentColor,
              glowWidth: 0,
              glowColor: "#ffffff00",
            },
          );

          // When animation completes, trigger subtle pulse/glow
          if (animProgress >= 1) {
            triggerPulseEffect(map, cellId, finalColor);
          } else {
            requestAnimationFrame(animate);
          }
        };

        requestAnimationFrame(animate);
      }, delay);
    });
  });
};

// Helper function to create a subtle pulse/glow effect when cell reaches final state
const triggerPulseEffect = (
  map: MutableRefObject<Map | null>,
  cellId: string,
  color: string,
) => {
  const pulseDuration = 400; // Duration of pulse effect in ms
  const startTime = performance.now();

  const animate = (currentTime: DOMHighResTimeStamp) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / pulseDuration, 1);

    // Pulse goes from 0 to max and back to 0
    const pulseProgress = Math.sin(progress * Math.PI);
    const glowWidth = pulseProgress * 3; // Max glow width of 3px
    const glowOpacity = pulseProgress * 0.6; // Max glow opacity of 60%

    // Convert color to rgba for glow
    const rgb = color.match(/\d+/g)?.map(Number) || [255, 255, 255];
    const glowColor = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${glowOpacity})`;

    map.current?.setFeatureState(
      {
        source: HEX_SOURCE_ID,
        sourceLayer: HEX_SOURCE_LAYER_ID,
        id: cellId,
      },
      {
        glowWidth,
        glowColor,
      },
    );

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      // Clear glow after pulse completes
      map.current?.setFeatureState(
        {
          source: HEX_SOURCE_ID,
          sourceLayer: HEX_SOURCE_LAYER_ID,
          id: cellId,
        },
        {
          glowWidth: 0,
          glowColor: "#ffffff00",
        },
      );
    }
  };

  requestAnimationFrame(animate);
};
