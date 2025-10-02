import { useTripCountData } from "@/map/map-config";
import { useEffect } from "react";
import { create } from "zustand";

interface Store {
  departureCells: string[];
  departureCountMap: Record<string, number> | null;
  selectedMonth: string;
  analysisType: "departures" | "arrivals";
  scaleType: "dynamic" | "custom";
  scale: [number, number];
  setScaleType: (type: "dynamic" | "custom") => void;
  setScale: (max: [number, number]) => void;
  swapAnalysisType: () => void;
  setSelectedMonth: (month: string) => void;
  setDepartureCountMap: (map: Record<string, number>) => void;
  setDepartureCells: (departureCells: string[]) => void;
  addOrRemoveDepartureCell: (cell: string) => void;
}

export const useMapConfigStore = create<Store>((set) => ({
  departureCells: [],
  departureCountMap: null,
  selectedMonth: "2025-07-01",
  analysisType: "arrivals",
  scaleType: "dynamic",
  scale: [1, 100],
  setScaleType: (type) => set({ scaleType: type }),
  setScale: (max) => set({ scale: max }),
  swapAnalysisType: () =>
    set((state) => ({
      analysisType:
        state.analysisType === "departures" ? "arrivals" : "departures",
    })),
  setSelectedMonth: (month) => set({ selectedMonth: month }),
  setDepartureCountMap: (map) => set({ departureCountMap: map }),
  setDepartureCells: (departureCells) =>
    set({ departureCells: departureCells }),
  addOrRemoveDepartureCell: (cell) =>
    set((state) => {
      const isCellPresent = state.departureCells.includes(cell);
      if (isCellPresent) {
        return {
          departureCells: state.departureCells.filter((c) => c !== cell),
        };
      } else {
        return { departureCells: [...state.departureCells, cell] };
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
  }, [query.data, scaleType]);
};
