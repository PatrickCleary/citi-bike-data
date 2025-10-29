import React from "react";
import { useMapConfigStore } from "@/store/store";

import { MapButtonStyle } from "@/map/map-button";
import classNames from "classnames";

export const SelectionModeToggle: React.FC = () => {
  const { setOriginCells, setDestinationCells } = useMapConfigStore();

  return (
    <div
      className={classNames(
        MapButtonStyle,
        "pointer-events-auto hidden w-fit p-1 md:flex",
      )}
    >
      <button
        onClick={() => {
          setOriginCells([]);
          setDestinationCells([]);
        }}
      >
        {" "}
        clear
      </button>
    </div>
  );
};
