import {
  PATH_LINE_LAYER,
  PATH_STATION_LAYER,
  NYC_LINE_LAYER,
  NYC_STATION_LAYER,
  NJ_LIGHT_RAIL_LINE_LAYER,
  NJ_LIGHT_RAIL_STATION_LAYER,
  NJ_RAIL_LINE_LAYER,
  NJ_RAIL_STATION_LAYER,
  DOCK_LOCATIONS_CURRENT_LAYER,
  HEX_LAYER,
  HEX_LAYER_LINE,
} from "@/map/layers";
import { create } from "zustand";

export interface LayerGroup {
  id: string;
  name: string;
  visible: boolean;
  layerIds: string[];
}

interface LayerVisibilityStore {
  layerGroups: LayerGroup[];
  layersAdded: boolean;
  setLayersAdded: (added: boolean) => void;
  toggleLayerGroup: (groupId: string) => void;
  setLayerGroupVisibility: (groupId: string, visible: boolean) => void;
  initializeFromUrlParams: () => void;
}

// Default configuration - can be modified to set initial visibility states
const defaultLayerGroups: LayerGroup[] = [
  {
    id: "transit",
    name: "Transit",
    visible: false,
    layerIds: [
      PATH_LINE_LAYER.id,
      PATH_STATION_LAYER.id,
      NYC_LINE_LAYER.id,
      NYC_STATION_LAYER.id,
      NJ_LIGHT_RAIL_LINE_LAYER.id,
      NJ_LIGHT_RAIL_STATION_LAYER.id,
      NJ_RAIL_LINE_LAYER.id,
      NJ_RAIL_STATION_LAYER.id,
    ],
  },
  {
    id: "bike",
    name: "CitiBike",
    visible: true,
    layerIds: [HEX_LAYER.id, HEX_LAYER_LINE.id],
  },
  {
    id: "docks",
    name: "Docks (Aug '25)",
    visible: false,
    layerIds: [DOCK_LOCATIONS_CURRENT_LAYER.id],
  },
  {
    id: "bike_lanes",
    name: "NYC Bike Lanes",
    visible: false,
    layerIds: ["nyc_bike_lanes_layer"],
  },
];

export const useLayerVisibilityStore = create<LayerVisibilityStore>((set) => ({
  layerGroups: defaultLayerGroups,
  layersAdded: false,
  setLayersAdded: (added: boolean) => set({ layersAdded: added }),

  toggleLayerGroup: (groupId: string) => {
    set((state) => ({
      layerGroups: state.layerGroups.map((group) =>
        group.id === groupId ? { ...group, visible: !group.visible } : group,
      ),
    }));
  },

  setLayerGroupVisibility: (groupId: string, visible: boolean) => {
    set((state) => ({
      layerGroups: state.layerGroups.map((group) =>
        group.id === groupId ? { ...group, visible } : group,
      ),
    }));
  },

  // Future URL params implementation placeholder
  initializeFromUrlParams: () => {
    // TODO: Parse URL params and update layer visibility
    // Example: ?layers=transit,bike (only these visible)
    // or ?hide=docks (hide specific layers)
    // This will be implemented in a future update
  },
}));
