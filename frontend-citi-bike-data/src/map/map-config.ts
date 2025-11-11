import { Protocol } from "pmtiles";
import {
  useQuery,
  useQueryClient,
  UseQueryResult,
} from "@tanstack/react-query";
import {
  getMonthlySum,
  getTripCountData,
  getMaxDate,
  getMonthlyTotals,
  TripCountResult,
} from "@/utils/api";
import { HoveredFeature, usePopupStateStore } from "@/store/popup-store";
import maplibregl, {
  Map,
  Event,
  MapMouseEvent,
  LngLatLike,
  FilterSpecification,
  MapGeoJSONFeature,
} from "maplibre-gl";
import { MutableRefObject, useEffect, useState, useMemo, useRef } from "react";

import { isMobileDevice } from "@/utils/mobile-detection";
import dayjs from "dayjs";
import {
  BIKE_DOCKS_CURRENT_SOURCE,
  BIKE_DOCKS_CURRENT_SOURCE_ID,
  HEX_SOURCE,
  HEX_SOURCE_ID,
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
  ORIGIN_LABEL_SOURCE,
  ORIGIN_LABEL_SOURCE_ID,
  DESTINATION_SOURCE,
  DESTINATION_SOURCE_ID,
  PATH_LINES_SOURCE,
  PATH_LINES_SOURCE_ID,
  PATH_STATIONS_SOURCE,
  PATH_STATIONS_SOURCE_ID,
  DESTINATION_LABEL_SOURCE_ID,
  DESTINATION_LABEL_SOURCE,
} from "./sources";
import { cellsToMultiPolygon, CoordPair } from "h3-js";

import {
  DEFAULT_HEX_OPACITY,
  DOCK_LOCATIONS_CURRENT_LAYER,
  HEX_LAYER,
  HEX_LAYER_LINE,
  HEX_LAYER_GLOW,
  HEX_SOURCE_LAYER_ID,
  NJ_LIGHT_RAIL_LINE_LAYER,
  NJ_LIGHT_RAIL_STATION_LAYER,
  NJ_RAIL_LINE_LAYER,
  NJ_RAIL_STATION_LAYER,
  NYC_BIKE_LANE_LAYER,
  NYC_LINE_LAYER,
  NYC_STATION_LAYER,
  ORIGIN_LAYER_LINE,
  ORIGIN_LABEL_LAYER,
  DESTINATION_LAYER_LINE,
  DESTINATION_LAYER_LINE_INSET,
  DESTINATION_LAYER_FILL,
  PATH_LINE_LAYER,
  PATH_STATION_LAYER,
  DESTINATION_LABEL_LAYER,
  ORIGIN_LAYER_FILL,
} from "./layers";
import { useChartWindow, useMapConfigStore } from "@/store/store";
import { useLayerVisibilityStore } from "@/store/layer-visibility-store";
import { animateCellsByTripCount } from "./animation";
import { useIntroModalStore } from "@/store/intro-modal-store";

export type EventHandler = {
  eventType: "click" | "mousemove" | "mouseleave";
  layer: string;
  handler: (
    e: Event & {
      features?: MapGeoJSONFeature[];
      lngLat: LngLatLike;
    },
  ) => void;
};
export const useApplyLayers = (
  map: MutableRefObject<Map | null>,
  mapLoaded: boolean,
) => {
  const { setLayersAdded } = useLayerVisibilityStore();
  const { setHoveredFeature } = usePopupStateStore();
  useEffect(() => {
    if (!mapLoaded) return;
    addBikeLaneLayer(map);
    addTransitLayers(map);
    addHexLayer(map, setHoveredFeature);
    addDockLayer(map);
    setLayersAdded(true);
  }, [mapLoaded, map, setHoveredFeature]);
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
  setHoveredFeature: (feature: HoveredFeature | null) => void,
) => {
  if (!map.current) return;
  const mapObj = map.current;
  const eventHandlers = getCellEventHandlers(map, setHoveredFeature);
  const sources = [
    { id: HEX_SOURCE_ID, source: HEX_SOURCE },
    { id: ORIGIN_SOURCE_ID, source: ORIGIN_SOURCE },
    { id: DESTINATION_SOURCE_ID, source: DESTINATION_SOURCE },
    { id: DESTINATION_LABEL_SOURCE_ID, source: DESTINATION_LABEL_SOURCE },
    { id: ORIGIN_LABEL_SOURCE_ID, source: ORIGIN_LABEL_SOURCE },
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
    ORIGIN_LAYER_FILL,
    ORIGIN_LAYER_LINE,
    DESTINATION_LAYER_FILL,
    DESTINATION_LAYER_LINE,
    DESTINATION_LAYER_LINE_INSET,
    ORIGIN_LABEL_LAYER,
    DESTINATION_LABEL_LAYER,
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
  const { cellsToFetch, selectedMonth, analysisType } = useMapConfigStore();

  const query = useQuery({
    queryKey: [TRIP_COUNT_QUERY_KEY, cellsToFetch, selectedMonth, analysisType],
    queryFn: () => getTripCountData(cellsToFetch, selectedMonth, analysisType),
    enabled: !!selectedMonth,
    staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
  });
  return query;
};

export const useTripCountDataFilteredbyDestination = (
  query: UseQueryResult<TripCountResult | undefined, Error>,
) => {
  const { destinationCells, originCells } = useMapConfigStore();

  if (destinationCells.length === 0 || originCells.length === 0) return query;
  if (!query.data) return query;
  const filteredData = Object.entries(query.data.data.trip_counts ?? {})
    .filter((item) => destinationCells.includes(item[0]))
    .reduce(
      (obj, [key, value]) => {
        obj["trip_counts"][key] = value;
        obj["sum_all_values"] += value;
        if (value > obj["highest_value"]) {
          obj["highest_value"] = value;
        }
        return obj;
      },
      {
        trip_counts: {},
        sum_all_values: 0,
        highest_value: 0,
      } as {
        trip_counts: Record<string, number>;
        sum_all_values: number;
        highest_value: number;
      },
    );
  return { ...query, data: { data: filteredData } };
};

// Hook to fetch monthly sum data for selected cells with 4-year window
// Fetches data year-by-year and caches each year separately
export const useTripMonthlySumData = () => {
  const { originCells, destinationCells, selectedMonth, chartWindow } =
    useMapConfigStore();
  const maxDateQuery = useMaxDate();
  const dayjsDate = selectedMonth ? dayjs(selectedMonth) : null;

  const hasDestination = destinationCells.length > 0;
  const hasOrigin = originCells.length > 0;
  const shouldFetch = hasDestination || hasOrigin;

  // Calculate which years we need for the 48-month window
  const yearsToFetch = useMemo(() => {
    if (!dayjsDate || !maxDateQuery.data) return [];

    const maxDate = dayjs(maxDateQuery.data);

    // Try to center on selected date (2 years before, 2 years after)
    let windowStart = dayjsDate.subtract(chartWindow);
    let windowEnd = dayjsDate.add(chartWindow);

    // If the selected date + 2 years exceeds max date, shift window back
    // to ensure we always show 48 months ending at max date
    if (windowEnd.isAfter(maxDate)) {
      windowEnd = maxDate;
      windowStart = maxDate.subtract(chartWindow).subtract(chartWindow);
    }

    const years: string[] = [];
    let currentYear = parseInt(windowStart.format("YYYY"));
    const endYear = parseInt(windowEnd.format("YYYY"));

    while (currentYear <= endYear) {
      years.push(currentYear.toString());
      currentYear++;
    }

    return years;
  }, [dayjsDate, maxDateQuery.data]);
  const analysisType = hasOrigin ? "departures" : "arrivals";

  // Fetch data for each year using separate queries (for caching)
  const yearQueries = useQuery({
    queryKey: [
      "tripMonthlySumByYears",
      analysisType,
      yearsToFetch,
      originCells,
      destinationCells,
    ],
    queryFn: async () => {
      if (!shouldFetch || yearsToFetch.length === 0) {
        return [];
      }

      // Fetch all years in parallel
      const yearDataPromises = yearsToFetch.map((year) =>
        getMonthlySum(originCells, destinationCells, year),
      );

      const results = await Promise.all(yearDataPromises);

      // Combine all year data into a single array
      const combinedData: Array<{ date_month: string; total_count: number }> =
        [];

      results.forEach((result) => {
        if (result?.data) {
          // Handle different possible response formats
          // Backend returns array of { date_month, total_count } for monthly sums
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
      shouldFetch &&
      !!maxDateQuery.data,
    staleTime: 1000 * 60 * 5,
  });
  const { windowStart, windowEnd } = useChartWindow();
  // Window the data to show exactly 48 months
  // If selected date is near the end, shift window back to show full 48 months
  const windowedData = useMemo(() => {
    if (!yearQueries.data || !dayjsDate || !maxDateQuery.data) return undefined;

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
export const useMaxDate = () => {
  return useQuery({
    queryKey: ["max_date"],
    queryFn: () => getMaxDate(),
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  });
};

// Hook to fetch baseline monthly sum data
// If destination cells are selected, uses traffic from origin cells as baseline
// Otherwise shows 4-year window of total traffic (no cell filters)
export const useBaselineMonthlySumData = () => {
  const { selectedMonth, originCells, destinationCells, chartWindow } =
    useMapConfigStore();
  const maxDateQuery = useMaxDate();
  const dayjsDate = selectedMonth ? dayjs(selectedMonth) : null;

  // Determine if we should use origin cells as baseline (when destination cells are selected)
  const useOriginAsBaseline =
    destinationCells.length > 0 && originCells.length > 0;

  // Calculate which years we need for the 48-month window (when using origin as baseline)
  const yearsToFetch = useMemo(() => {
    if (!useOriginAsBaseline || !dayjsDate || !maxDateQuery.data) return [];

    const maxDate = dayjs(maxDateQuery.data);

    // Try to center on selected date (2 years before, 2 years after)
    let windowStart = dayjsDate.subtract(chartWindow);
    let windowEnd = dayjsDate.add(chartWindow);

    // If the selected date + 2 years exceeds max date, shift window back
    // to ensure we always show 48 months ending at max date
    if (windowEnd.isAfter(maxDate)) {
      windowEnd = maxDate;
      windowStart = maxDate.subtract(chartWindow).subtract(chartWindow);
    }

    const years: string[] = [];
    let currentYear = parseInt(windowStart.format("YYYY"));
    const endYear = parseInt(windowEnd.format("YYYY"));

    while (currentYear <= endYear) {
      years.push(currentYear.toString());
      currentYear++;
    }

    return years;
  }, [useOriginAsBaseline, dayjsDate, maxDateQuery.data]);

  // Fetch origin cell data when destination cells are selected
  const originQuery = useQuery({
    queryKey: ["tripMonthlySumOriginBaseline", yearsToFetch, originCells],
    queryFn: async () => {
      if (!useOriginAsBaseline || yearsToFetch.length === 0) {
        return [];
      }

      // Fetch all years in parallel
      const yearDataPromises = yearsToFetch.map((year) =>
        getMonthlySum(originCells, [], year),
      );

      const results = await Promise.all(yearDataPromises);

      // Combine all year data into a single array
      const combinedData: Array<{ date_month: string; total_count: number }> =
        [];

      results.forEach((result) => {
        if (result?.data) {
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
      useOriginAsBaseline &&
      !!selectedMonth &&
      yearsToFetch.length > 0 &&
      !!maxDateQuery.data,
    staleTime: 1000 * 60 * 5,
  });

  // Fetch all data once from start to max available date (when not using origin as baseline)
  // This way we have all data cached for any month navigation
  const totalQuery = useQuery({
    queryKey: ["tripMonthlySumBaselineAll"],
    queryFn: () => getMonthlyTotals(),
    enabled: !useOriginAsBaseline && !!maxDateQuery.data,
    staleTime: 1000 * 60 * 60, // Consider data fresh for 60 minutes
  });

  // Select the appropriate query based on whether we're using origin as baseline
  const query = useOriginAsBaseline ? originQuery : totalQuery;

  // Window data to show exactly 48 months
  // If selected date is near the end, shift window back to show full 48 months
  const windowedData = useMemo(() => {
    if (!query.data || !selectedMonth || !maxDateQuery.data) return undefined;

    const maxDate = dayjs(maxDateQuery.data);

    // Try to center on selected date (2 years before, 2 years after)
    let windowStart = dayjsDate!.subtract(chartWindow).startOf("month");
    let windowEnd = dayjsDate!.add(chartWindow).endOf("month");

    // If the selected date + 2 years exceeds max date, shift window back
    // to ensure we always show 48 months ending at max date
    if (windowEnd.isAfter(maxDate)) {
      windowEnd = maxDate.endOf("month");
      windowStart = maxDate
        .subtract(chartWindow)
        .subtract(chartWindow)
        .startOf("month");
    }

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

export const useComparisonData = () => {
  const { cellsToFetch, selectedMonth, analysisType, comparisonDelta } =
    useMapConfigStore();

  const compDate = selectedMonth
    ? dayjs(selectedMonth).add(comparisonDelta).format("YYYY-MM-DD")
    : undefined;

  const query = useQuery({
    queryKey: [TRIP_COUNT_QUERY_KEY, cellsToFetch, compDate, analysisType],
    queryFn: () => getTripCountData(cellsToFetch, compDate, analysisType),
    enabled: !!compDate,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return query;
};

// Hook to fetch system-wide total trips for current month (for baseline comparison)
export const useSystemTotalTrips = () => {
  const { selectedMonth } = useMapConfigStore();

  const query = useQuery({
    queryKey: [TRIP_COUNT_QUERY_KEY, [], selectedMonth, "arrivals"],
    queryFn: () => getTripCountData([], selectedMonth, "arrivals"),
    enabled: !!selectedMonth,
    staleTime: 1000 * 60 * 5,
  });

  return query;
};

// Hook to fetch system-wide total trips for previous year (for baseline comparison)
export const usePreviousYearSystemTotal = () => {
  const { selectedMonth } = useMapConfigStore();

  const previousYear = selectedMonth
    ? dayjs(selectedMonth).subtract(1, "year").format("YYYY-MM-DD")
    : undefined;

  const query = useQuery({
    queryKey: [TRIP_COUNT_QUERY_KEY, [], previousYear, "arrivals"],
    queryFn: () => getTripCountData([], previousYear, "arrivals"),
    enabled: !!previousYear,
    staleTime: 1000 * 60 * 5,
  });

  return query;
};

// Hook to get month-over-month comparison data
export const useComparison = (filter = true) => {
  const { originCells, destinationCells, normalizeComparison } =
    useMapConfigStore();
  const query = useTripCountData();
  const previousQuery = useComparisonData();
  const systemQuery = useSystemTotalTrips();
  const previousSystemQuery = usePreviousYearSystemTotal();

  const hasDestinations = destinationCells.length > 0;
  const hasOrigins = originCells.length > 0;

  // Filter by destination if destinations are selected
  const queryFiltered = useTripCountDataFilteredbyDestination(query);
  const previousQueryFiltered =
    useTripCountDataFilteredbyDestination(previousQuery);

  // Determine which data to use for the main comparison
  // If no origins and no destinations: use system-wide
  // If origins but no destinations: use origin data
  // If destinations: use destination-filtered data
  const shouldUseSystemWide = (!hasOrigins && !hasDestinations) || !filter;

  const currentTotal = shouldUseSystemWide
    ? systemQuery.data?.data.sum_all_values || 0
    : queryFiltered.data?.data.sum_all_values || 0;
  const previousTotal = shouldUseSystemWide
    ? previousSystemQuery.data?.data.sum_all_values || 0
    : previousQueryFiltered.data?.data.sum_all_values || 0;

  let currentTripCounts = filter
    ? queryFiltered.data?.data.trip_counts
    : query.data?.data.trip_counts;
  if (!currentTripCounts) currentTripCounts = {};

  let previousTripCounts = filter
    ? previousQueryFiltered.data?.data.trip_counts
    : previousQuery.data?.data.trip_counts;
  if (!previousTripCounts) previousTripCounts = {};

  // Calculate absolute and percentage change for main comparison
  const absoluteChange = currentTotal - previousTotal;
  const percentageChange =
    previousTotal > 0
      ? ((currentTotal - previousTotal) / previousTotal) * 100
      : 0;

  // Calculate baseline comparison
  // - When destinations are selected: use origin traffic as baseline
  // - Otherwise: use system-wide traffic as baseline
  let baselineAbsoluteChange = 0;
  let baselinePercentageChange = 0;
  let baselineLabel = "system";

  if (hasDestinations && hasOrigins) {
    // Use origin traffic as baseline (unfiltered by destination)
    const baselineCurrent = query.data?.data.sum_all_values || 0;
    const baselinePrevious = previousQuery.data?.data.sum_all_values || 0;
    baselineAbsoluteChange = baselineCurrent - baselinePrevious;
    baselinePercentageChange =
      baselinePrevious > 0
        ? ((baselineCurrent - baselinePrevious) / baselinePrevious) * 100
        : 0;
    baselineLabel = "origin";
  } else {
    // Use system-wide traffic as baseline
    const systemCurrent = systemQuery.data?.data.sum_all_values || 0;
    const systemPrevious = previousSystemQuery.data?.data.sum_all_values || 0;
    baselineAbsoluteChange = systemCurrent - systemPrevious;
    baselinePercentageChange =
      systemPrevious > 0
        ? ((systemCurrent - systemPrevious) / systemPrevious) * 100
        : 0;
    baselineLabel = "system";
  }

  const normalizedPercentageChange =
    percentageChange - baselinePercentageChange;

  // Calculate expected growth rate from baseline (if normalizing)
  const expectedGrowthRate =
    normalizeComparison && previousTotal > 0
      ? baselinePercentageChange / 100
      : 0;

  // Function to get comparison for a specific cell
  const getCellComparison = (cellId: string) => {
    const currentCount = currentTripCounts[cellId] || 0;
    const previousCount = previousTripCounts[cellId] || 0;
    const expectedCount = normalizeComparison
      ? previousCount * (1 + expectedGrowthRate)
      : previousCount;
    const cellAbsoluteChange = currentCount - previousCount;
    const cellPercentageChange =
      previousCount > 0
        ? ((currentCount - previousCount) / previousCount) * 100
        : 0;
    // Significance calculation (normalized if flag is on)
    const smoothingConstant = 10;
    const significance =
      (currentCount - expectedCount) /
      Math.sqrt(previousCount + smoothingConstant);

    return {
      currentCount,
      previousCount,
      expectedCount,
      absoluteChange: cellAbsoluteChange,
      percentageChange: cellPercentageChange,
      significance,
      expectedGrowthRate: expectedGrowthRate * 100, // Return as percentage
    };
  };

  const isLoading = shouldUseSystemWide
    ? systemQuery.isLoading || previousSystemQuery.isLoading
    : queryFiltered.isLoading || previousQueryFiltered.isLoading;

  // Always loading system data for baseline
  const baselineLoading =
    systemQuery.isLoading || previousSystemQuery.isLoading;

  return {
    isLoading: isLoading || baselineLoading,
    currentTotal,
    previousTotal,
    absoluteChange,
    percentageChange,
    baselineAbsoluteChange,
    baselinePercentageChange,
    normalizedPercentageChange,
    baselineLabel,
    showBaseline: !shouldUseSystemWide, // Show baseline when not already showing system-wide
    getCellComparison,
  };
};

// Hook to prefetch adjacent months and years
export const usePrefetchTripCountData = () => {
  const queryClient = useQueryClient();
  const { cellsToFetch, selectedMonth, analysisType } = useMapConfigStore();

  useEffect(() => {
    if (!selectedMonth) return;

    const monthsToPrefetch = getMonthsToPrefetch(selectedMonth);

    // Prefetch each month
    monthsToPrefetch.forEach((month) => {
      queryClient.prefetchQuery({
        queryKey: [TRIP_COUNT_QUERY_KEY, cellsToFetch, month, analysisType],
        queryFn: () => getTripCountData(cellsToFetch, month, analysisType),
        staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
      });
    });
  }, [queryClient, cellsToFetch, selectedMonth, analysisType]);
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
  currentTotal: number,
  previousTotal: number,
  normalize: boolean,
) => {
  // Calculate overall growth rate from origin cells
  // If total trips went from 500 to 1000, expectedGrowthRate = 1.0 (100% growth)
  const expectedGrowthRate =
    normalize && previousTotal > 0
      ? (currentTotal - previousTotal) / previousTotal
      : 0;

  // Calculate significance for each cell
  const smoothingConstant = 100; // Prevents division by very small numbers
  const significanceMap: { [cellId: string]: number } = {};

  Object.keys(departureCountMap).forEach((cellId) => {
    const currentCount = departureCountMap[cellId] || 0;
    const previousCount = previousDepartureCountMap[cellId] || 0;

    // Expected count based on overall origin traffic growth (if normalizing)
    const expectedCount = normalize
      ? previousCount * (1 + expectedGrowthRate)
      : previousCount;

    // Calculate significance based on deviation from expected
    // If normalizing: Positive = grew more than expected, Negative = grew less than expected
    // If not normalizing: Positive = increased, Negative = decreased
    const significance =
      (currentCount - expectedCount) /
      Math.sqrt(previousCount + smoothingConstant);
    significanceMap[cellId] = significance;
  });

  // Add cells that existed last year but not this year (significant decrease)
  Object.keys(previousDepartureCountMap).forEach((cellId) => {
    if (!(cellId in departureCountMap)) {
      const previousCount = previousDepartureCountMap[cellId] || 0;
      const expectedCount = normalize
        ? previousCount * (1 + expectedGrowthRate)
        : previousCount;
      const significance =
        (0 - expectedCount) / Math.sqrt(previousCount + smoothingConstant);
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
  hasConfig: boolean | undefined,
) => {
  const query = useTripCountData();
  const previousQuery = useComparisonData();
  const [initialLoad, setInitialLoad] = useState(false);
  const { isOpen } = useIntroModalStore();
  const { scale, displayType, normalizeComparison } = useMapConfigStore();
  const { layersAdded } = useLayerVisibilityStore();
  const mapObj = map.current;
  if (!mapLoaded) return;
  const departureCountMap = query.data?.data?.trip_counts ?? {};
  const previousDepartureCountMap = previousQuery.data?.data?.trip_counts ?? {};
  const currentTotal = query.data?.data.sum_all_values || 0;
  const previousTotal = previousQuery.data?.data?.sum_all_values || 0;
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
      currentTotal,
      previousTotal,
      normalizeComparison,
    );
  }

  // Only trigger animation if layers are fully added
  if (layersAdded && !initialLoad && !isOpen && hasConfig === false) {
    animateCellsByTripCount(map, departureCountMap);
    setInitialLoad(true);
  }
  return initialLoad;
};

const getCellEventHandlers = (
  map: MutableRefObject<Map | null>,
  setHoveredFeature: (feature: HoveredFeature | null) => void,
): {
  eventType: "click" | "mousemove" | "mouseleave";
  layer: string;
  handler: (
    e: Event & {
      features?: MapGeoJSONFeature[];
      lngLat: LngLatLike;
    },
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
        const isOrigin = e.features?.[0].state?.isOrigin as boolean;
        const isDestination = e.features?.[0].state?.isDestination as boolean;
        if (typeof cellId !== "string") return;
        const coordinates = (e as MapMouseEvent).lngLat;
        const h3Id = cellId as string;

        const { clickedFeature, setClickedFeature } =
          usePopupStateStore.getState();
        // Toggle: if clicking the same cell, clear it; otherwise set new cell
        if (clickedFeature?.id === h3Id) {
          setClickedFeature(null);
        } else {
          setClickedFeature({
            id: h3Id,
            coordinates: coordinates,
            isOrigin,
            isDestination,
          });
        }
        return;
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

          // Only show hover popup if there's no clicked feature
          const { clickedFeature } = usePopupStateStore.getState();
          if (!clickedFeature) {
            setHoveredFeature({ id: h3Id, coordinates: coordinates });
          }
          map.current.getCanvas().style.cursor = "pointer";

          if (!h3Id) return;

          // Clear any pending timeout
          if (hoverTimeout) {
            clearTimeout(hoverTimeout);
            hoverTimeout = null;
          }

          // If we're hovering a different feature
          if (hoveredFeatureId !== h3Id) {
            // Animate previous feature back to base opacity from wherever it currently is
            if (hoveredFeatureId !== null) {
              const previousFeatureState = map.current?.getFeatureState({
                source: HEX_SOURCE_ID,
                sourceLayer: HEX_SOURCE_LAYER_ID,
                id: hoveredFeatureId,
              });

              const currentOpacity =
                previousFeatureState?.opacity || DEFAULT_HEX_OPACITY;
              const baseOpacity =
                previousFeatureState?.baseOpacity || DEFAULT_HEX_OPACITY;
              // Only animate if it's not already at base opacity
              if (currentOpacity !== baseOpacity) {
                animateOpacity(
                  map,
                  hoveredFeatureId,
                  currentOpacity,
                  baseOpacity,
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

            // Start animating new feature from its current/base opacity to 0.8
            hoveredFeatureId = h3Id;
            const newFeatureState = map.current?.getFeatureState({
              source: HEX_SOURCE_ID,
              sourceLayer: HEX_SOURCE_LAYER_ID,
              id: h3Id,
            });
            const startOpacity =
              newFeatureState?.opacity ||
              newFeatureState?.baseOpacity ||
              DEFAULT_HEX_OPACITY;
            animateOpacity(map, h3Id, startOpacity, 0.8, 100);
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

            const currentOpacity = featureState?.opacity || DEFAULT_HEX_OPACITY;
            const baseOpacity =
              featureState?.baseOpacity || DEFAULT_HEX_OPACITY;

            // Animate back to base opacity
            animateOpacity(map, hoveredFeatureId, currentOpacity, baseOpacity);

            // Clear the hovered feature
            hoveredFeatureId = null;
          }

          // Only clear hover if there's no clicked feature
          const { clickedFeature } = usePopupStateStore.getState();
          if (!clickedFeature) {
            setHoveredFeature(null);
          }
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
  const { originCells } = useMapConfigStore();
  const prevOriginCellsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!mapLoaded || !map.current) return;

    const polygon = cellsToMultiPolygon(originCells, true);
    const originGeoJson = convertCellsToGeoJSON(polygon);

    const originSource = map.current?.getSource(
      ORIGIN_SOURCE_ID,
    ) as maplibregl.GeoJSONSource;
    originSource?.setData(originGeoJson);

    // Update the label position
    const labelGeoJson = convertCellsToLabelGeoJSON(
      originCells,
      polygon,
      "ORIGIN",
    );
    const labelSource = map.current?.getSource(
      ORIGIN_LABEL_SOURCE_ID,
    ) as maplibregl.GeoJSONSource;
    labelSource?.setData(labelGeoJson);

    // Update featureState for origin cells
    const prevOriginCells = prevOriginCellsRef.current;
    const originCellsSet = new Set(originCells);
    const prevOriginCellsSet = new Set(prevOriginCells);

    // Add isOrigin to new cells
    originCells.forEach((cellId) => {
      if (!prevOriginCellsSet.has(cellId)) {
        map.current?.setFeatureState(
          {
            source: HEX_SOURCE_ID,
            sourceLayer: HEX_SOURCE_LAYER_ID,
            id: cellId,
          },
          { isOrigin: true },
        );
      }
    });

    // Remove isOrigin from cells no longer in origin
    prevOriginCells.forEach((cellId) => {
      if (!originCellsSet.has(cellId)) {
        map.current?.setFeatureState(
          {
            source: HEX_SOURCE_ID,
            sourceLayer: HEX_SOURCE_LAYER_ID,
            id: cellId,
          },
          { isOrigin: false },
        );
      }
    });

    prevOriginCellsRef.current = originCells;
  }, [originCells, map, mapLoaded]);
};

export const useUpdateDestinationShape = (
  map: MutableRefObject<Map | null>,
  mapLoaded: boolean,
) => {
  const { destinationCells } = useMapConfigStore();
  const prevDestinationCellsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!mapLoaded || !map.current) return;

    const polygons = cellsToMultiPolygon(destinationCells, true);
    const destinationGeoJson = convertCellsToGeoJSON(polygons);

    const destinationSource = map.current?.getSource(
      DESTINATION_SOURCE_ID,
    ) as maplibregl.GeoJSONSource;
    destinationSource?.setData(destinationGeoJson);

    // Update the label position
    const labelGeoJson = convertCellsToLabelGeoJSON(
      destinationCells,
      polygons,
      "DESTINATION",
    );
    const labelSource = map.current?.getSource(
      DESTINATION_LABEL_SOURCE_ID,
    ) as maplibregl.GeoJSONSource;
    labelSource?.setData(labelGeoJson);

    // Update featureState for destination cells
    const prevDestinationCells = prevDestinationCellsRef.current;
    const destinationCellsSet = new Set(destinationCells);
    const prevDestinationCellsSet = new Set(prevDestinationCells);

    // Add isDestination to new cells
    destinationCells.forEach((cellId) => {
      if (!prevDestinationCellsSet.has(cellId)) {
        map.current?.setFeatureState(
          {
            source: HEX_SOURCE_ID,
            sourceLayer: HEX_SOURCE_LAYER_ID,
            id: cellId,
          },
          { isDestination: true },
        );
      }
    });

    // Remove isDestination from cells no longer in destination
    prevDestinationCells.forEach((cellId) => {
      if (!destinationCellsSet.has(cellId)) {
        map.current?.setFeatureState(
          {
            source: HEX_SOURCE_ID,
            sourceLayer: HEX_SOURCE_LAYER_ID,
            id: cellId,
          },
          { isDestination: false },
        );
      }
    });

    prevDestinationCellsRef.current = destinationCells;
  }, [destinationCells, map, mapLoaded]);
};

const DIMMED_OPACITY = 0.3;

export const useDimNonSelectedCells = (
  map: MutableRefObject<Map | null>,
  mapLoaded: boolean,
) => {
  const { originCells, destinationCells } = useMapConfigStore();
  const query = useTripCountData();

  useEffect(() => {
    if (!mapLoaded || !map.current) return;

    const departureCountMap = query.data?.data.trip_counts;
    if (!departureCountMap) return;

    // Only dim cells when BOTH origin AND destination are selected
    const shouldDim = originCells.length > 0 && destinationCells.length > 0;

    // Create a Set for faster lookup
    const selectedCells = new Set([...originCells, ...destinationCells]);

    // Update opacity for all cells
    Object.keys(departureCountMap).forEach((cellId) => {
      const isSelected = selectedCells.has(cellId);
      const targetOpacity =
        shouldDim && !isSelected ? DIMMED_OPACITY : DEFAULT_HEX_OPACITY;

      map.current?.setFeatureState(
        {
          source: HEX_SOURCE_ID,
          sourceLayer: HEX_SOURCE_LAYER_ID,
          id: cellId,
        },
        { opacity: targetOpacity, baseOpacity: targetOpacity },
      );
    });
  }, [originCells, destinationCells, map, mapLoaded, query.data]);
};

const convertCellsToGeoJSON = (
  polygons: CoordPair[][][],
): GeoJSON.FeatureCollection<GeoJSON.Geometry> => {
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
// Helper function to calculate the geometric centroid (center of mass) of a polygon
// Uses the shoelace formula for proper area-weighted centroid calculation
const findCentroid = (polygon: number[][][]): [number, number] => {
  // polygon is an array of rings, we only need the outer ring (first element)
  const ring = polygon[0];

  let area = 0;
  let cx = 0;
  let cy = 0;

  // Apply the shoelace formula
  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[i + 1];

    const crossProduct = x0 * y1 - x1 * y0;
    area += crossProduct;
    cx += (x0 + x1) * crossProduct;
    cy += (y0 + y1) * crossProduct;
  }

  area = area / 2;

  // Handle degenerate case where area is zero
  if (Math.abs(area) < 0.000001) {
    // Fall back to arithmetic mean
    let sumX = 0;
    let sumY = 0;
    for (const [x, y] of ring) {
      sumX += x;
      sumY += y;
    }
    return [sumX / ring.length, sumY / ring.length];
  }

  cx = cx / (6 * area);
  cy = cy / (6 * area);

  return [cx, cy];
};

// Helper function to calculate the centroid of origin/destination cells for label placement
// Creates one label per disconnected polygon region
const convertCellsToLabelGeoJSON = (
  cells: string[],
  polygons: CoordPair[][][],
  title: string,
): GeoJSON.FeatureCollection<GeoJSON.Geometry> => {
  if (cells.length === 0) {
    return {
      type: "FeatureCollection",
      features: [],
    };
  }

  // Calculate centroid for each polygon and create a label point
  const features = polygons.map((polygon) => {
    const centerPoint = findCentroid(polygon);

    return {
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: centerPoint,
      },
      properties: {
        title: title,
        cells: cells,
      },
    };
  });

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

// Hook to update map bounds when targetBounds changes
export const useUpdateMapBounds = (
  map: MutableRefObject<Map | null>,
  mapLoaded: boolean,
) => {
  const { targetBounds, setTargetBounds } = useMapConfigStore();

  useEffect(() => {
    if (!mapLoaded || !map.current || !targetBounds) return;

    // Fit the map to the bounds with some padding
    map.current.fitBounds(targetBounds, {
      padding: 50,
      duration: 1000, // Smooth animation over 1 second
    });

    // Clear the targetBounds after applying to prevent re-triggering
    setTargetBounds(null);
  }, [targetBounds, map, mapLoaded, setTargetBounds]);
};

// Hook to control destination fill layer visibility based on origin cells
export const useUpdateDestinationFillVisibility = (
  map: MutableRefObject<Map | null>,
  mapLoaded: boolean,
) => {
  const { originCells } = useMapConfigStore();

  useEffect(() => {
    if (!mapLoaded || !map.current) return;

    const layer = map.current.getLayer(DESTINATION_LAYER_FILL.id);
    if (!layer) return;

    // Show destination fill only when origin cells are empty
    const visibility = originCells.length === 0 ? "visible" : "none";
    map.current.setLayoutProperty(
      DESTINATION_LAYER_FILL.id,
      "visibility",
      visibility,
    );
  }, [originCells, map, mapLoaded]);
};
