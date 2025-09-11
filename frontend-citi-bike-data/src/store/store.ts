import { create } from "zustand";

interface Store {
  departureCells: string[];
  departureCountMap: Record<string, number> | null;
  setDepartureCountMap: (map: Record<string, number>) => void;
  setDepartureCells: (departureCells: string[]) => void;
  addOrRemoveDepartureCell: (cell: string) => void;
}

export const useMapConfigStore = create<Store>((set) => ({
  departureCells: [],
  departureCountMap: null,
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
