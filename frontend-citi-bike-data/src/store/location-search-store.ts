import { create } from "zustand";

export interface LocationResult {
  name: string;
  label: string;
  lat: number;
  lon: number;
}

interface LocationSearchStore {
  isOpen: boolean;
  selectedLocation: LocationResult | null;
  setIsOpen: (isOpen: boolean) => void;
  setSelectedLocation: (location: LocationResult | null) => void;
  clearLocation: () => void;
}

export const useLocationSearchStore = create<LocationSearchStore>((set) => ({
  isOpen: false,
  selectedLocation: null,
  setIsOpen: (isOpen) => set({ isOpen }),
  setSelectedLocation: (location) => set({ selectedLocation: location, isOpen: false }),
  clearLocation: () => set({ selectedLocation: null }),
}));
