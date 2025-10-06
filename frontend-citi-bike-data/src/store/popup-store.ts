import maplibregl, { LngLatLike } from "maplibre-gl";
import { create } from "zustand";

export interface HoveredFeature {
  id: string;
  coordinates: LngLatLike;
}

interface PopupStateStore {
  hoveredFeature: HoveredFeature | null;
  setHoveredFeature: (feature: HoveredFeature | null) => void;
  infoModeSelectedCell: string | null;
  setInfoModeSelectedCell: (cellId: string | null) => void;
}

// Desktop only
export const CLICKED_POPUP = new maplibregl.Popup({
  closeButton: false,
  closeOnClick: false,
  maxWidth: "200px",
});
export const usePopupStateStore = create<PopupStateStore>((set) => ({
  hoveredFeature: null,
  setHoveredFeature: (feature) => {
    set({ hoveredFeature: feature });
  },
  infoModeSelectedCell: null,
  setInfoModeSelectedCell: (cellId) => {
    set({ infoModeSelectedCell: cellId });
  },
}));
