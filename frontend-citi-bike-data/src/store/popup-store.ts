import maplibregl, { LngLatLike } from "maplibre-gl";
import { create } from "zustand";

export interface HoveredFeature {
  id: string;
  coordinates: LngLatLike;
}

export interface ClickedFeature extends HoveredFeature {
  isOrigin?: boolean;
  isDestination?: boolean;
}

interface PopupStateStore {
  hoveredFeature: HoveredFeature | null;
  setHoveredFeature: (feature: HoveredFeature | null) => void;
  clickedFeature: ClickedFeature | null;
  setClickedFeature: (feature: ClickedFeature | null) => void;
  infoModeSelectedCell: string | null;
  setInfoModeSelectedCell: (cellId: string | null) => void;
}

// Desktop only
export const CLICKED_POPUP = new maplibregl.Popup({
  // closeButton: false,
  closeOnClick: false,
  maxWidth: "200px",

});
export const usePopupStateStore = create<PopupStateStore>((set) => ({
  hoveredFeature: null,
  setHoveredFeature: (feature) => {
    set({ hoveredFeature: feature });
  },
  clickedFeature: null,
  setClickedFeature: (feature) => {
    set({ clickedFeature: feature });
  },
  infoModeSelectedCell: null,
  setInfoModeSelectedCell: (cellId) => {
    set({ infoModeSelectedCell: cellId });
  },
}));
