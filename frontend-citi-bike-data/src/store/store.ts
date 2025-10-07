import { useTripCountData } from "@/map/map-config";
import { getMaxDate } from "@/utils/api";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { create } from "zustand";

interface Store {
  departureCells: string[];
  departureCountMap: Record<string, number> | null;
  selectedMonth: string | undefined;
  analysisType: "departures" | "arrivals";
  scaleType: "dynamic" | "custom";
  scale: [number, number];
  setScaleType: (type: "dynamic" | "custom") => void;
  setScale: (max: [number, number]) => void;
  swapAnalysisType: () => void;
  setSelectedMonth: (month: string | undefined) => void;
  setDepartureCountMap: (map: Record<string, number>) => void;
  setDepartureCells: (departureCells: string[]) => void;
  addOrRemoveDepartureCell: (cell: string) => void;
}

export const useMapConfigStore = create<Store>((set) => ({
  departureCells: [],
  departureCountMap: null,
  selectedMonth: undefined,
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
