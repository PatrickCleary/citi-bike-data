import React from "react";
import { useMapConfigStore } from "@/store/store";
import { Tab, TabGroup, TabList } from "@headlessui/react";
import { MapButtonStyle } from "@/map/map-button";
import classNames from "classnames";

const tabStyle = classNames(
  "uppercase tracking-wide text-xs flex flex-row gap-2 justify-center items-center transition rounded-md focus:outline-none w-24 px-2 py-1.5 text-gray-900 active:scale-95",
  "data-[selected]:bg-cb-green/30 focus:outline-none data-[focus]:bg-cb-green/20 data-[selected]:data-[focus]:bg-cb-green/30 data-[hover]:bg-cb-green/20 data-[selected]:data-[hover]:bg-cb-green/30 transition ease-out duration-100",
);

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
