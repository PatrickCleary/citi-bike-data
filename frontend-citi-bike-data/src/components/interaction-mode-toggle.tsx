import React from "react";
import { useInteractionModeStore } from "../store/interaction-mode-store";
import { Switch } from "@headlessui/react";
// Remove the unused import if not needed
import PinRoundedIcon from "@mui/icons-material/PinRounded";
import SelectHexIcon from "@/icons/select-hex";
import { MapButtonStyle } from "@/map/map-button";

import { useMapConfigStore } from "@/store/store";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import classNames from "classnames";

export const InteractionModeToggle: React.FC = () => {
  const { mode, toggleMode } = useInteractionModeStore();

  return (
    <div className="pointer-events-auto flex flex-row gap-2">
      <Switch
        checked={mode === "popup"}
        onChange={toggleMode}
        className={
          "flex h-12 w-24 flex-row overflow-hidden rounded-md border-[0.5px] border-cb-lightGray bg-white/30 text-gray-900 drop-shadow-md backdrop-blur-md transition"
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
      <DeleteButtonMobile />
    </div>
  );
};

const DeleteButtonMobile: React.FC = () => {
  const { originCells, setOriginCells } = useMapConfigStore();
  const noCellsSelected = originCells.length === 0;

  return (
    <button
      onClick={() => setOriginCells([])}
      title="Delete Selection"
      className={classNames(
        "flex transform transition-transform duration-300 ease-in-out hover:scale-105 active:scale-95",
        MapButtonStyle,
        {
          transform: !noCellsSelected,
          "hidden scale-95 transform opacity-0": noCellsSelected,
        },
      )}
    >
      <DeleteRoundedIcon fontSize="small" />
    </button>
  );
};

export const DeleteButton: React.FC = () => {
  const { originCells, destinationCells, clearSelection, selectionMode } =
    useMapConfigStore();
  const noCellsSelected = originCells.length === 0;

  return (
    <button
      onClick={() => clearSelection()}
      title="Delete Selection"
      className={classNames(
        "fixed bottom-4 left-1/2 z-10 flex h-fit -translate-x-1/2 transform flex-row items-center gap-1 rounded-full bg-black px-3 py-2 font-sans text-xs font-light uppercase tracking-wider transition-transform duration-300 ease-in-out hover:scale-105",
        {
          "translate-y-0 transform opacity-100":
            (destinationCells.length > 0 && selectionMode === "destination") ||
            (originCells.length > 0 && selectionMode === "origin"),
          "translate-y-4 transform opacity-0":
            (originCells.length === 0 && selectionMode === "origin") ||
            (destinationCells.length === 0 && selectionMode === "destination"),
        },
      )}
    >
      <DeleteRoundedIcon fontSize="small" />
      Clear {selectionMode}
    </button>
  );
};
