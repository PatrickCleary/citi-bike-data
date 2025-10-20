import { Protocol } from "pmtiles";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getMonthlySum,
  getTripCountData,
  getMaxDate,
  getMonthlyTotals,
} from "@/utils/api";
import { HoveredFeature, usePopupStateStore } from "@/store/popup-store";
import maplibregl, {
  GeoJSONFeature,
  Map,
  Event,
  MapMouseEvent,
  LngLatLike,
  FilterSpecification,
} from "maplibre-gl";
import { MutableRefObject, useEffect, useState, useMemo } from "react";
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
  NYC_BIKE_LANES_SOURCE,
  NYC_BIKE_LANES_SOURCE_ID,
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
  HEX_LAYER_GLOW,
  HEX_SOURCE_LAYER_ID,
  INFO_MODE_SELECTED_LAYER,
  NJ_LIGHT_RAIL_LINE_LAYER,
  NJ_LIGHT_RAIL_STATION_LAYER,
  NJ_RAIL_LINE_LAYER,
  NJ_RAIL_STATION_LAYER,
  NYC_BIKE_LANE_LAYER,
  NYC_LINE_LAYER,
  NYC_STATION_LAYER,
  ORIGIN_LAYER_LINE,
  PATH_LINE_LAYER,
  PATH_STATION_LAYER,
} from "./layers";
import { useMapConfigStore } from "@/store/store";
import { useLayerVisibilityStore } from "@/store/layer-visibility-store";
import { animateCellsByTripCount } from "./animation";
import { useIntroModalStore } from "@/store/intro-modal-store";

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
    addBikeLaneLayer(map);
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
  const sources = [
    { id: PATH_LINES_SOURCE_ID, source: PATH_LINES_SOURCE },
    { id: PATH_STATIONS_SOURCE_ID, source: PATH_STATIONS_SOURCE },
    { id: NYC_LINES_SOURCE_ID, source: NYC_LINES_SOURCE },
    { id: NYC_STATIONS_SOURCE_ID, source: NYC_STATIONS_SOURCE },
    { id: NJ_LIGHT_RAIL_LINES_SOURCE_ID, source: NJ_LIGHT_RAIL_LINES_SOURCE },
    {
      id: NJ_LIGHT_RAIL_STATIONS_SOURCE_ID,
      source: NJ_LIGHT_RAIL_STATIONS_SOURCE,
    },
    { id: NJ_RAIL_LINES_SOURCE_ID, source: NJ_RAIL_LINES_SOURCE },
    { id: NJ_RAIL_STATIONS_SOURCE_ID, source: NJ_RAIL_STATIONS_SOURCE },
  ];

  sources.forEach(({ id, source }) => {
    if (!mapObj.getSource(id)) {
      mapObj.addSource(id, source);
    }
  });

  const layers = [
    PATH_LINE_LAYER,
    PATH_STATION_LAYER,
    NYC_LINE_LAYER,
    NYC_STATION_LAYER,
    NJ_LIGHT_RAIL_LINE_LAYER,
    NJ_LIGHT_RAIL_STATION_LAYER,
    NJ_RAIL_LINE_LAYER,
    NJ_RAIL_STATION_LAYER,
  ];

  layers.forEach((layer) => {
    if (!mapObj.getLayer(layer.id)) {
      mapObj.addLayer(layer);
    }
  });
};

const addDockLayer = (map: MutableRefObject<Map | null>) => {
  if (!map.current) return;
  const mapObj = map.current;
  if (!mapObj.getSource(BIKE_DOCKS_CURRENT_SOURCE_ID)) {
    mapObj.addSource(BIKE_DOCKS_CURRENT_SOURCE_ID, BIKE_DOCKS_CURRENT_SOURCE);
  }
  if (!mapObj.getLayer(DOCK_LOCATIONS_CURRENT_LAYER.id)) {
    mapObj.addLayer(DOCK_LOCATIONS_CURRENT_LAYER);
  }
};

const addBikeLaneLayer = (map: MutableRefObject<Map | null>) => {
  if (!map.current) return;
  const mapObj = map.current;
  if (!mapObj.getSource(NYC_BIKE_LANES_SOURCE_ID))
    mapObj.addSource(NYC_BIKE_LANES_SOURCE_ID, NYC_BIKE_LANES_SOURCE);
  if (!mapObj.getLayer(NYC_BIKE_LANE_LAYER.id))
    mapObj.addLayer(NYC_BIKE_LANE_LAYER);
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
  const sources = [
    { id: HEX_SOURCE_ID, source: HEX_SOURCE },
    { id: ORIGIN_SOURCE_ID, source: ORIGIN_SOURCE },
    { id: INFO_MODE_SELECTED_SOURCE_ID, source: INFO_MODE_SELECTED_SOURCE },
  ];
  sources.forEach(({ id, source }) => {
    if (!mapObj.getSource(id)) {
      mapObj.addSource(id, source);
    }
  });
  const layers = [
    HEX_LAYER,
    HEX_LAYER_GLOW,
    HEX_LAYER_LINE,
    ORIGIN_LAYER_LINE,
    INFO_MODE_SELECTED_LAYER,
  ];
  layers.forEach((layer) => {
    if (!mapObj.getLayer(layer.id)) {
      mapObj.addLayer(layer);
    }
  });

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

  // Previous year's previous month (for comparison metric navigation)
  months.push(
    date.subtract(1, "year").subtract(1, "month").format("YYYY-MM-DD"),
  );

  // Next year's previous month (for comparison metric navigation)
  months.push(date.add(1, "year").subtract(1, "month").format("YYYY-MM-DD"));

  // Same month 2 years prior
  months.push(date.subtract(2, "years").format("YYYY-MM-DD"));

  // Same month 2 years ahead
  months.push(date.add(2, "years").format("YYYY-MM-DD"));

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
    staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
  });
  return query;
};

// Hook to fetch monthly sum data for selected cells with 2-year window
// Fetches data year-by-year and caches each year separately
export const useTripMonthlySumData = () => {
  const { departureCells, selectedMonth, analysisType } = useMapConfigStore();
  const maxDateQuery = useMaxDate();
  const dayjsDate = selectedMonth ? dayjs(selectedMonth) : null;

  // Calculate which years we need for the 2-year window
  const yearsToFetch = useMemo(() => {
    if (!dayjsDate || !maxDateQuery.data) return [];

    const maxDate = dayjs(maxDateQuery.data);
    const windowStart = dayjsDate.subtract(1, "year");
    const windowEnd = maxDate.isBefore(dayjsDate.add(1, "year"))
      ? maxDate
      : dayjsDate.add(1, "year");

    const years: string[] = [];
    let currentYear = parseInt(windowStart.format("YYYY"));
    const endYear = parseInt(windowEnd.format("YYYY"));

    while (currentYear <= endYear) {
      years.push(currentYear.toString());
      currentYear++;
    }

    return years;
  }, [dayjsDate, maxDateQuery.data]);

  // Fetch data for each year using separate queries (for caching)
  const fetchKey = departureCells.slice().sort().join(",");
  const yearQueries = useQuery({
    queryKey: ["tripMonthlySumByYears", fetchKey, analysisType, yearsToFetch],
    queryFn: async () => {
      if (departureCells.length === 0 || yearsToFetch.length === 0) {
        return [];
      }

      // Fetch all years in parallel
      const yearDataPromises = yearsToFetch.map((year) =>
        getMonthlySum(departureCells, year, analysisType),
      );

      const results = await Promise.all(yearDataPromises);

      // Combine all year data into a single array
      const combinedData: Array<{ date_month: string; total_count: number }> =
        [];

      results.forEach((result) => {
        if (result?.data) {
          // Handle different possible response formats
          const yearData = Array.isArray(result.data) ? result.data : [];
          combinedData.push(...yearData);
        }
      });

      // Sort by date
      combinedData.sort(
        (a, b) => dayjs(a.date_month).unix() - dayjs(b.date_month).unix(),
      );

      return combinedData;
    },
    enabled:
      !!selectedMonth &&
      yearsToFetch.length > 0 &&
      departureCells.length > 0 &&
      !!maxDateQuery.data,
    staleTime: 1000 * 60 * 5,
  });

  // Window the data to show exactly 2 years (1 year before, up to 1 year after or max date)
  const windowedData = useMemo(() => {
    if (!yearQueries.data || !dayjsDate || !maxDateQuery.data) return undefined;

    const maxDate = dayjs(maxDateQuery.data);
    const windowStart = dayjsDate.subtract(1, "year").startOf("month");
    const windowEnd = maxDate.isBefore(dayjsDate.add(1, "year"))
      ? maxDate.endOf("month")
      : dayjsDate.add(1, "year").endOf("month");

    const filtered = yearQueries.data.filter((d) => {
      const date = dayjs(d.date_month);
      return (
        (date.isAfter(windowStart) || date.isSame(windowStart)) &&
        (date.isBefore(windowEnd) || date.isSame(windowEnd))
      );
    });

    return { data: filtered };
  }, [yearQueries.data, dayjsDate, maxDateQuery.data]);

  return {
    ...yearQueries,
    data: windowedData,
  };
};

// Helper hook to get max date
const useMaxDate = () => {
  return useQuery({
    queryKey: ["max_date"],
    queryFn: () => getMaxDate(),
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  });
};

// Hook to fetch baseline monthly sum data (with no cell filters)
// Shows 2-year window centered on selected date
export const useBaselineMonthlySumData = () => {
  const { selectedMonth } = useMapConfigStore();
  const maxDateQuery = useMaxDate();
  const dayjsDate = selectedMonth ? dayjs(selectedMonth) : null;

  // Fetch all data once from start to max available date
  // This way we have all data cached for any month navigation
  const query = useQuery({
    queryKey: ["tripMonthlySumBaselineAll"],
    queryFn: () => getMonthlyTotals(),
    enabled: !!maxDateQuery.data,
    staleTime: 1000 * 60 * 60, // Consider data fresh for 60 minutes
  });

  // Window data to show exactly 2 years (1 year before, up to 1 year after or max date)
  const windowedData = useMemo(() => {
    if (!query.data || !selectedMonth || !maxDateQuery.data) return undefined;

    const maxDate = dayjs(maxDateQuery.data);
    const windowStart = dayjsDate!.subtract(1, "year").startOf("month");
    const windowEnd = maxDate.isBefore(dayjsDate!.add(1, "year"))
      ? maxDate.endOf("month")
      : dayjsDate!.add(1, "year").endOf("month");

    const filtered = query.data.filter((d) => {
      const date = dayjs(d.date_month);
      return (
        (date.isAfter(windowStart) || date.isSame(windowStart)) &&
        (date.isBefore(windowEnd) || date.isSame(windowEnd))
      );
    });

    return filtered;
  }, [query.data, selectedMonth, dayjsDate, maxDateQuery.data]);

  return {
    ...query,
    data: windowedData,
  };
};

// Hook to fetch previous month data for comparison
export const usePreviousYearData = () => {
  const { departureCells, selectedMonth, analysisType } = useMapConfigStore();

  const previousYear = selectedMonth
    ? dayjs(selectedMonth).subtract(1, "year").format("YYYY-MM-DD")
    : undefined;

  const query = useQuery({
    queryKey: [
      TRIP_COUNT_QUERY_KEY,
      departureCells,
      previousYear,
      analysisType,
    ],
    queryFn: () => getTripCountData(departureCells, previousYear, analysisType),
    enabled: !!previousYear,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return query;
};

// Hook to get month-over-month comparison data
export const useComparison = () => {
  const currentQuery = useTripCountData();
  const previousQuery = usePreviousYearData();

  const currentTotal = currentQuery.data?.data.sum_all_values || 0;
  const previousTotal = previousQuery.data?.data.sum_all_values || 0;
  const currentTripCounts = currentQuery.data?.data.trip_counts || {};
  const previousTripCounts = previousQuery.data?.data.trip_counts || {};

  // Calculate absolute and percentage change for total
  const absoluteChange = currentTotal - previousTotal;
  const percentageChange =
    previousTotal > 0
      ? ((currentTotal - previousTotal) / previousTotal) * 100
      : 0;

  // Function to get comparison for a specific cell
  const getCellComparison = (cellId: string) => {
    const currentCount = currentTripCounts[cellId] || 0;
    const previousCount = previousTripCounts[cellId] || 0;
    const cellAbsoluteChange = currentCount - previousCount;
    const cellPercentageChange =
      previousCount > 0
        ? ((currentCount - previousCount) / previousCount) * 100
        : 0;
    const smoothingConstant = 10;
    const significance =
      (currentCount - previousCount) /
      Math.sqrt(previousCount + smoothingConstant);

    return {
      currentCount,
      previousCount,
      absoluteChange: cellAbsoluteChange,
      percentageChange: cellPercentageChange,
      significance,
    };
  };

  return {
    isLoading: currentQuery.isLoading || previousQuery.isLoading,
    currentTotal,
    previousTotal,
    absoluteChange,
    percentageChange,
    getCellComparison,
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

const updateMapStyleAbsolute = (
  map: Map,
  departureCountMap: Record<string, number>,
  scale: [number, number],
) => {
  const logMin = Math.log(scale[0] + 1);
  const logMax = Math.log(scale[1] + 1);
  const logRange = logMax - logMin;

  map?.setPaintProperty(HEX_LAYER.id, "fill-color", [
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
};

const updateMapStyleComparison = (
  map: Map,
  departureCountMap: Record<string, number>,
  previousDepartureCountMap: Record<string, number>,
) => {
  // Calculate significance for each cell using: significance = (new - old) / sqrt(old + smoothing_constant)
  const smoothingConstant = 100; // Prevents division by very small numbers
  const significanceMap: { [cellId: string]: number } = {};

  Object.keys(departureCountMap).forEach((cellId) => {
    const currentCount = departureCountMap[cellId] || 0;
    const previousCount = previousDepartureCountMap[cellId] || 0;

    // Calculate significance
    const significance =
      (currentCount - previousCount) /
      Math.sqrt(previousCount + smoothingConstant);
    significanceMap[cellId] = significance;
  });

  // Add cells that existed last year but not this year (significant decrease)
  Object.keys(previousDepartureCountMap).forEach((cellId) => {
    if (!(cellId in departureCountMap)) {
      const previousCount = previousDepartureCountMap[cellId] || 0;
      const significance =
        (0 - previousCount) / Math.sqrt(previousCount + smoothingConstant);
      significanceMap[cellId] = significance;
    }
  });

  // Define color scale based on significance using BrBG (Brown-Blue-Green) colormap
  // Brown = decrease (negative significance), Light gray/white = no change (0), Blue-green = increase (positive significance)
  map.setPaintProperty(HEX_LAYER.id, "fill-color", [
    "case",
    ["!", ["has", ["id"], ["literal", significanceMap]]],
    "#ffffff00",
    [
      "interpolate",
      ["linear"],
      ["get", ["id"], ["literal", significanceMap]],
      -20, // Large negative significance
      "#543005", // Dark brown - large decrease
      -10, // Moderate negative significance
      "#8c510a", // Brown
      -5, // Small negative significance
      "#bf812d", // Light brown
      -2, // Very small negative
      "#dfc27d", // Tan
      0, // No change
      "#d8d8d8", // Very light gray (almost white)
      2, // Very small positive
      "#80cdc1", // Light blue-green
      5, // Small positive significance
      "#35978f", // Blue-green
      10, // Moderate positive significance
      "#01665e", // Dark blue-green
      20, // Large positive significance
      "#003c30", // Very dark blue-green - large increase
    ],
  ]);
};

export const useUpdateMapStyleOnDataChange = (
  map: MutableRefObject<Map | null>,
  mapLoaded: boolean,
) => {
  const query = useTripCountData();
  const previousQuery = usePreviousYearData();
  const [initialLoad, setInitialLoad] = useState(false);
  const { isOpen } = useIntroModalStore();
  const { scale, displayType } = useMapConfigStore();
  const { layersAdded } = useLayerVisibilityStore();
  const mapObj = map.current;
  if (!mapLoaded) return;
  const departureCountMap = query.data?.data.trip_counts;
  const previousDepartureCountMap = previousQuery.data?.data.trip_counts;
  const hexLayer = map.current?.getLayer(HEX_LAYER.id);
  if (scale[0] >= scale[1]) return;
  // Don't hide hex layer while loading - keep previous data visible
  if (hexLayer && !departureCountMap && !query.isLoading) {
    map.current?.setPaintProperty(HEX_LAYER.id, "fill-color", "#ffffff00");
    return;
  }
  // If the intro modal is open, don't update the layer.
  if (isOpen) {
    return;
  }
  // If loading, don't update the layer (keep previous state)
  if (
    query.isLoading ||
    previousQuery.isLoading ||
    !hexLayer ||
    !departureCountMap ||
    !previousDepartureCountMap ||
    !mapObj
  ) {
    return;
  }

  if (displayType === "absolute") {
    updateMapStyleAbsolute(mapObj, departureCountMap, scale);
  } else {
    updateMapStyleComparison(
      mapObj,
      departureCountMap,
      previousDepartureCountMap,
    );
  }

  // Only trigger animation if layers are fully added
  if (layersAdded && !initialLoad && !isOpen) {
    animateCellsByTripCount(map, departureCountMap);
    setInitialLoad(true);
  }
  return initialLoad;
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

// Hook to update bike lane filter based on selectedMonth
export const useUpdateBikeLaneFilter = (
  map: MutableRefObject<Map | null>,
  mapLoaded: boolean,
) => {
  const { selectedMonth } = useMapConfigStore();

  useEffect(() => {
    if (!mapLoaded || !selectedMonth || !map.current) return;

    const layer = map.current.getLayer(NYC_BIKE_LANE_LAYER.id);
    if (!layer) return;

    // Parse the selected month to get the end of the month
    const selectedDate = dayjs(selectedMonth);
    const endOfMonth = selectedDate.endOf("month");
    const startOfMonth = selectedDate.startOf("month");

    // Convert to ISO date strings for comparison
    const endOfMonthStr = endOfMonth.toISOString();
    const startOfMonthStr = startOfMonth.toISOString();
    // Create filter expression
    // Show lane if:
    // 1. instdate is null OR instdate is <= end of selected month
    // 2. AND ret_date is null OR ret_date is >= start of selected month
    const filter = [
      "all",
      [
        "any",
        ["!", ["has", "instdate"]], // instdate is null
        ["<=", ["get", "instdate"], endOfMonthStr], // instdate <= end of month (string comparison works for ISO dates)
      ],
      [
        "any",
        ["!", ["has", "ret_date"]], // ret_date is null
        [">=", ["get", "ret_date"], startOfMonthStr], // ret_date >= start of month (string comparison works for ISO dates)
      ],
    ] as FilterSpecification;

    map.current.setFilter(NYC_BIKE_LANE_LAYER.id, filter);
  }, [selectedMonth, map, mapLoaded]);
};
