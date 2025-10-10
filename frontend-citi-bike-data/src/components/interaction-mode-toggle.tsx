import React from "react";
import { useInteractionModeStore } from "../store/interaction-mode-store";
import { Switch } from "@headlessui/react";
// Remove the unused import if not needed
import PinRoundedIcon from "@mui/icons-material/PinRounded";
import SelectHexIcon from "@/icons/select-hex";
import { MapButton } from "@/map/map-button";

import { useMapConfigStore } from "@/store/store";
import TrashHexIcon from "@/icons/trash-hex";

export const InteractionModeToggle: React.FC = () => {
  const { mode, toggleMode } = useInteractionModeStore();

  return (
    <div className="pointer-events-auto flex flex-row gap-2">
      <Switch
        checked={mode === "popup"}
        onChange={toggleMode}
        className={
          "border-cb-lightGray flex h-12 w-24 flex-row overflow-hidden rounded-md border-[0.5px] bg-white/30 text-gray-900 drop-shadow-md backdrop-blur-md transition"
        }
      >
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-md ${mode === "popup" ? "bg-transparent" : "bg-white drop-shadow-md"} text-gray-900 transition`}
        >
          <SelectHexIcon fontSize="small" />
        </div>
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-md ${mode === "popup" ? "bg-white drop-shadow-md" : "bg-transparent"} text-gray-900 transition`}
        >
          <PinRoundedIcon fontSize="small" />
        </div>
      </Switch>
      <DeleteButton />
    </div>
  );
};

export const DeleteButton = () => {
  const { departureCells, setDepartureCells } = useMapConfigStore();
  const noCellsSelected = departureCells.length === 0;
  if (noCellsSelected) return null;
  return (
    <MapButton onClick={() => setDepartureCells([])} title="Delete Selection">
      <TrashHexIcon />
    </MapButton>
  );
};
