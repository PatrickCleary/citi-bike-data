import { create } from "zustand";

export type InteractionMode = "popup" | "selection";

interface InteractionModeStore {
  mode: InteractionMode;
  setMode: (mode: InteractionMode) => void;
  toggleMode: () => void;
}

export const useInteractionModeStore = create<InteractionModeStore>((set) => ({
  mode: "popup",
  setMode: (mode) => set({ mode }),
  toggleMode: () =>
    set((state) => ({
      mode: state.mode === "popup" ? "selection" : "popup",
    })),
}));
