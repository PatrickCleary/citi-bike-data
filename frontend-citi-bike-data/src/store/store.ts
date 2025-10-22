import { useTripCountData } from "@/map/map-config";
import { getMaxDate } from "@/utils/api";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { create } from "zustand";

interface Store {
  originCells: string[];
  destinationCells: string[];
  departureCountMap: Record<string, number> | null;
  selectedMonth: string | undefined;
  analysisType: "departures" | "arrivals";
  scaleType: "dynamic" | "custom";
  scale: [number, number];
  displayType: "absolute" | "comparison";
  normalizeComparison: boolean;
  selectionMode: "origin" | "destination";
  clearSelection: () => void;
  setDisplayType: (type: "absolute" | "comparison") => void;
  setScaleType: (type: "dynamic" | "custom") => void;
  setScale: (max: [number, number]) => void;
  setNormalizeComparison: (normalize: boolean) => void;
  setSelectionMode: (mode: "origin" | "destination") => void;
  swapAnalysisType: () => void;
  setSelectedMonth: (month: string | undefined) => void;
  setDepartureCountMap: (map: Record<string, number>) => void;
  setOriginCells: (originCells: string[]) => void;
  setDestinationCells: (destinationCells: string[]) => void;
  addOrRemoveOriginCell: (cell: string) => void;
  addOrRemoveDestinationCell: (cell: string) => void;
}

export const useMapConfigStore = create<Store>((set, get) => ({
  originCells: [],
  destinationCells: [],
  departureCountMap: null,
  selectedMonth: undefined,
  analysisType: "arrivals",
  scaleType: "dynamic",
  scale: [1, 100],
  displayType: "absolute",
  normalizeComparison: true,
  selectionMode: "origin",
  clearSelection: () => {
    const selectionMode = get().selectionMode;
    if (selectionMode === "origin") {
      set({ originCells: [] });
    } else {
      set({ destinationCells: [] });
    }
  },
  setDisplayType: (type) => set({ displayType: type }),
  setScaleType: (type) => set({ scaleType: type }),
  setScale: (max) => set({ scale: max }),
  setNormalizeComparison: (normalize) =>
    set({ normalizeComparison: normalize }),
  setSelectionMode: (mode) => set({ selectionMode: mode }),
  swapAnalysisType: () =>
    set((state) => ({
      analysisType:
        state.analysisType === "departures" ? "arrivals" : "departures",
    })),
  setSelectedMonth: (month) => set({ selectedMonth: month }),
  setDepartureCountMap: (map) => set({ departureCountMap: map }),
  setOriginCells: (originCells) => set({ originCells: originCells }),
  setDestinationCells: (destinationCells) =>
    set({ destinationCells: destinationCells }),
  addOrRemoveOriginCell: (cell) =>
    set((state) => {
      const isCellPresent = state.originCells.includes(cell);
      if (isCellPresent) {
        return {
          originCells: state.originCells.filter((c) => c !== cell),
        };
      } else {
        return { originCells: [...state.originCells, cell] };
      }
    }),
  addOrRemoveDestinationCell: (cell) =>
    set((state) => {
      console.log(state.destinationCells);
      const isCellPresent = state.destinationCells.includes(cell);
      if (isCellPresent) {
        return {
          destinationCells: state.destinationCells.filter((c) => c !== cell),
        };
      } else {
        return { destinationCells: [...state.destinationCells, cell] };
      }
    }),
}));

export const useUpdateScaleMax = () => {
  const query = useTripCountData();
  const { scaleType, setScale } = useMapConfigStore();
  useEffect(() => {
    if (query.data && scaleType === "dynamic") {
      const highestValue = query.data.data.highest_value;
      setScale([1, highestValue]);
    }
  }, [query.data, scaleType, setScale]);
};

export const useFetchLatestDate = () => {
  const { setSelectedMonth } = useMapConfigStore();

  const query = useQuery({
    queryKey: ["max_date"],
    queryFn: getMaxDate,
  });
  useEffect(() => {
    if (query.isLoading) setSelectedMonth(undefined);
    if (query.isError) setSelectedMonth(undefined);
    if (query.data) setSelectedMonth(query.data);
  }, [query.data, setSelectedMonth]);
};
