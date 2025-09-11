import { create } from "zustand";

interface Store {
  departureCells: string[];
  departureCountMap: Record<string, number> | null;
  selectedMonth: string;
  analysisType: "departures" | "arrivals";
  setAnalysisType: (type: "departures" | "arrivals") => void;
  setSelectedMonth: (month: string) => void;
  setDepartureCountMap: (map: Record<string, number>) => void;
  setDepartureCells: (departureCells: string[]) => void;
  addOrRemoveDepartureCell: (cell: string) => void;
}

export const useMapConfigStore = create<Store>((set) => ({
  departureCells: [],
  departureCountMap: null,
  selectedMonth: "2025-07-01",
  analysisType: "departures",
  setAnalysisType: (type) => set({ analysisType: type }),
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
