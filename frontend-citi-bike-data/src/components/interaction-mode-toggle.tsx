import React from "react";
import { useInteractionModeStore } from "../store/interaction-mode-store";
import { Switch } from "@headlessui/react";
// Remove the unused import if not needed
import PinRoundedIcon from "@mui/icons-material/PinRounded";
import SelectHexIcon from "@/icons/select-hex";
import { MapButton } from "@/map/map-button";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import { useMapConfigStore } from "@/store/store";

export const InteractionModeToggle: React.FC = () => {
  const { mode, toggleMode } = useInteractionModeStore();
  const { departureCells, setDepartureCells } = useMapConfigStore();
  const noCellsSelected = departureCells.length === 0;
  ("flex h-12 w-12 items-center justify-center rounded-md border-[0.5px] bg-white/30 drop-shadow-lg backdrop-blur-md transition border-gray-900 text-gray-900");
  return (
    <div className="flex flex-row gap-2">
      <Switch
        checked={mode === "popup"}
        onChange={toggleMode}
        className={
          "border-cb-lightGray flex h-12 w-24 flex-row rounded-md border-[0.5px] bg-white/30 text-gray-900 shadow-lg drop-shadow-lg backdrop-blur-md transition"
        }
      >
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-md ${mode === "popup" ? "bg-white drop-shadow-lg" : "bg-transparent"} text-gray-900 transition`}
        >
          <PinRoundedIcon fontSize="small" />
        </div>
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-md ${mode === "popup" ? "bg-transparent" : "bg-white drop-shadow-lg"} text-gray-900 transition`}
        >
          <SelectHexIcon fontSize="small" />
        </div>
      </Switch>
      {!noCellsSelected && (
        <MapButton onClick={() => setDepartureCells([])}>
          <DeleteRoundedIcon fontSize="small" />
        </MapButton>
      )}
    </div>
  );
};
